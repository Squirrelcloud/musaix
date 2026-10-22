"""HTTP boundary tests use fake Supabase transport, never fake MIR measurements."""
import httpx
from fastapi.testclient import TestClient
from main import app, user_client
from test_analysis import FIXTURE

OWNER = "00000000-0000-0000-0000-000000000001"
TRACK = "00000000-0000-0000-0000-000000000002"
REPORT = "00000000-0000-0000-0000-000000000003"


def test_analysis_saves_then_reloads():
    stored = {}
    calls = []

    def transport(request):
        calls.append((request.method, request.url.path))
        if request.url.path.endswith("musaix_tracks"):
            return httpx.Response(200, json=[{"id": TRACK, "object_path": f"{OWNER}/{TRACK}.wav"}])
        if "/storage/" in request.url.path:
            return httpx.Response(200, content=FIXTURE.read_bytes())
        if request.method == "POST":
            import json
            stored.update(json.loads(request.content))
            return httpx.Response(201, json=[{"id": REPORT}])
        return httpx.Response(200, json=[{"id": REPORT, "track_id": TRACK, "report": stored["report"]}])

    async def context():
        async with httpx.AsyncClient(base_url="https://supabase.invalid", transport=httpx.MockTransport(transport)) as client:
            yield client, OWNER

    app.dependency_overrides[user_client] = context
    try:
        with TestClient(app) as client:
            response = client.post("/analyze", json={"track_id": TRACK})
            assert response.status_code == 200, response.text
            result = response.json()
            assert result["id"] == REPORT
            assert result["report"]["duration_seconds"] == 4
            assert client.get(f"/analysis/{REPORT}").json() == result
            assert calls[-2:] == [("GET", "/rest/v1/musaix_audio_reports")] * 2
            assert stored["owner_id"] == OWNER
    finally:
        app.dependency_overrides.clear()


def test_unknown_track_does_not_fetch_audio():
    async def context():
        async with httpx.AsyncClient(base_url="https://supabase.invalid", transport=httpx.MockTransport(
                lambda request: httpx.Response(200, json=[]))) as client:
            yield client, OWNER
    app.dependency_overrides[user_client] = context
    try:
        with TestClient(app) as client:
            assert client.post("/analyze", json={"track_id": TRACK}).status_code == 404
            assert client.get(f"/analysis/{REPORT}").status_code == 404
            assert client.post("/analyze", json={"track_id": TRACK, "url": "https://example.invalid"}).status_code == 422
    finally:
        app.dependency_overrides.clear()
