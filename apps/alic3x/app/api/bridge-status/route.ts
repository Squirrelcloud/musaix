import { requireUser } from "@/lib/auth.server";
import { createBridge } from "@/lib/alic3x/adapters.server";

export async function GET() {
  const userId = await requireUser();
  if (userId instanceof Response) return userId;
  try {
    return Response.json({ online: true, status: await createBridge().status() });
  } catch (err) {
    return Response.json({
      online: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
