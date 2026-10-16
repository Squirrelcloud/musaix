import { defineDynamic, defineInstructions } from "eve/instructions";
import { memories } from "../lib/supabase";

/** Long-term memory from Supabase, loaded once when a session starts. */
export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => {
      const userId = ctx.session.auth.initiator?.principalId;
      if (!userId) return null;
      const items = await memories(userId).catch(() => []);
      if (!items.length) return null;
      return defineInstructions({
        role: "user",
        content: "What you remember about Sterling and the project:\n- " + items.join("\n- "),
      });
    },
  },
});
