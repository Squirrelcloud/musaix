-- Additive audio evidence resources. Apply with Supabase, NOT the Neon migrator.
begin;
create table public.musaix_tracks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  object_path text not null unique,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  check (object_path = owner_id::text || '/' || id::text || '.wav'
      or object_path = owner_id::text || '/' || id::text || '.mp3')
);
create table public.musaix_audio_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  track_id uuid not null unique,
  report jsonb not null,
  schema_version text not null check (schema_version = '1.0.0'),
  algorithm_version text not null check (algorithm_version = 'librosa-0.11.0-musaix-1'),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (track_id, owner_id) references public.musaix_tracks(id, owner_id) on delete cascade,
  check (report->>'schema_version' is not null and report->>'schema_version' = schema_version),
  check (report->>'algorithm_version' is not null and report->>'algorithm_version' = algorithm_version)
);
create table public.musaix_report_sections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  report_id uuid not null,
  section_key text not null,
  evidence jsonb not null,
  unique (report_id, section_key),
  foreign key (report_id, owner_id) references public.musaix_audio_reports(id, owner_id) on delete cascade
);

alter table public.musaix_tracks enable row level security;
alter table public.musaix_audio_reports enable row level security;
alter table public.musaix_report_sections enable row level security;
create policy audio_tracks_owner on public.musaix_tracks to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy audio_reports_owner on public.musaix_audio_reports to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy audio_sections_owner on public.musaix_report_sections to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke all on public.musaix_tracks, public.musaix_audio_reports, public.musaix_report_sections from anon;
grant select, insert, update, delete on public.musaix_tracks, public.musaix_audio_reports,
  public.musaix_report_sections to authenticated;
create index on public.musaix_tracks(owner_id, created_at desc);
create index on public.musaix_audio_reports(owner_id, created_at desc);
create index on public.musaix_report_sections(owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('musaix-audio', 'musaix-audio', false, 10485760, array['audio/wav', 'audio/x-wav', 'audio/mpeg']);
create policy musaix_audio_select on storage.objects for select to authenticated
  using (bucket_id = 'musaix-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy musaix_audio_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'musaix-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy musaix_audio_update on storage.objects for update to authenticated
  using (bucket_id = 'musaix-audio' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'musaix-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy musaix_audio_delete on storage.objects for delete to authenticated
  using (bucket_id = 'musaix-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
