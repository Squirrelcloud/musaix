import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { MODES } from "./tools";

/**
 * Console → backend. Every call is auth-gated and the session is checked
 * against the caller, so the brain only ever acts for its owner.
 */

export const startAlic3xSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ mode: z.enum(MODES) }))
  .handler(async ({ data, context }) => {
    const { startSession, elevenLabsSignedUrl } = await import("./service.server");
    const sessionId = await startSession(context.userId, data.mode);
    // Voice is optional: without ElevenLabs config the console runs text-only.
    const signedUrl = await elevenLabsSignedUrl().catch((err) => {
      console.error("[alic3x] signed URL:", err);
      return null;
    });
    return { sessionId, signedUrl };
  });

export const askAlic3x = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      sessionId: z.uuid(),
      mode: z.enum(MODES),
      text: z.string().trim().min(1).max(4000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { askBrain } = await import("./service.server");
    return askBrain({ ...data, userId: context.userId, channel: "text" });
  });

export const getBridgeStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { createBridge } = await import("./adapters.server");
    try {
      return { online: true as const, status: await createBridge().status() };
    } catch (err) {
      return { online: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

/** Tool Feed for voice turns, which run server-side via the ElevenLabs webhook. */
export const listAlic3xToolEvents = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ sessionId: z.uuid() }))
  .handler(async ({ data, context }) => {
    const { createStore } = await import("./adapters.server");
    const store = createStore();
    if ((await store.sessionOwner(data.sessionId)) !== context.userId) return [];
    return store.toolCalls(data.sessionId, 50);
  });
