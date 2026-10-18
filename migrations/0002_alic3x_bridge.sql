-- Alic3X tool queue: the backend enqueues tool calls, the local OSC bridge
-- (on the Ableton machine, behind NAT) long-polls and claims them, then posts
-- results back. Commands carry a hard expiry so a "stop" queued while the
-- bridge was offline never fires minutes later.
create table if not exists bridge_commands (
  id uuid primary key default gen_random_uuid(),
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'claimed', 'done', 'failed', 'expired')),
  result jsonb,
  error text,
  bridge_id text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz not null
);

create index if not exists bridge_commands_queued_idx
  on bridge_commands (created_at)
  where status = 'queued';

-- Last heartbeat and Live state snapshot reported by each bridge.
create table if not exists bridge_heartbeats (
  bridge_id text primary key,
  live_state jsonb,
  last_seen_at timestamptz not null default now()
);
