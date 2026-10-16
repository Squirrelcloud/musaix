import { z } from "zod";
import { requireUser } from "@/lib/auth.server";
import { askBrain, SessionError } from "@/lib/alic3x/service.server";
import { MODES } from "@/lib/alic3x/tools";

// A turn can take several model↔tool round trips.
export const maxDuration = 60;

const Body = z.object({
  sessionId: z.uuid(),
  mode: z.enum(MODES),
  text: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request) {
  const userId = await requireUser();
  if (userId instanceof Response) return userId;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid body" }, { status: 400 });

  try {
    return Response.json(await askBrain({ ...parsed.data, userId, channel: "text" }));
  } catch (err) {
    if (err instanceof SessionError) return Response.json({ error: err.message }, { status: 404 });
    console.error("[alic3x] ask:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Brain request failed" },
      { status: 502 },
    );
  }
}
