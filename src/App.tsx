import { useEffect, useRef, useState } from 'react';
import House3D, { ROOM_COLORS } from './House3D';
import { SAMPLE_HOUSE } from './sample';
import type { ChatMsg, HouseModel, Room, RoomType } from './types';
import './App.css';

const DAILY_LIMIT = 20; // beta: AI requests per browser per day
const ROOM_TYPES = Object.keys(ROOM_COLORS) as RoomType[];
const QUICK = [
  '30x40 ft plot, 2BHK with parking and puja room',
  'G+1 3BHK on a 40x60 ft plot, modern style, gable roof',
  'Make the living room bigger and add a balcony upstairs',
];

function load<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}

function usage(): { day: string; n: number } {
  const today = new Date().toISOString().slice(0, 10);
  const u = load('bf_usage', { day: today, n: 0 });
  return u.day === today ? u : { day: today, n: 0 };
}

async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL('image/jpeg', 0.85);
}

export default function App() {
  const [model, setModel] = useState<HouseModel>(() => load('bf_model', SAMPLE_HOUSE));
  const [isSample, setIsSample] = useState<boolean>(() => load('bf_is_sample', true));
  const [past, setPast] = useState<HouseModel[]>([]);
  const [future, setFuture] = useState<HouseModel[]>([]);
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => load('bf_msgs', [
    { role: 'assistant', text: 'Namaste! Describe your plot and the house you want, or upload a 2D plan, a sketch or a house photo. I’ll turn it into an editable 3D design.' },
  ]));
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [visibleFloors, setVisibleFloors] = useState(model.floors.length);
  const [showRoof, setShowRoof] = useState(false);
  const [topView, setTopView] = useState(false);
  const [tab, setTab] = useState<'chat' | 'view'>('chat');
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem('bf_model', JSON.stringify(model)); }, [model]);
  useEffect(() => { localStorage.setItem('bf_is_sample', JSON.stringify(isSample)); }, [isSample]);
  useEffect(() => { localStorage.setItem('bf_msgs', JSON.stringify(msgs.slice(-40).map((m) => ({ ...m, image: undefined })))); endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  useEffect(() => { setVisibleFloors((v) => Math.min(Math.max(v, 1), model.floors.length) || model.floors.length); }, [model.floors.length]);

  const commit = (next: HouseModel) => { setPast((p) => [...p.slice(-30), model]); setFuture([]); setModel(next); setIsSample(false); };
  const undo = () => { if (!past.length) return; setFuture((f) => [model, ...f]); setModel(past[past.length - 1]); setPast((p) => p.slice(0, -1)); };
  const redo = () => { if (!future.length) return; setPast((p) => [...p, model]); setModel(future[0]); setFuture((f) => f.slice(1)); };

  async function send(text?: string) {
    const prompt = (text ?? input).trim();
    if ((!prompt && !image) || busy) return;
    const u = usage();
    if (u.n >= DAILY_LIMIT) {
      setMsgs((m) => [...m, { role: 'assistant', text: `You’ve used today’s ${DAILY_LIMIT} free AI requests in the beta. Manual editing still works, and the limit resets tomorrow.` }]);
      return;
    }
    const userMsg: ChatMsg = { role: 'user', text: prompt || '(image)', image: image ?? undefined };
    setMsgs((m) => [...m, userMsg]); setInput(''); const img = image; setImage(null); setBusy(true); setTab('chat');
    try {
      const r = await fetch('/api/design', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, image: img, current: isSample ? undefined : model, history: msgs.slice(-6).map(({ role, text }) => ({ role, text })) }),
      });
      const data = await r.json().catch(() => ({ error: 'Server error.' }));
      if (!r.ok) throw new Error(data.error || 'Something went wrong.');
      localStorage.setItem('bf_usage', JSON.stringify({ day: u.day, n: u.n + 1 }));
      commit(data.model); setSelected(null); setVisibleFloors(data.model.floors.length);
      setMsgs((m) => [...m, { role: 'assistant', text: data.reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: `⚠️ ${(e as Error).message}` }]);
    } finally { setBusy(false); }
  }

  // ---- manual editing ----
  const floorIdx = Math.max(0, visibleFloors - 1);
  const findRoom = (id: string | null): [number, Room] | null => {
    if (!id) return null;
    for (let i = 0; i < model.floors.length; i++) { const r = model.floors[i].rooms.find((x) => x.id === id); if (r) return [i, r]; }
    return null;
  };
  const sel = findRoom(selected);
  const updateRoom = (id: string, patch: Partial<Room>) => commit({
    ...model, floors: model.floors.map((f) => ({ ...f, rooms: f.rooms.map((r) => {
      if (r.id !== id) return r;
      const n = { ...r, ...patch };
      n.w = Math.max(0.6, Math.min(n.w, model.plot.width)); n.d = Math.max(0.6, Math.min(n.d, model.plot.depth));
      n.x = Math.max(0, Math.min(n.x, model.plot.width - n.w)); n.y = Math.max(0, Math.min(n.y, model.plot.depth - n.d));
      return n;
    }) })),
  });
  const deleteRoom = (id: string) => { commit({ ...model, floors: model.floors.map((f) => ({ ...f, rooms: f.rooms.filter((r) => r.id !== id) })) }); setSelected(null); };
  const addRoom = () => {
    const id = `r${Date.now().toString(36)}`;
    const room: Room = { id, name: 'New room', type: 'other', x: 0, y: 0, w: 3, d: 3, openings: [{ wall: 'front', kind: 'door', offset: 1, width: 0.9 }] };
    commit({ ...model, floors: model.floors.map((f, i) => (i === floorIdx ? { ...f, rooms: [...f.rooms, room] } : f)) });
    setSelected(id);
  };
  const addFloor = () => {
    const top = model.floors[model.floors.length - 1];
    const stairs = top.rooms.filter((r) => r.type === 'stairs').map((r) => ({ ...r, id: `${r.id}-${model.floors.length}` }));
    commit({ ...model, floors: [...model.floors, { level: model.floors.length, height: top.height, rooms: stairs }] });
    setVisibleFloors(model.floors.length + 1);
  };
  const removeTopFloor = () => { if (model.floors.length > 1) commit({ ...model, floors: model.floors.slice(0, -1) }); };

  const download = (name: string, href: string) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); };
  const exportJson = () => download(`${model.name.replace(/\W+/g, '-')}.json`, URL.createObjectURL(new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' })));
  const exportPng = () => { const c = document.querySelector('canvas'); if (c) download(`${model.name.replace(/\W+/g, '-')}.png`, c.toDataURL('image/png')); };
  const importJson = async (f: File) => { try { const m = JSON.parse(await f.text()); if (m.floors) { commit(m); setVisibleFloors(m.floors.length); } } catch { /* ignore */ } };
  const reset = () => { setModel(SAMPLE_HOUSE); setIsSample(true); setPast([]); setFuture([]); setSelected(null); setMsgs([{ role: 'assistant', text: 'Fresh start. Tell me about your plot and the house you want.' }]); };

  const totalArea = model.floors.reduce((s, f) => s + f.rooms.reduce((a, r) => a + r.w * r.d, 0), 0);

  return (
    <div className={`app tab-${tab}`}>
      <aside className="chat">
        <header className="brand">
          <div className="logo">▲</div>
          <div><b>BuildFit AI</b><span>Chat to 3D house · beta</span></div>
          <button className="ghost small" onClick={reset} title="New design">New</button>
        </header>
        <div className="msgs">
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.image && <img src={m.image} alt="upload" />}
              <p>{m.text}</p>
            </div>
          ))}
          {busy && <div className="msg assistant"><p className="typing">Designing<span>.</span><span>.</span><span>.</span></p></div>}
          {isSample && !busy && (
            <div className="quick">{QUICK.slice(0, 2).map((q) => <button key={q} onClick={() => send(q)}>{q}</button>)}</div>
          )}
          <div ref={endRef} />
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          {image && <div className="attach"><img src={image} alt="" /><button type="button" onClick={() => setImage(null)}>×</button></div>}
          <div className="row">
            <button type="button" className="icon" title="Upload plan, sketch or photo" onClick={() => fileRef.current?.click()}>＋</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImage(await shrinkImage(f)); e.target.value = ''; }} />
            <textarea value={input} rows={1} placeholder={isSample ? 'e.g. 30x40 ft 2BHK with parking' : 'Ask for a change…'}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button className="primary" disabled={busy || (!input.trim() && !image)}>Send</button>
          </div>
          <small className="hint">Upload a 2D plan, hand sketch or house photo · {Math.max(0, DAILY_LIMIT - usage().n)} AI requests left today</small>
        </form>
      </aside>

      <main className="stage">
        <div className="toolbar">
          <div className="title"><b>{model.name}</b><span>{model.plot.width.toFixed(1)}×{model.plot.depth.toFixed(1)} m plot · {model.floors.length} floor{model.floors.length > 1 ? 's' : ''} · {totalArea.toFixed(0)} m² ({(totalArea * 10.764).toFixed(0)} sq ft)</span></div>
          <div className="tools">
            <button onClick={undo} disabled={!past.length} title="Undo">↶</button>
            <button onClick={redo} disabled={!future.length} title="Redo">↷</button>
            <span className="sep" />
            <button className={!topView ? 'on' : ''} onClick={() => setTopView(false)}>3D</button>
            <button className={topView ? 'on' : ''} onClick={() => setTopView(true)}>Plan</button>
            <button className={showRoof ? 'on' : ''} onClick={() => setShowRoof((s) => !s)}>Roof</button>
            {model.floors.length > 1 && (
              <select value={visibleFloors} onChange={(e) => setVisibleFloors(+e.target.value)}>
                {model.floors.map((_, i) => <option key={i} value={i + 1}>{i === 0 ? 'Ground' : `Up to floor ${i}`}</option>)}
              </select>
            )}
            <span className="sep" />
            <button onClick={addRoom}>+ Room</button>
            <button onClick={addFloor}>+ Floor</button>
            {model.floors.length > 1 && <button onClick={removeTopFloor} title="Remove top floor">− Floor</button>}
            <span className="sep" />
            <button onClick={exportPng}>PNG</button>
            <button onClick={exportJson}>Save</button>
            <label className="btn">Open<input type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} /></label>
          </div>
        </div>

        <div className="viewer">
          <House3D model={model} selectedId={selected} onSelect={setSelected} visibleFloors={visibleFloors} showRoof={showRoof} topView={topView} />
          {isSample && <div className="badge">Sample design · chat to make yours</div>}
          {sel && (
            <div className="editor">
              <div className="ed-head"><b>Edit room</b><span>Floor {sel[0] === 0 ? 'G' : sel[0]}</span><button className="ghost small" onClick={() => setSelected(null)}>×</button></div>
              <label>Name<input value={sel[1].name} onChange={(e) => updateRoom(sel[1].id, { name: e.target.value })} /></label>
              <label>Type<select value={sel[1].type} onChange={(e) => updateRoom(sel[1].id, { type: e.target.value as RoomType })}>{ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
              <div className="grid2">
                {(['w', 'd', 'x', 'y'] as const).map((k) => (
                  <label key={k}>{{ w: 'Width (m)', d: 'Depth (m)', x: 'From left', y: 'From front' }[k]}
                    <input type="number" step={0.1} value={+sel[1][k].toFixed(2)} onChange={(e) => updateRoom(sel[1].id, { [k]: +e.target.value })} />
                  </label>
                ))}
              </div>
              <p className="muted">{(sel[1].w * sel[1].d).toFixed(1)} m² · {(sel[1].w * sel[1].d * 10.764).toFixed(0)} sq ft</p>
              <button className="danger" onClick={() => deleteRoom(sel[1].id)}>Delete room</button>
            </div>
          )}
        </div>
      </main>

      <nav className="mobile-tabs">
        <button className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>Chat</button>
        <button className={tab === 'view' ? 'on' : ''} onClick={() => setTab('view')}>3D view</button>
      </nav>
    </div>
  );
}
