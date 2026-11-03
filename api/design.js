// Vercel serverless function: chat / image -> structured house model via Gemini.
// Env: GEMINI_API_KEY (required), GEMINI_MODEL (optional, default gemini-2.5-flash).

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const SYSTEM = `You are BuildFit AI, an architect that designs houses as structured JSON.
Return ONLY a JSON object: {"reply": string, "model": HouseModel}.

HouseModel = {
 "name": string, "summary": string (1-2 sentences),
 "plot": {"width": number, "depth": number},          // metres
 "roof": "flat" | "gable",
 "style": {"wall": "#hex", "roof": "#hex"},
 "floors": [{"level": int (0=ground), "height": number (2.8-3.3),
   "rooms": [{"id": string, "name": string,
     "type": "living|bedroom|kitchen|bathroom|dining|puja|stairs|parking|balcony|store|study|utility|other",
     "x": number, "y": number, "w": number, "d": number,
     "openings": [{"wall": "front|back|left|right", "kind": "door|window", "offset": number, "width": number}]}]}]
}

Geometry rules:
- Units are metres. Origin (0,0) is the FRONT-LEFT corner of the plot; x grows to the right, y grows toward the back. The road/entrance is the front (y=0).
- Every room is an axis-aligned rectangle inside the plot: 0<=x, x+w<=plot.width, 0<=y, y+d<=plot.depth. Rooms on the same floor must NOT overlap and should tile the built area with no gaps (corridors are rooms of type "other").
- Upper floors must sit within the ground floor footprint. If there is more than one floor, include a "stairs" room at the same x,y,w,d on every floor.
- Realistic sizes: bedroom >= 3x3, bathroom about 1.5x2.2, kitchen >= 2.4x3, stairs about 1.2x3.
- offset is measured from the left end (front/back walls) or the front end (left/right walls) of that room's wall. offset+width <= wall length. Give every room at least one door; give habitable rooms windows on outer walls.
- Convert feet to metres when the user speaks in feet (1 ft = 0.3048 m). "30x40" plot in India means 30 ft wide x 40 ft deep.
- Keep ids stable when editing an existing model; only change what the user asked.

If an image is given: it may be a 2D floor plan, a hand sketch, or a photo of a house. For plans/sketches, reproduce the layout and room labels as faithfully as possible, estimating dimensions from any written numbers. For a house photo, infer the number of floors, style colours and roof type and design a plausible layout.

"reply": a short friendly message (max 2 sentences) in the user's language saying what you made or changed. Ask nothing; make reasonable assumptions and mention one.`;

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function normalize(m) {
  if (!m || !Array.isArray(m.floors)) throw new Error('bad model');
  const W = clamp(+m.plot?.width || 10, 3, 200), D = clamp(+m.plot?.depth || 12, 3, 200);
  const types = ['living','bedroom','kitchen','bathroom','dining','puja','stairs','parking','balcony','store','study','utility','other'];
  let n = 0;
  return {
    name: String(m.name || 'My house').slice(0, 80),
    summary: String(m.summary || '').slice(0, 300),
    plot: { width: W, depth: D },
    roof: m.roof === 'gable' ? 'gable' : 'flat',
    style: { wall: /^#[0-9a-f]{6}$/i.test(m.style?.wall) ? m.style.wall : '#f1ece2',
             roof: /^#[0-9a-f]{6}$/i.test(m.style?.roof) ? m.style.roof : '#b9b2a6' },
    floors: m.floors.slice(0, 6).map((f, i) => ({
      level: Number.isInteger(f.level) ? f.level : i,
      height: clamp(+f.height || 3, 2.4, 5),
      rooms: (f.rooms || []).slice(0, 40).map((r) => {
        const w = clamp(+r.w || 3, 0.6, W), d = clamp(+r.d || 3, 0.6, D);
        const x = clamp(+r.x || 0, 0, W - w), y = clamp(+r.y || 0, 0, D - d);
        return {
          id: String(r.id || `r${++n}`), name: String(r.name || 'Room').slice(0, 30),
          type: types.includes(r.type) ? r.type : 'other', x, y, w, d,
          openings: (r.openings || []).slice(0, 8).filter((o) => ['front','back','left','right'].includes(o.wall)).map((o) => {
            const len = o.wall === 'front' || o.wall === 'back' ? w : d;
            const width = clamp(+o.width || 0.9, 0.4, Math.max(0.4, len - 0.2));
            return { wall: o.wall, kind: o.kind === 'window' ? 'window' : 'door', width, offset: clamp(+o.offset || 0.2, 0, Math.max(0, len - width)) };
          }),
        };
      }),
    })),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'AI is not configured yet (GEMINI_API_KEY missing).' });

  const { prompt = '', image, current, history = [] } = req.body || {};
  if (!prompt && !image) return res.status(400).json({ error: 'Send a message or an image.' });
  if (image && image.length > 7_000_000) return res.status(413).json({ error: 'Image too large (max ~5 MB).' });

  const parts = [];
  if (current) parts.push({ text: `CURRENT MODEL (edit this, keep ids):\n${JSON.stringify(current)}` });
  const recent = (history || []).slice(-6).map((h) => `${h.role}: ${String(h.text).slice(0, 400)}`).join('\n');
  if (recent) parts.push({ text: `Recent chat:\n${recent}` });
  if (image) {
    const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(image);
    if (!m) return res.status(400).json({ error: 'Bad image format.' });
    parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
  }
  parts.push({ text: `USER: ${String(prompt).slice(0, 2000) || 'Turn this image into a 3D house model.'}` });

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || 'AI request failed';
      return res.status(r.status === 429 ? 429 : 502).json({ error: r.status === 429 ? 'AI is busy (free-tier limit). Try again in a minute.' : msg });
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    const out = JSON.parse(text.replace(/^```json|```$/g, '').trim());
    return res.status(200).json({ reply: String(out.reply || 'Here is your design.'), model: normalize(out.model) });
  } catch (e) {
    return res.status(502).json({ error: 'The AI returned something I could not read. Please try again.' });
  }
}

export const config = { maxDuration: 60 };
export { normalize };
