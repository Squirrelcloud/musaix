import { defineTool } from "eve/tools";
import { z } from "zod";
import { searchKnowledge } from "../lib/supabase";

export default defineTool({
  description: "Search Musaix project docs and notes (the knowledge base) for relevant context.",
  inputSchema: z.object({ query: z.string().min(2).max(300) }),
  label: { start: (input) => `Search docs for “${input.query}”` },
  execute: (input) => searchKnowledge(input.query, 5),
});
