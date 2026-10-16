# Musaix FastAPI OSC Bridge

The only path from the Alic3X Tool Brain into Ableton Live 12. It runs on the
same machine as Live, next to the MusaixPROOSC Remote Script / Max for Live
devices.

```
backend ──HTTPS + X-Bridge-Token──▶ POST /commands ──validate──▶ queue (8 Hz) ──UDP 9002──▶ Live
                                    ◀── result / snapshot ◀── feedback listener ◀── UDP 9000 ──┘
```

## Run

```bash
cd bridge
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export OSC_BRIDGE_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
uvicorn --factory musaix_bridge.app:create_app --host 127.0.0.1 --port 8765
```

Then expose it so the deployed backend can reach it, for example
`cloudflared tunnel --url http://127.0.0.1:8765`, and set `OSC_BRIDGE_URL` and
`OSC_BRIDGE_TOKEN` in the Musaix environment.

## Config (env)

| Variable                                        | Default              |                                                                                                    |
| ----------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| `OSC_BRIDGE_TOKEN`                              | —                    | Required in practice. If unset, auth is off (local dev only).                                      |
| `BRIDGE_LIVE_HOST` / `BRIDGE_LIVE_PORT`         | `127.0.0.1` / `9002` | Where commands go                                                                                  |
| `BRIDGE_FEEDBACK_HOST` / `BRIDGE_FEEDBACK_PORT` | `127.0.0.1` / `9000` | State feedback listener (`0` disables it)                                                          |
| `BRIDGE_WIRE`                                   | `osc`                | `osc` = OSC message carrying the JSON command; `json` = raw JSON datagram                          |
| `BRIDGE_OSC_ADDRESS`                            | `/musaix/command`    | OSC address used when `BRIDGE_WIRE=osc`                                                            |
| `BRIDGE_RATE_HZ`                                | `8`                  | Max commands per second sent to Live                                                               |
| `BRIDGE_SNAPSHOT_TIMEOUT`                       | `1.5`                | Seconds to wait for a fresh `state.snapshot` before returning the last known state (`stale: true`) |

## API

- `GET /health` — no auth
- `GET /status` — queue depth, whether Live has sent feedback in the last 10 s
- `POST /commands` — `{"type": "transport.set_tempo", "args": {"bpm": 92}}`
- `POST /panic` — drops queued commands and sends `panic.stop_all` immediately
- `GET /feedback?limit=20` — recent raw feedback from Live

Command types: `state.snapshot`, `transport.play`, `transport.stop`,
`transport.set_tempo`, `scene.fire`, `clip.fire`, `track.set_volume`,
`track.mute`, `track.solo`, `device.set_parameter`, `panic.stop_all`.
Each has a strict schema in `musaix_bridge/commands.py`; anything else gets a 422
and is never sent.

The JSON command sent to Live is
`{"id": "<hex>", "source": "alic3x", "type": "...", "args": {...}}`.

## Test

```bash
pip install -r requirements-dev.txt
pytest
```
