# Musaix evidence loop — implementation plan

## Audit (main: 1ada362)

Canonical repository: Squirrelcloud/musaix; existing Vercel project: musaix.
Root package is TanStack Start/Vite, React 19, Tailwind 4, Zod 4 and Radix UI.
`src/routes/index.tsx` renders the existing landing/pad experience. Authentication
is Better Auth in `src/lib/auth/`; persistence is Neon/PGLite in `src/lib/db.ts`.
Neither is a Supabase user session. Never map that identity to auth.uid() by
accepting a browser-supplied owner ID. Existing Supabase migrations are for lyric
intelligence, not audio reports, and are deliberately outside the app migrator.
There is no audio-analysis service or evidence workspace on main.

Open PR #2 adds a separate Next.js Alic3X console and Ableton bridge; #4 adds an
OSC tool queue. Neither is the requested canonical evidence workflow. Do not
merge them wholesale. No repository instructions or contributing guide found.

## Ordered plan

1. Add a bounded Python measurement/persistence slice and owner-only schema,
   without changing the working app, deploying unverified services, or introducing
   a second dashboard. Test genuine signal analysis twice, strict serialization,
   health, authentication failure, and invalid input. This PR implements this step.
2. Migrate the canonical root application to patched Next.js **15**, preserving
   existing routes/components and the pad. Replace Better Auth with Supabase Auth;
   explicitly migrate existing identity/data instead of silently treating users as
   interchangeable. Keep one root app, one project, one dashboard.
3. Wire `/analyze` to server-authenticated upload, private storage, track creation,
   internal FastAPI request, strict report validation, persistence and reload.
   Add progress, playback/waveform, retries, saved history and mobile layouts using
   near-black glass, #ee2b5b and #8b5cf6. Do not introduce unrelated tools/pages.
4. Integrate Eve + AI SDK/Gateway using the Python template as a reference only.
   Five owner-scoped tools: analyze_track, get_saved_report, compare_reports,
   explain_measurement, summarize_track. Resolve identity from verified runtime
   context, never model tool arguments. Return saved fields only; controlled UI
   must distinguish measurements, interpretation, confidence and missing data.
5. Configure a single Vercel Services deployment with bindings from the Next.js
   and Eve services to FastAPI; no public rewrite to FastAPI. A binding is not
   authorization: continue verifying the Supabase user token in the backend.
6. Run two-user live RLS tests, authenticated WAV/MP3 end-to-end browser tests,
   deterministic fixture tests, preview acceptance on desktop/mobile, then require
   checks and PR review through GitHub branch protection before production merge.
   A workflow file alone does NOT prevent direct pushes.

## First slice and boundaries

`services/analysis` provides GET /health, POST /analyze and GET /analysis/{id}.
POST accepts a track UUID, NOT an arbitrary URL. It uses the caller's verified
Supabase token (no service role) to resolve the owned private object, measures it,
upserts the report and reads it back before responding. Retrying the same track
replaces its one report; concurrent requests can repeat computation, not create
multiple reports. No in-memory report store or mock metrics.

Limits: 10 MiB encoded, 180 seconds, WAV/MP3 only, decoded sample rate <=96 kHz,
mono/stereo. Input inspection precedes decoding. Analyzed features use a 22,050 Hz
mono resample; original duration/rate/channels are reported separately. Tempo is
an estimator, not verified ground truth. Key/mode/confidence and integrated LUFS
are explicitly unsupported/null in v1; RMS and dBFS are not LUFS. A silence input
has undefined dBFS and unavailable tempo, not invented zeros for those fields.

This is NOT the completed vertical product slice: it intentionally does not
switch the production framework or route traffic to an unaudited backend.
Supabase migration is supplied, not automatically applied. Production auth,
upload/cleanup orchestration, Eve, UI, deployment, branch rules and real two-user
acceptance remain outstanding. Do not declare production-ready from unit tests.

## Backend local checks

Use Python 3.12: `uv venv --python 3.12 services/analysis/.venv`, then install
`services/analysis/requirements-dev.lock` and run
`services/analysis/.venv/bin/python -m pytest services/analysis/tests`.

Runtime server-only settings: SUPABASE_URL and SUPABASE_ANON_KEY (publishable
project key, never service-role), plus the caller's Authorization header.
Use `uvicorn main:app` from services/analysis. Do not log access headers, storage
responses, filenames, user content, or signed URLs. The service only logs event
codes and elapsed milliseconds. Keep uvicorn access logs off when deploying.

Apply the audio migration in the existing Supabase project, then run
`supabase/tests/audio_rls.sql` in a disposable/local Supabase database. It rolls
back its fixture users/data. Never substitute these tests for production acceptance.

## Verification record

- Genuine fixture analysis repeated with identical report fields except elapsed time.
- HTTP save/reload tested with a simulated Supabase transport, not a live project.
- Two-user PostgreSQL table/storage RLS denial test runs locally through PGlite
  with stub Supabase infrastructure; live Supabase acceptance remains required.
- Existing app typecheck passes. Existing full test suite has eight unrelated
  share-card/page-metadata failures, independently reproduced on unchanged main.
- No production settings, environment variables, database or routing changed.
- Install reported four high-severity existing npm dependency vulnerabilities;
  a dependency/security audit remains necessary before production acceptance.

## CI activation handoff

The publishing connection cannot create GitHub Actions workflow files. Copy
`docs/audio-evidence.workflow.yml` to `.github/workflows/audio-evidence.yml` in a
separate maintainer-authored change. Until then the supplied CI is NOT active.
Require both jobs in a main-branch ruleset, require PR review and disallow bypass
for direct pushes before allowing a production release. The agent has not
changed repository protection settings.
