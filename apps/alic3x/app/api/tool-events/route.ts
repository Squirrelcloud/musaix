import { requireUser } from "@/lib/auth.server";
import { createStore } from "@/lib/alic3x/adapters.server";

/** Tool Feed for voice turns, which run server-side via the ElevenLabs webhook. */
export async function GET(request: Request) {
  const userId = await requireUser();
  if (userId instanceof Response) return userId;
  const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
  const store = createStore();
  if (!sessionId || (await store.sessionOwner(sessionId)) !== userId) return Response.json([]);
  return Response.json(await store.toolCalls(sessionId, 50));
}
