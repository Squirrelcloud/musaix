"""Private binding target. All data access uses the caller's Supabase RLS context."""
import logging
import os
from urllib.parse import quote
from uuid import UUID
import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict
from starlette.concurrency import run_in_threadpool
from contract import Report
from measure import MAX_BYTES, analyze

app = FastAPI(title="Musaix audio evidence", docs_url=None, redoc_url=None, openapi_url=None)
logger = logging.getLogger("musaix.analysis")
# HTTP client debug logs can contain private storage paths; never enable them.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    track_id: UUID


class SavedReport(BaseModel):
    id: UUID
    track_id: UUID
    report: Report


async def user_client(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Supabase authentication required")
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise HTTPException(503, "Analysis storage is not configured")
    async with httpx.AsyncClient(base_url=url.rstrip("/"), timeout=30,
                                headers={"apikey": key, "Authorization": authorization}) as client:
        try:
            verified = await client.get("/auth/v1/user")
            if verified.status_code != 200:
                raise HTTPException(401, "Invalid or expired session")
            owner = str(UUID(verified.json()["id"]))
            yield client, owner
        except httpx.HTTPError:
            logger.warning('{"event":"analysis_dependency_failure"}')
            raise HTTPException(503, "Analysis dependency unavailable; retry later") from None


def checked(response):
    if response.status_code >= 400:
        # Never return/log Supabase error bodies or private object references.
        logger.warning('{"event":"analysis_storage_failure"}')
        raise HTTPException(502, "Report storage failed; retry the same track")
    return response.json()


@app.get("/health")
def health():
    return {"status": "ok", "schema_version": "1.0.0"}


@app.get("/analysis/{report_id}", response_model=SavedReport)
async def get_report(report_id: UUID, context=Depends(user_client)):
    client, owner = context
    rows = checked(await client.get("/rest/v1/musaix_audio_reports", params={
        "id": f"eq.{report_id}", "owner_id": f"eq.{owner}", "select": "id,track_id,report"}))
    if not rows:
        raise HTTPException(404, "Report not found")
    return SavedReport.model_validate(rows[0])


@app.post("/analyze", response_model=SavedReport)
async def analyze_track(request: AnalyzeRequest, context=Depends(user_client)):
    client, owner = context
    track_id = str(request.track_id)
    rows = checked(await client.get("/rest/v1/musaix_tracks", params={
        "id": f"eq.{track_id}", "owner_id": f"eq.{owner}", "select": "id,object_path"}))
    if not rows:
        raise HTTPException(404, "Track not found")
    path = rows[0]["object_path"]
    # Defense in depth beyond RLS; UUID-only object names, never user filenames.
    if path not in {f"{owner}/{track_id}.wav", f"{owner}/{track_id}.mp3"}:
        raise HTTPException(422, "Invalid private audio reference")
    async with client.stream("GET", f"/storage/v1/object/authenticated/musaix-audio/{quote(path, safe='/')}") as response:
        if response.status_code != 200:
            raise HTTPException(502, "Audio unavailable; retry after checking upload")
        content = bytearray()
        async for chunk in response.aiter_bytes():
            content.extend(chunk)
            if len(content) > MAX_BYTES:
                raise HTTPException(413, "Maximum audio size is 10 MiB")
    try:
        report = await run_in_threadpool(analyze, bytes(content))
    except (ValueError, RuntimeError):
        logger.info('{"event":"analysis_input_rejected"}')
        raise HTTPException(422, "Unsupported or invalid audio; upload a valid WAV or MP3") from None
    payload = report.model_dump(mode="json")
    saved = checked(await client.post("/rest/v1/musaix_audio_reports",
        params={"on_conflict": "track_id", "select": "id"},
        headers={"Prefer": "resolution=merge-duplicates,return=representation"},
        json={"track_id": track_id, "owner_id": owner, "report": payload,
              "schema_version": report.schema_version, "algorithm_version": report.algorithm_version}))
    # Read persisted data back, not the in-process analysis result.
    result = await get_report(UUID(saved[0]["id"]), context)
    logger.info('{"event":"analysis_saved","elapsed_ms":%d}', int(report.analysis_duration_seconds * 1000))
    return result
