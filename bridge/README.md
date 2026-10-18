# Alic3X OSC Bridge

Runs on the same machine as Ableton Live 12. It executes Alic3X tool calls
against Live over OSC and reads every change back to confirm it landed.

```text
tool brain (Vercel)                         studio machine
POST /api/tools/invoke ──► bridge_commands ◄── long-poll ── alic3x_bridge ──OSC──► AbletonOSC ► Live 12
                           (Postgres queue)  ── result ──►               ◄─OSC───  (listeners)
```

The bridge **dials out** to the backend. Nothing needs to reach into the studio
network, and there are no tunnels or open ports. Commands carry a hard expiry
(≤10s), so a command queued while the bridge was offline never fires late.

## 1. Install AbletonOSC in Live

1. Download [AbletonOSC](https://github.com/ideoforms/AbletonOSC) and copy its
   folder into Live's MIDI Remote Scripts directory as `AbletonOSC`.
2. In Live: Settings → Link, Tempo & MIDI → Control Surface → **AbletonOSC**.
3. Live now listens on UDP 11000 and replies on 11001.

## 2. Run the bridge

```bash
cd bridge
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

# Local only (step 1): drive Live from this machine
python -m alic3x_bridge
curl -X POST localhost:8765/tools/tempo.set -H 'content-type: application/json' -d '{"bpm":124}'
curl localhost:8765/state

# Connected to the backend (step 2)
export ALIC3X_BACKEND_URL=https://<your-musaix-deployment>
export BRIDGE_TOKEN=<same value as the backend's BRIDGE_TOKEN>
python -m alic3x_bridge
```

No Ableton handy? Set `LIVE_ADAPTER=mock` to run against an in-memory Live.

| Env var | Default | |
| --- | --- | --- |
| `LIVE_ADAPTER` | `abletonosc` | `abletonosc` or `mock` |
| `ABLETON_HOST` / `ABLETON_SEND_PORT` / `ABLETON_LISTEN_PORT` | `127.0.0.1` / `11000` / `11001` | AbletonOSC endpoints |
| `ALIC3X_BACKEND_URL` | unset | unset = local-only mode |
| `BRIDGE_TOKEN` | — | required with a backend URL |
| `BRIDGE_ID` | hostname | shown in `/api/bridge/status` |
| `BRIDGE_PORT` | `8765` | local API, bound to 127.0.0.1 only |

## Tools

`transport.play`, `transport.continue`, `transport.stop`, `tempo.set {bpm}`,
`scene.fire {index}`, `track.mute {track, muted}`, `state.snapshot`,
`panic.stop_all`.

The registry lives in `src/lib/alic3x/tools.ts` (backend) and
`alic3x_bridge/tools.py` (bridge), and the two must match. The bridge
re-validates every call because it is the last check before anything reaches
Live.

## Tests

```bash
pytest
```

`tests/test_abletonosc.py` checks the OSC wire format over real UDP against a
fake AbletonOSC peer.
