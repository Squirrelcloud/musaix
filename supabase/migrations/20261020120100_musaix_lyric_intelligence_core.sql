-- Musaix OS v1.0 — Lyric Intelligence core (ColdCase / Musaix)
--
-- Target: Supabase project xexzplnyzblflucfvbwt. This file is for the Supabase
-- CLI / MCP `apply_migration`. It lives outside ../../migrations on purpose: the
-- app's own migrator applies that folder to Neon/PGLite and must not see it.
--
-- ADDITIVE ONLY. The live project already has `beats`, `personas`,
-- `lyric_audits`, `lyric_revisions`, `model_outputs` and
-- `performance_snapshots` with different shapes from the Musaix OS blueprint,
-- so a plain `create table if not exists` would silently skip them. Instead:
--   * new tables: artists, lyrics, lyric_versions, battles
--   * existing tables gain nullable / defaulted columns (nothing renamed or
--     dropped, no existing row changes meaning)
--   * view model_rankings answers "GPT vs Grok vs local" from audit results
--
-- Access matches the existing lyric pipeline tables: RLS on, no policies, anon
-- revoked — i.e. service-role (backend / agents) only. Add owner-scoped
-- policies when an end-user UI needs direct access.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.musaix_lyric_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Artist memory
-- ---------------------------------------------------------------------------
create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.personas
  add column if not exists artist_id uuid references public.artists (id) on delete cascade,
  add column if not exists vocal_profile text,
  add column if not exists style_keywords text[] not null default '{}',
  add column if not exists cadence_bias jsonb not null default '{}'::jsonb;

create index if not exists personas_artist_id_idx on public.personas (artist_id);

-- ---------------------------------------------------------------------------
-- Model outputs (AI routing & benchmarking)
-- ---------------------------------------------------------------------------
alter table public.model_outputs
  add column if not exists provider text,
  add column if not exists cost_usd numeric(10, 6),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'model_outputs_provider_check'
      and conrelid = 'public.model_outputs'::regclass
  ) then
    alter table public.model_outputs
      add constraint model_outputs_provider_check
      check (provider is null or provider in ('openai', 'grok', 'anthropic', 'google', 'local', 'other'));
  end if;
end;
$$;

create index if not exists model_outputs_provider_model_idx
  on public.model_outputs (provider, model);

