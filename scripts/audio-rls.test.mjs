import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Real PostgreSQL RLS evaluation in PGlite; only Supabase infrastructure is
// stubbed. Live Supabase tests are still required before production acceptance.
test("audio tables deny cross-user select, update, delete and forged ownership", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create schema storage;
      create table storage.buckets (
        id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
      );
      create table storage.objects (bucket_id text, name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql immutable as
        $$ select string_to_array($1, '/') $$;
      grant usage on schema auth, storage, public to authenticated;
      grant select, insert, update, delete on storage.objects to authenticated;
    `);
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/20261022020000_musaix_audio_evidence.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(new URL("../supabase/tests/audio_rls.sql", import.meta.url), "utf8"),
    );
  } finally {
    await db.close();
  }
});
