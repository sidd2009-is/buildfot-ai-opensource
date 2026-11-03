# BuildFit AI

Chat to an editable 3D house. Describe your plot, or upload a 2D floor plan, a hand sketch or a house photo, and BuildFit AI designs it as a structured house model and renders it in 3D in the browser.

## Stack

- React 19 + Vite + TypeScript
- Three.js via @react-three/fiber and drei (3D viewer, plan view)
- Vercel serverless function `api/design.js` calling Google Gemini (structured JSON output)
- No database yet: the design and chat are kept in the browser (localStorage)

## How it works

1. The user sends a message and/or an image.
2. `api/design.js` sends it to Gemini with the current house model and a strict schema prompt.
3. Gemini returns `{ reply, model }`. The server normalises the model (clamps sizes into the plot, cleans openings).
4. The browser renders the model: rooms as floor slabs, walls built per room edge with door and window gaps, stacked floors, optional flat or gable roof.
5. Users edit by chat ("make bedroom 1 bigger") or by hand (click a room, change size and position, add rooms or floors). Undo and redo are built in.

House model (metres, origin = front-left corner of the plot, y grows away from the road): see `src/types.ts`.

## Setup

```bash
npm install
npm run dev          # frontend only
vercel dev           # frontend + /api (needs GEMINI_API_KEY)
```

Environment variables (Vercel project settings):

| Name | Required | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Google AI Studio key. Free tier for beta, paid billing at launch. |
| `GEMINI_MODEL` | no | Defaults to `gemini-2.5-flash`. |

## Roadmap (v1 beta)

- [x] Chat to 3D, image (plan / sketch / photo) to 3D, chat edits, manual room editor, multi-floor, roof, PNG and JSON export
- [ ] Google sign-in (Firebase) and saved projects
- [ ] Server-side usage limits per user (currently 20 AI requests per browser per day)
- [ ] Furniture and better door and window rendering
- [ ] Share link for a design
- [ ] v1.5: plot form (3 layout options), PDF and DXF export, credits and payments
