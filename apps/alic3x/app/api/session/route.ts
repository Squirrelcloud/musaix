import { z } from "zod";
import { requireUser } from "@/lib/auth.server";
import { elevenLabsSignedUrl, startSession } from "@/lib/alic3x/service.server";
import { MODES } from "@/lib/alic3x/tools";

const Body = z.object({ mode: z.enum(MODES) });

export async function POST(request: Request) {
  const userId = await requireUser();
  if (userId instanceof Response) return userId;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid body" }, { status: 400 });

  const sessionId = await startSession(userId, parsed.data.mode);
  // Voice is optional: without ElevenLabs config the console runs text-only.
  const signedUrl = await elevenLabsSignedUrl().catch((err) => {
    console.error("[alic3x] signed URL:", err);
    return null;
  });
  return Response.json({ sessionId, signedUrl });
}
