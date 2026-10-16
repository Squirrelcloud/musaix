# Alic3X Pro — system architecture & setup

> ElevenLabs = voice interface. Backend = real brain.

```
 Sterling ──talks──▶ ElevenLabs agent ──server tool (webhook)──┐
                                                               ▼
 Alic3X Voice Console ──server fns──▶  Musaix Backend / Tool Brain  ◀──▶ Vercel AI Gateway / OpenRouter
 (/alic3x: transcript,                 src/lib/alic3x/*                 (model routing, tool calling)
  mode selector, tool feed)                 │        │
                                            │        └──▶ Supabase (sessions, turns, tool logs,
                                            │                       memory, knowledge base)
                                  tool calls│▲ results
                                            ▼│
                                   FastAPI OSC Bridge (bridge/)
                                            │▲  OSC/UDP 9002 ▶ · ◀ feedback UDP 9000
                                            ▼│
                              Ableton Live 12 + MusaixPROOSC / Max for Live
```

| Box in the diagram             | Where it lives                                                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alic3X Voice Console           | `src/routes/alic3x.tsx`, `src/components/alic3x/console.tsx`                                                                                                                     |
| Musaix Backend / Tool Brain    | `src/lib/alic3x/brain.server.ts` (loop), `tools.ts` (tool registry + modes), `adapters.server.ts` (model, bridge, Supabase), `service.server.ts` + `functions.ts` (entry points) |
| ElevenLabs Voice Interface     | `@elevenlabs/react` in the console + webhook `src/routes/api/alic3x/elevenlabs-tool.ts`                                                                                          |
| Vercel AI Gateway / OpenRouter | `createLlm` in `adapters.server.ts` (OpenAI-compatible chat completions)                                                                                                         |
| Supabase                       | `supabase/migrations/20261016000000_alic3x.sql`                                                                                                                                  |
| Knowledge Base                 | `alic3x_kb_chunks` + `alic3x_search_kb()` (Postgres full-text)                                                                                                                   |
| FastAPI OSC Bridge             | `bridge/` (Python)                                                                                                                                                               |

## How a turn works

1. **Voice:** the console asks the server to mint a session, gets back a signed ElevenLabs URL, and connects with `session_id` and `mode` as dynamic variables. The ElevenLabs agent sends every request to the one server tool, `musaix_brain`, and speaks the `reply` it gets back.
   **Text:** the console calls the `askAlic3x` server function directly.
2. The brain loads Sterling's memories, the session's last 20 turns and the top knowledge-base hits from Supabase, then calls the model with the tools allowed in the current mode.
3. Each tool call is checked against its zod schema and mode before anything runs. Bridge tools become a `{type, args}` command that goes to the FastAPI bridge, which checks it again (Pydantic), queues it (8 Hz), and sends it to Live. `panic` skips the queue and drops everything still pending.
4. Every turn and tool call is written to Supabase. During voice sessions the console polls the tool log, so the Tool Feed shows voice turns too.

### Modes

| Mode    | Ableton tools (all modes also get `panic`, `search_knowledge`, `remember`)             |
| ------- | -------------------------------------------------------------------------------------- |
| Produce | all of them: state, play/stop, tempo, scenes, clips, volume, mute, solo, device params |
| Mix     | state, play/stop, volume, mute, solo, device params                                    |
| Perform | state, play/stop, tempo, scenes, clips, mute                                           |
| Chat    | none                                                                                   |

To add a tool, add it to `src/lib/alic3x/tools.ts` **and** `bridge/musaix_bridge/commands.py`. Both sides validate, so a tool that exists on only one side fails closed.

## Setup

### 1. Environment (Vercel project settings, or a local `.env`)

| Variable                                       | Needed for       | Notes                                                                            |
| ---------------------------------------------- | ---------------- | -------------------------------------------------------------------------------- |
| `AI_GATEWAY_API_KEY` _or_ `OPENROUTER_API_KEY` | Brain            | AI Gateway wins if both are set                                                  |
| `ALIC3X_MODEL`                                 | Brain            | Defaults to `anthropic/claude-sonnet-4.5`. Use any slug your gateway lists.      |
| `ALIC3X_LLM_BASE_URL`                          | Brain (optional) | Any other OpenAI-compatible endpoint, e.g. a local model                         |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`    | Memory/logs/KB   | Server-only. If unset, an in-process store is used (dev only, wiped on restart). |
| `OSC_BRIDGE_URL`, `OSC_BRIDGE_TOKEN`           | Ableton control  | A public URL that reaches the bridge (see step 4)                                |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`    | Voice            | If unset, the console runs text-only                                             |
| `ELEVENLABS_TOOL_SECRET`                       | Voice            | Random string; the agent's webhook sends it as `x-alic3x-secret`                 |

### 2. Supabase

Run `supabase/migrations/20261016000000_alic3x.sql` (`supabase db push`, or paste it into the SQL editor). RLS is on with no policies: only the backend's service-role key can read or write these tables. To load project docs into the knowledge base, insert chunks of a few hundred words each into `alic3x_kb_chunks (source, title, content)`.

### 3. ElevenLabs agent

Create a Conversational AI agent and set:

- **System prompt:** "You are the voice of Alic3X. For every request from Sterling, call `musaix_brain` with his words, then say its `reply` exactly. Never invent actions or results yourself."
- **Dynamic variables:** `session_id`, `mode` (the console fills these in when it connects).
- **Server tool** `musaix_brain`: webhook, `POST https://<your-app>/api/alic3x/elevenlabs-tool`
  - header `x-alic3x-secret`: the value of `ELEVENLABS_TOOL_SECRET`
  - body: `utterance` (string, LLM-filled: "Sterling's request, verbatim"), `session_id` = `{{session_id}}`, `mode` = `{{mode}}`
  - response timeout: 20 s or more (a turn can take several model↔tool round trips)
- Make the agent private (signed URLs only). The browser never sees your API key.

### 4. Bridge (on the machine running Ableton)

See [`bridge/README.md`](../bridge/README.md). In short: install the requirements, start the bridge with `OSC_BRIDGE_TOKEN` set, then expose port 8765 with Cloudflare Tunnel or Tailscale Funnel so the deployed backend can reach it, and set `OSC_BRIDGE_URL` to that public URL.

> **Check the wire format.** The bridge defaults to an OSC message at `/musaix/command` whose single argument is the JSON command (`BRIDGE_WIRE=osc`). `BRIDGE_WIRE=json` sends the raw JSON as the UDP datagram instead. Match whichever one your MusaixPROOSC Remote Script build expects. State feedback is accepted in either form on UDP 9000; any address ending in `state` or `snapshot` counts as a state snapshot.

## Security notes

- Console calls go through `authMiddleware`. Sessions are created server-side and tied to their owner, so neither the console nor the webhook can act on someone else's session.
- The webhook is protected by a shared secret (compared in constant time). The user always comes from the session, never from the request body.
- The bridge requires `X-Bridge-Token` on everything except `/health`. Never expose it without a token.
- Commands are validated twice (backend zod, bridge Pydantic) and rate-limited. Unknown commands never reach Live.
