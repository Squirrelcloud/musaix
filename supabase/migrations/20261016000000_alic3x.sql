-- Alic3X Pro — Supabase schema (tool-call log, long-term memory, knowledge
-- base). Sign-in uses Supabase Auth; no tables needed for it.
-- Apply with `supabase db push` or paste into the SQL editor. The Musaix backend talks to these tables with the service-role key
-- (server-only), so RLS is enabled with no anon/authenticated policies: the
-- browser never reads them directly.
--
-- user_id is the Supabase Auth user id (auth.users.id), stored as text.

-- Sessions and transcripts live in eve (durable workflow state). Supabase keeps
-- what should outlive a session: a tool-call log, memory and the knowledge base.

create table if not exists public.alic3x_tool_calls (
  id bigint generated always as identity primary key,
  session_id text not null, -- eve session ID (wrun_…)
  tool text not null,
  args jsonb,
  ok boolean not null,
  result jsonb,
  error text,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists alic3x_tool_calls_session_idx on public.alic3x_tool_calls (session_id, created_at desc);

create table if not exists public.alic3x_memories (
  id bigint generated always as identity primary key,
  user_id text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists alic3x_memories_user_idx on public.alic3x_memories (user_id, created_at desc);

-- Knowledge base: project docs chunked into rows. Full-text search keeps RAG
-- dependency-free; add a pgvector column later if semantic recall is needed.
create table if not exists public.alic3x_kb_chunks (
  id bigint generated always as identity primary key,
  source text not null,
  title text not null,
  content text not null,
  fts tsvector generated always as (to_tsvector('english', title || ' ' || content)) stored,
  created_at timestamptz not null default now()
);
create index if not exists alic3x_kb_chunks_fts_idx on public.alic3x_kb_chunks using gin (fts);

create or replace function public.alic3x_search_kb(q text, match_count int default 5)
returns table (title text, content text)
language sql stable
set search_path = public
as $$
  -- OR the query's lexemes so conversational input ("make the drums punchier")
  -- still hits; rank does the rest.
  with tsq as (
    select nullif(
      array_to_string(array(select quote_literal(lexeme) from unnest(to_tsvector('english', q))), ' | '),
      ''
    ) as text
  )
  select c.title, c.content
  from public.alic3x_kb_chunks c, tsq
  where tsq.text is not null and c.fts @@ to_tsquery('english', tsq.text)
  order by ts_rank(c.fts, to_tsquery('english', tsq.text)) desc
  limit greatest(1, least(match_count, 20));
$$;

alter table public.alic3x_tool_calls enable row level security;
alter table public.alic3x_memories enable row level security;
alter table public.alic3x_kb_chunks enable row level security;

revoke execute on function public.alic3x_search_kb(text, int) from public, anon, authenticated;
