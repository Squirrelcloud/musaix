import { timingSafeEqual } from "node:crypto";

/**
 * Bearer-token check for the machine-to-machine Alic3X endpoints. Fails closed:
 * if the env var is unset the endpoint answers 503 instead of running open.
 *
 *   BRIDGE_TOKEN       — shared with the local OSC bridge (/api/bridge/*)
 *   ALIC3X_API_TOKEN   — for callers of the tool API (/api/tools/*)
 */
export function checkBearer(
  request: Request,
  envVar: "BRIDGE_TOKEN" | "ALIC3X_API_TOKEN",
): Response | null {
  const expected = process.env[envVar]?.trim();
  if (!expected) {
    return Response.json({ error: `${envVar} is not configured` }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
