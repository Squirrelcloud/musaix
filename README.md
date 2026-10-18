# Musaix

AI drum pad for producers. Type a genre, play a 16-pad kit, and route MIDI into Ableton, Logic, or FL Studio.

Live site is deployed on Vercel from this repository.

## Alic3X tool API (voice → Ableton)

The backend queues tool calls and the local bridge executes them in Live. See
[`bridge/README.md`](bridge/README.md) for the bridge setup.

| Endpoint | Auth | |
| --- | --- | --- |
| `GET /api/tools/` | `ALIC3X_API_TOKEN` | Tool manifest with JSON Schema params |
| `POST /api/tools/invoke` | `ALIC3X_API_TOKEN` | `{tool, args, wait_ms?}`, waits for Live's confirmed result |
| `GET /api/bridge/status` | `ALIC3X_API_TOKEN` | Online bridges and their last Live state |
| `POST /api/bridge/poll`, `/api/bridge/result` | `BRIDGE_TOKEN` | Used by the bridge only |

Requirements for deploying this:

- Set `BRIDGE_TOKEN` and `ALIC3X_API_TOKEN` (long random strings). An endpoint
  whose token is unset returns 503.
- Set `DATABASE_URL` to a real Postgres database. Without it, each serverless
  instance gets its own in-memory database, so the queue can't work across
  instances.
- Run `npm run db:migrate` against that database. The Vercel build command in
  `vercel.json` runs only `vite build`, not the migration.

Try it:

```bash
curl -X POST "$URL/api/tools/invoke" -H "Authorization: Bearer $ALIC3X_API_TOKEN" \
  -H 'content-type: application/json' -d '{"tool":"tempo.set","args":{"bpm":124}}'
```
