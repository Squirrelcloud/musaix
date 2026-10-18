import { createFileRoute } from "@tanstack/react-router";
import { checkBearer, readJson } from "@/lib/alic3x/auth.server";
import { enqueue, expireIfQueued, getCommand, waitFor } from "@/lib/alic3x/queue.server";
import { parseToolCall } from "@/lib/alic3x/tools";

const DEFAULT_TTL_MS = 10_000;
const MAX_WAIT_MS = 25_000;

/**
 * Run one tool against Live: `{ tool, args?, wait_ms? }`.
 *
 * Validates against the registry, queues it for the bridge, and waits for the
 * bridge's result. 200 with the result on success, 502 if Live reported a
 * failure, 504 if no result arrived in time: a never-claimed command is expired
 * so it can never fire late; a claimed one reports that its outcome is unknown.
 */
export const Route = createFileRoute("/api/tools/invoke")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = checkBearer(request, "ALIC3X_API_TOKEN");
        if (denied) return denied;
        const body = await readJson(request);
        if (!body) return Response.json({ error: "JSON body required" }, { status: 400 });

        const call = parseToolCall(body.tool, body.args);
        if (!call.ok) return Response.json({ error: call.error }, { status: 400 });

        const waitMs = Math.min(
          MAX_WAIT_MS,
          Math.max(1_000, typeof body.wait_ms === "number" ? body.wait_ms : 8_000),
        );
        const id = await enqueue(call.tool, call.args, Math.min(DEFAULT_TTL_MS, waitMs));
        const finished = await waitFor(async () => {
          const row = await getCommand(id);
          return row && (row.status === "done" || row.status === "failed") ? row : null;
        }, waitMs);

        if (!finished) {
          await expireIfQueued(id);
          const row = await getCommand(id);
          const status = row?.status ?? "expired";
          // "claimed" means the bridge took it and may have run it in Live:
          // the outcome is unknown, so callers must not blindly retry.
          const error =
            status === "claimed"
              ? "bridge took the command but its result has not arrived; it may have run, do not retry blindly"
              : "no bridge picked up the command; it was expired and will not run";
          return Response.json({ id, status, error }, { status: 504 });
        }
        return Response.json(
          { id, status: finished.status, result: finished.result, error: finished.error },
          { status: finished.status === "done" ? 200 : 502 },
        );
      },
    },
  },
});
