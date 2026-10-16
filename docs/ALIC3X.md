# Alic3X Pro — system architecture & setup

> ElevenLabs = voice interface. Backend = real brain.

```
 Sterling ──talks──▶ ElevenLabs agent ──server tool──▶ /api/elevenlabs-tool ──┐
                                                                              ▼
 Alic3X Voice Console ──useEveAgent──▶  /eve/v1/*  eve agent "Alic3X"  ◀──▶ Vercel AI Gateway / OpenRouter
 (Next.js, apps/alic3x)                 (apps/alic3x/agent: instructions,
                                         tools, Supabase-auth channel)  ──▶ Supabase (auth, memory,
                                                │▲                                   tool log, knowledge base)
                                     tool calls ▼│ results
                                      FastAPI OSC Bridge (bridge/)
                                                │▲  OSC/UDP 9002 ▶ · ◀ feedback UDP 9000
                                                ▼│
                              Ableton Live 12 + MusaixPROOSC / Max for Live
```

Alic3X is a **Next.js app with an [eve](https://vercel.com/docs/eve) agent** in `apps/alic3x`. `withEve()` in `next.config.ts` mounts the agent at `/eve/v1/*` on the same origin; on Vercel the app and agent deploy as one project. The Musaix landing page at the repo root is separate and unchanged.

| Box in the diagram             | Where it lives                                                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alic3X Voice Console           | `apps/alic3x/components/console.tsx` (transcript, mode selector, tool feed; `useEveAgent` + `@elevenlabs/react`), sign-in at `app/login`                                                                                                          |
| Musaix Backend / Tool Brain    | The eve agent in `apps/alic3x/agent/`: `instructions.md` (persona and rules), `tools/*.ts` (one file per Ableton action), `instructions/memory.ts` (loads memory), `channels/eve.ts` (who may call it), `agent.ts` (model, `defaultTools: false`) |
| ElevenLabs Voice Interface     | `@elevenlabs/react` in the console + webhook `app/api/elevenlabs-tool/route.ts`, which posts the utterance into the console's eve session                                                                                                         |
| Vercel AI Gateway / OpenRouter | `agent/lib/model.ts`: `CHAT_PROVIDER=gateway` (default) or `openrouter`                                                                                                                                                                           |
| Supabase                       | Auth: magic-link sign-in, verified in `agent/channels/eve.ts` and `lib/auth.server.ts`. Data: `supabase/migrations/20261016000000_alic3x.sql`                                                                                                     |
| Knowledge Base                 | `alic3x_kb_chunks` + `alic3x_search_kb()` (Postgres full-text), via the `search_knowledge` tool                                                                                                                                                   |
| FastAPI OSC Bridge             | `bridge/` (Python)                                                                                                                                                                                                                                |

## How a turn works

1. **Text:** the console sends the message with `useEveAgent`, adding the current mode as an `x-alic3x-mode` header.
   **Voice:** the console opens the eve session first and passes its ID to ElevenLabs as the `session_id` dynamic variable. ElevenLabs calls the `musaix_brain` server tool, and the webhook posts Sterling's words into that same eve session and returns the reply for ElevenLabs to speak. Because both paths use one session, the console's transcript and tool feed show voice turns live.
2. eve's channel auth (`agent/channels/eve.ts`) accepts a signed-in, allow-listed Supabase user or the webhook's internal secret, and records the mode on the turn.
3. The model runs with `instructions.md`, Sterling's memories from Supabase, and the Ableton tools. `defaultTools: false` means it has **no** shell, file or web tools.
4. Each Ableton tool checks the turn's mode, then sends a `{type, args}` command to the FastAPI bridge, which validates it again (Pydantic), queues it (8 Hz) and sends it to Live. `panic` skips the queue and drops everything still pending. Every call is logged to Supabase.
5. eve keeps the session durably, so the conversation survives restarts and redeploys. Vercel's **Agent Runs** view shows each run's trace.

### Modes

| Mode    | Ableton tools (all modes also get `panic`, `search_knowledge`, `remember`)             |
| ------- | -------------------------------------------------------------------------------------- |
| Produce | all of them: state, play/stop, tempo, scenes, clips, volume, mute, solo, device params |
| Mix     | state, play/stop, volume, mute, solo, device params                                    |
| Perform | state, play/stop, tempo, scenes, clips, mute                                           |
| Chat    | none                                                                                   |

To add a tool: add `apps/alic3x/agent/tools/<name>.ts`, list its modes in `agent/lib/modes.ts`, and add the command to `bridge/musaix_bridge/commands.py`. Both sides validate, so a tool that exists on only one side fails closed.

## Setup

### 1. Vercel project

In Vercel: **Add New → Project → Import** `Squirrelcloud/musaix`, set **Root Directory** to `apps/alic3x`, and set the Node.js version to **24.x** (eve requires it). Vercel detects Next.js; leave the build settings at their defaults. The eve agent deploys inside the same project.

### Environment variables

| Variable                                                    | Needed for           | Notes                                                                                          |
| ----------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sign-in              | Required in production. Without them, production refuses all access.                           |
| `ALIC3X_ALLOWED_EMAILS`                                     | Sign-in              | Comma-separated emails allowed in. An empty list lets **no one** in.                           |
| `CHAT_PROVIDER`                                             | Model                | `gateway` (default) or `openrouter`                                                            |
| `AI_GATEWAY_API_KEY`                                        | Model (gateway)      | Not needed on Vercel, where the gateway authenticates via OIDC. Needed for local runs.         |
| `OPENROUTER_API_KEY`                                        | Model (openrouter)   | Required when `CHAT_PROVIDER=openrouter`                                                       |
| `ALIC3X_MODEL`                                              | Model                | Defaults to `anthropic/claude-sonnet-4.5`; same `provider/model` slug format on both providers |
| `ALIC3X_MODEL_CONTEXT_TOKENS`                               | Model (optional)     | Defaults to 200000; set it to your model's context window                                      |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`                 | Memory, KB, tool log | Server-only. Without them the agent still runs, without memory or logs.                        |
| `OSC_BRIDGE_URL`, `OSC_BRIDGE_TOKEN`                        | Ableton control      | A public URL that reaches the bridge (see step 4)                                              |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`                 | Voice                | If unset, the console runs text-only                                                           |
| `ELEVENLABS_TOOL_SECRET`                                    | Voice                | Random string; ElevenLabs sends it to the webhook as `x-alic3x-secret`                         |
| `ALIC3X_INTERNAL_SECRET`                                    | Voice                | Random string; the webhook uses it to post into eve                                            |

The app doesn't use a public app-URL variable: OAuth callbacks are derived from the request, and Supabase's redirect URL is set in the Supabase dashboard.

Local development: `cd apps/alic3x && npm install && npm run dev` (Node 24). It starts Next.js and the eve dev server together. Without Supabase Auth, local requests are admitted by eve's `localDev()` helper, which never applies in production.

### 2. Supabase

**Auth:** keep the Email provider on, set **Site URL** to your Alic3X URL, and add `https://<your-app>/auth/callback` to the redirect URLs. Sign-in is by magic link.

**Data:** run `supabase/migrations/20261016000000_alic3x.sql` (`supabase db push`, or paste it into the SQL editor). RLS is on with no policies: only the server-side service-role key can read or write these tables. To load project docs into the knowledge base, insert chunks of a few hundred words each into `alic3x_kb_chunks (source, title, content)`.

### 3. ElevenLabs agent

Create a Conversational AI agent and set:

- **System prompt:** "You are the voice of Alic3X. For every request from Sterling, call `musaix_brain` with his words, then say its `reply` exactly. Never invent actions or results yourself."
- **Dynamic variables:** `session_id`, `mode` (the console fills these in when it connects).
- **Server tool** `musaix_brain`: webhook, `POST https://<your-app>/api/elevenlabs-tool`
  - header `x-alic3x-secret`: the value of `ELEVENLABS_TOOL_SECRET`
  - body: `utterance` (string, LLM-filled: "Sterling's request, verbatim"), `session_id` = `{{session_id}}`, `mode` = `{{mode}}`
  - response timeout: 20 s or more (a turn can take several model↔tool round trips)
- Make the agent private (signed URLs only). The browser never sees your API key.

### 4. Bridge (on the machine running Ableton)

See [`bridge/README.md`](../bridge/README.md). In short: install the requirements, start the bridge with `OSC_BRIDGE_TOKEN` set, expose port 8765 with Cloudflare Tunnel or Tailscale Funnel so the deployed agent can reach it, and set `OSC_BRIDGE_URL` to that public URL.

> **Check the wire format.** The bridge defaults to an OSC message at `/musaix/command` whose single argument is the JSON command (`BRIDGE_WIRE=osc`). `BRIDGE_WIRE=json` sends the raw JSON as the UDP datagram instead. Match whichever one your MusaixPROOSC Remote Script build expects. State feedback is accepted in either form on UDP 9000; any address ending in `state` or `snapshot` counts as a state snapshot.

## Security notes

- eve's routes fail closed in production. Only an allow-listed Supabase user or the webhook's internal secret gets in; everything else gets a 401.
- The agent has no shell, file or web tools (`defaultTools: false`). Its sandbox (required by eve) is the in-process just-bash provider and is never used.
- The ElevenLabs webhook is protected by `ELEVENLABS_TOOL_SECRET` and only accepts well-formed eve session IDs. Anyone holding that secret can post into any session, so keep it in ElevenLabs only.
- The bridge requires `X-Bridge-Token` on everything except `/health`. Never expose it without a token.
- Commands are validated twice (eve tool schemas, bridge Pydantic) and rate-limited. Unknown commands never reach Live.
