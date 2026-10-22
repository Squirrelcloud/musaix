-- Run after migrations against disposable Supabase. All fixtures roll back.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/audio_rls.sql
begin;
insert into auth.users (id) values
 ('a0000000-0000-0000-0000-000000000001'),
 ('b0000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
insert into public.musaix_tracks(id, object_path) values
 ('c0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000003.wav');
insert into public.musaix_audio_reports(id, track_id, report, schema_version, algorithm_version)
values ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003',
 '{"schema_version":"1.0.0","algorithm_version":"librosa-0.11.0-musaix-1"}',
 '1.0.0', 'librosa-0.11.0-musaix-1');
insert into public.musaix_report_sections(report_id, section_key, evidence)
values ('d0000000-0000-0000-0000-000000000004', 'test', '{}');
do $$ begin
 if (select count(*) from public.musaix_tracks) <> 1 then raise exception 'Owner cannot reload track'; end if;
 if (select count(*) from public.musaix_audio_reports) <> 1 then raise exception 'Owner cannot reload report'; end if;
end $$;
insert into storage.objects(bucket_id, name) values
 ('musaix-audio', 'a0000000-0000-0000-0000-000000000001/c0000000-0000-0000-0000-000000000003.wav');
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);
do $$ declare n int; begin
 if exists(select 1 from storage.objects where bucket_id = 'musaix-audio') then raise exception 'Storage object leaked'; end if;
 delete from storage.objects where bucket_id = 'musaix-audio';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'Cross-user object delete allowed'; end if;
 if exists(select 1 from public.musaix_tracks) then raise exception 'Track leaked'; end if;
 if exists(select 1 from public.musaix_audio_reports) then raise exception 'Report leaked'; end if;
 if exists(select 1 from public.musaix_report_sections) then raise exception 'Section leaked'; end if;
 update public.musaix_audio_reports set schema_version = '1.0.0';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'Cross-user update allowed'; end if;
 delete from public.musaix_tracks;
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'Cross-user delete allowed'; end if;
 begin
   insert into public.musaix_tracks(id, owner_id, object_path) values
    ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001/e0000000-0000-0000-0000-000000000005.wav');
   raise exception 'Cross-user insert allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
