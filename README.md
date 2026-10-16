# Musaix

AI drum pad for producers. Type a genre, play a 16-pad kit, and route MIDI into Ableton, Logic, or FL Studio.

Live site is deployed on Vercel from this repository.

## Alic3X Pro

Voice co-pilot that drives Ableton from the browser: ElevenLabs voice → Musaix Tool Brain (AI Gateway / OpenRouter, Supabase auth + memory) → FastAPI OSC bridge → Ableton Live 12. It's a separate Next.js app with a Vercel eve agent in [`apps/alic3x`](apps/alic3x), with the bridge in [`bridge/`](bridge). Setup and architecture: [docs/ALIC3X.md](docs/ALIC3X.md).