-- ---------------------------------------------------------------------------
-- Lyrics & versions
-- ---------------------------------------------------------------------------
create table if not exists public.lyrics (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references public.artists (id) on delete set null,
  beat_id uuid references public.beats (id) on delete set null,
  title text not null,
  current_version integer not null default 1 check (current_version >= 1),
  status text not null default 'draft'
    check (status in ('draft', 'audited', 'approved', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lyrics_artist_id_idx on public.lyrics (artist_id);
create index if not exists lyrics_beat_id_idx on public.lyrics (beat_id);

create table if not exists public.lyric_versions (
  id uuid primary key default gen_random_uuid(),
  lyric_id uuid not null references public.lyrics (id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  content text not null,
  -- md5 of whitespace/case-normalised content: exact-duplicate catalog check
  -- for the "no accidental recycling" rule, without scanning full text.
  content_hash text generated always as (
    md5(lower(regexp_replace(btrim(content), '\s+', ' ', 'g')))
  ) stored,
  model_output_id uuid references public.model_outputs (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (lyric_id, version_number)
);

create index if not exists lyric_versions_content_hash_idx on public.lyric_versions (content_hash);
create index if not exists lyric_versions_model_output_id_idx on public.lyric_versions (model_output_id);

-- ---------------------------------------------------------------------------
-- Lyric audits — extend the existing table with the Musaix OS audit card.
-- Existing *_pct / *_score columns stay the source for repeated nouns/verbs/
-- adjectives, lexical diversity, internal and multisyllabic rhyme.
-- ---------------------------------------------------------------------------
alter table public.lyric_audits
  add column if not exists lyric_version_id uuid references public.lyric_versions (id) on delete cascade,
  add column if not exists repeated_metaphors_count integer not null default 0 check (repeated_metaphors_count >= 0),
  add column if not exists repeated_images_count integer not null default 0 check (repeated_images_count >= 0),
  add column if not exists repeated_rhyme_families_count integer not null default 0 check (repeated_rhyme_families_count >= 0),
  add column if not exists repeated_cadence_count integer not null default 0 check (repeated_cadence_count >= 0),
  add column if not exists originality_score numeric(5, 2) check (originality_score between 0 and 100),
  add column if not exists ai_detection_risk text
    check (ai_detection_risk in ('very_low', 'low', 'medium', 'high')),
  add column if not exists recycled_phrases jsonb not null default '[]'::jsonb,
  add column if not exists audit_passed boolean not null default false;

create index if not exists lyric_audits_lyric_version_id_idx on public.lyric_audits (lyric_version_id);
create index if not exists lyric_audits_beat_id_idx on public.lyric_audits (beat_id);

-- ---------------------------------------------------------------------------
-- Performance (YouTube / Spotify / BeatStars)
-- ---------------------------------------------------------------------------
alter table public.performance_snapshots
  add column if not exists lyric_id uuid references public.lyrics (id) on delete cascade,
  add column if not exists external_id text,
  add column if not exists watch_time_minutes numeric(12, 2),
  add column if not exists ctr numeric(5, 2) check (ctr between 0 and 100),
  add column if not exists retention_rate numeric(5, 2) check (retention_rate between 0 and 100);

create index if not exists performance_snapshots_lyric_id_idx on public.performance_snapshots (lyric_id);
create index if not exists performance_snapshots_beat_id_idx on public.performance_snapshots (beat_id);

-- ---------------------------------------------------------------------------
-- Battle arena
-- ---------------------------------------------------------------------------
create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  challenger_model text not null,
  defender_model text not null,
  topic text not null,
  winner text check (winner in ('challenger', 'defender', 'draw')),
  rounds_data jsonb not null default '[]'::jsonb,
  elo_delta integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists battles_challenger_model_idx on public.battles (challenger_model);
create index if not exists battles_defender_model_idx on public.battles (defender_model);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists artists_touch_updated_at on public.artists;
create trigger artists_touch_updated_at
  before update on public.artists
  for each row execute function public.musaix_lyric_touch_updated_at();

drop trigger if exists lyrics_touch_updated_at on public.lyrics;
create trigger lyrics_touch_updated_at
  before update on public.lyrics
  for each row execute function public.musaix_lyric_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Model rankings: which model writes the most original, passing verses.
-- Provider/model come from the linked model_output when present, else the
-- audit's own `model` text (legacy rows).
-- ---------------------------------------------------------------------------
create or replace view public.model_rankings
with (security_invoker = true)
as
select
  coalesce(mo.provider, 'unknown') as provider,
  coalesce(mo.model, la.model) as model,
  count(*) as audits,
  count(*) filter (where la.audit_passed) as audits_passed,
  round(100.0 * count(*) filter (where la.audit_passed) / count(*), 2) as pass_rate,
  round(avg(la.lexical_diversity), 2) as avg_lexical_diversity,
  round(avg(la.multisyllabic_score), 2) as avg_multisyllabic_score,
  round(avg(la.originality_score), 2) as avg_originality_score,
  round(avg(
    la.repeated_metaphors_count + la.repeated_images_count
    + la.repeated_rhyme_families_count + la.repeated_cadence_count
  ), 2) as avg_recycling_hits,
  max(la.created_at) as last_audit_at
from public.lyric_audits la
left join public.lyric_versions lv on lv.id = la.lyric_version_id
left join public.model_outputs mo on mo.id = lv.model_output_id
group by 1, 2;

-- ---------------------------------------------------------------------------
-- Access: service role only, like the existing lyric pipeline tables.
-- ---------------------------------------------------------------------------
alter table public.artists enable row level security;
alter table public.lyrics enable row level security;
alter table public.lyric_versions enable row level security;
alter table public.battles enable row level security;

revoke all on public.artists, public.lyrics, public.lyric_versions, public.battles,
  public.model_rankings from anon, authenticated;
revoke all on function public.musaix_lyric_touch_updated_at() from public, anon, authenticated;
