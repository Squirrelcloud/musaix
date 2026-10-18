import { createFileRoute } from "@tanstack/react-router";
import { checkBearer, readJson } from "@/lib/alic3x/auth.server";
import { claimNext, heartbeat, waitFor } from "@/lib/alic3x/queue.server";

const MAX_WAIT_MS = 25_000;

/**
 * Bridge long-poll. The bridge posts `{ bridge_id, state?, wait_ms? }`; the
 * request doubles as a heartbeat and returns as soon as a command is claimed,
 * or `{ command: null }` after `wait_ms` so the bridge re-polls.
 */
export const Route = createFileRoute("/api/bridge/poll")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = checkBearer(request, "BRIDGE_TOKEN");
        if (denied) return denied;
        const body = await readJson(request);
        const bridgeId = typeof body?.bridge_id === "string" ? body.bridge_id.trim() : "";
        if (!bridgeId) return Response.json({ error: "bridge_id required" }, { status: 400 });
        const waitMs = Math.min(
          MAX_WAIT_MS,
          Math.max(0, typeof body?.wait_ms === "number" ? body.wait_ms : 20_000),
        );

        await heartbeat(bridgeId, body?.state);
        const command = await waitFor(() => claimNext(bridgeId), waitMs, request.signal);
        return Response.json({ command });
      },
    },
  },
});
