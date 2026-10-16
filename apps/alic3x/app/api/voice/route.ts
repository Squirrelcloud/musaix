import { requireUser } from "@/lib/auth.server";
import { elevenLabsSignedUrl } from "@/lib/elevenlabs.server";

/** Signed ElevenLabs URL for the console, or null when voice isn't configured. */
export async function POST() {
  const userId = await requireUser();
  if (userId instanceof Response) return userId;
  try {
    return Response.json({ signedUrl: await elevenLabsSignedUrl() });
  } catch (err) {
    console.error("[alic3x] signed URL:", err);
    return Response.json({ signedUrl: null });
  }
}
