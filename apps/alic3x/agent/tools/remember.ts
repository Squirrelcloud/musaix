import { defineTool } from "eve/tools";
import { z } from "zod";
import { remember } from "../lib/supabase";

export default defineTool({
  description:
    "Save a durable fact or preference about Sterling or the project to long-term memory.",
  inputSchema: z.object({ content: z.string().min(3).max(1000) }),
  label: { start: () => "Remember this" },
  async execute(input, ctx) {
    const userId = ctx.session.auth.initiator?.principalId ?? ctx.session.auth.current?.principalId;
    if (!userId) throw new Error("No signed-in user to remember this for.");
    await remember(userId, input.content);
    return { saved: true };
  },
});
