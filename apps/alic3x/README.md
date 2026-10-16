# Alic3X

Voice console + Vercel eve agent for Musaix Pro. Talk or type; Alic3X drives Ableton Live 12 through the FastAPI OSC bridge in [`../../bridge`](../../bridge).

```bash
npm install
npm run dev        # Next.js + eve dev server (Node 24)
npm test
npm run build
```

- `agent/` — the eve agent: `instructions.md`, one tool per Ableton action in `tools/`, auth in `channels/eve.ts`
- `components/console.tsx` — transcript, mode selector, tool feed, ElevenLabs voice
- `app/api/elevenlabs-tool` — ElevenLabs webhook that posts voice turns into the eve session

Deploy on Vercel with **Root Directory** `apps/alic3x` and **Node 24.x**. Environment variables and full setup: [`docs/ALIC3X.md`](../../docs/ALIC3X.md).
