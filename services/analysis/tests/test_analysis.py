import io
import json
from pathlib import Path
import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient
from pydantic import ValidationError
from contract import Report, Scalar
from main import app
from measure import analyze

FIXTURE = Path(__file__).parent / "fixtures" / "controlled.wav"


@pytest.fixture(scope="module")
def measured():
    return analyze(FIXTURE.read_bytes())


def test_fixture_twice_is_deterministic(measured):
    second = analyze(FIXTURE.read_bytes())
    exclude = {"analysis_duration_seconds"}
    assert measured.model_dump(exclude=exclude) == second.model_dump(exclude=exclude)
    assert measured.duration_seconds == 4
    assert measured.sample_rate_hz == 22050
    assert measured.channels == 1
    assert measured.rms.value > 0
    assert measured.spectral_centroid_hz.value > 0
    assert measured.beats.timestamps_seconds


def test_contract_roundtrip_and_missing_data(measured):
    assert Report.model_validate_json(measured.model_dump_json()) == measured
    assert measured.key.value is None
    assert measured.key.reason
    assert measured.integrated_lufs.value is None
    assert measured.tempo_confidence.value is None
    data = measured.model_dump()
    data["made_up_score"] = 100
    with pytest.raises(ValidationError):
        Report.model_validate(data)
    data = measured.model_dump()
    data["rms"]["value"] = float("nan")
    with pytest.raises(ValidationError):
        Report.model_validate(data)
    with pytest.raises(ValidationError):
        Scalar(value=None, status="measured", unit="BPM")
    with pytest.raises(ValidationError):
        Scalar(value=0, status="unavailable", reason="missing", unit="BPM")


def test_silence_not_fake_loudness():
    buf = io.BytesIO()
    sf.write(buf, np.zeros(22050), 22050, format="WAV")
    report = analyze(buf.getvalue())
    assert report.rms.value == 0
    assert report.rms_dbfs.value is None
    assert report.tempo_bpm.value is None
    json.dumps(report.model_dump(), allow_nan=False)


@pytest.mark.parametrize("data", [b"", b"not audio", b"0" * (10 * 1024 * 1024 + 1)])
def test_invalid_audio(data):
    with pytest.raises((ValueError, RuntimeError)):
        analyze(data)


def test_health_and_authentication():
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok", "schema_version": "1.0.0"}
        assert client.post("/analyze", json={"track_id": "00000000-0000-0000-0000-000000000001"}).status_code == 401
        assert client.get("/analysis/00000000-0000-0000-0000-000000000001").status_code == 401


def test_published_json_schema_matches_contract():
    schema = Path(__file__).resolve().parents[1] / "report.schema.json"
    assert json.loads(schema.read_text()) == Report.model_json_schema()
