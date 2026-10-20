-- Server-only table grants + duplicate index cleanup (Supabase project xexzplnyzblflucfvbwt).
--
-- kv_store_15fa71b9_key_idx1 is an exact duplicate of kv_store_15fa71b9_key_idx.
-- The listed tables already have RLS on with no policies, so clients get no rows;
-- revoking the grants also hides them from the signed-in GraphQL schema.
-- (coach_logs and model_logs were dropped by dedup_drop_empty_duplicates on 2026-10-18.)
--
-- Safe to re-run.

drop index if exists public.kv_store_15fa71b9_key_idx1;

revoke all on table public.audit_events, public.dashboard_state, public.gpu_nodes,
                    public.lyric_audits, public.model_outputs, public.persona_jobs,
                    public.queue_tasks
  from anon, authenticated;
