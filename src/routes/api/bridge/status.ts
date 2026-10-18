import { createFileRoute } from "@tanstack/react-router";
import { checkBearer } from "@/lib/alic3x/auth.server";
import { bridgeStatus } from "@/lib/alic3x/queue.server";

/** Which bridges are online and the last Live state each reported. */
export const Route = createFileRoute("/api/bridge/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = checkBearer(request, "ALIC3X_API_TOKEN");
        if (denied) return denied;
        return Response.json({ bridges: await bridgeStatus() });
      },
    },
  },
});
