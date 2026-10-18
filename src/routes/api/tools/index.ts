import { createFileRoute } from "@tanstack/react-router";
import { checkBearer } from "@/lib/alic3x/auth.server";
import { toolManifest } from "@/lib/alic3x/tools";

/** Tool manifest with JSON Schema parameters, ready to hand to an LLM. */
export const Route = createFileRoute("/api/tools/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = checkBearer(request, "ALIC3X_API_TOKEN");
        if (denied) return denied;
        return Response.json({ tools: toolManifest() });
      },
    },
  },
});
