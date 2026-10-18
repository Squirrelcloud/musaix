import { createFileRoute } from "@tanstack/react-router";
import { checkBearer, readJson } from "@/lib/alic3x/auth.server";
import { completeCommand, heartbeat } from "@/lib/alic3x/queue.server";

/** Bridge reports `{ id, ok, result?, error?, bridge_id?, state? }` for a claimed command. */
export const Route = createFileRoute("/api/bridge/result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = checkBearer(request, "BRIDGE_TOKEN");
        if (denied) return denied;
        const body = await readJson(request);
        if (typeof body?.id !== "string" || typeof body.ok !== "boolean") {
          return Response.json({ error: "id and ok required" }, { status: 400 });
        }
        const error = typeof body.error === "string" ? body.error : null;
        const updated = await completeCommand(body.id, body.ok, body.result, error);
        if (typeof body.bridge_id === "string" && body.bridge_id) {
          await heartbeat(body.bridge_id, body.state);
        }
        if (!updated) {
          return Response.json({ error: "command not claimed" }, { status: 409 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
