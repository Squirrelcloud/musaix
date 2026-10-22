"""Versioned, finite JSON contract. Unsupported measurements have explicit reasons."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Unavailable(Strict):
    value: None = None
    status: Literal["unsupported", "unavailable"]
    reason: str = Field(min_length=1)


class Scalar(Strict):
    value: float | None
    status: Literal["measured", "unavailable"]
    reason: str | None = None
    unit: str

    @model_validator(mode="after")
    def consistent(self):
        if self.status == "measured" and (self.value is None or self.reason is not None):
            raise ValueError("Measured value required, without missing-data reason")
        if self.status == "unavailable" and (self.value is not None or not self.reason):
            raise ValueError("Unavailable value must be null with a reason")
        return self


class Beats(Strict):
    timestamps_seconds: list[float]
    strength: list[float]

    @model_validator(mode="after")
    def aligned(self):
        if len(self.timestamps_seconds) != len(self.strength):
            raise ValueError("Beat strength must align with timestamps")
        if any(t < 0 for t in self.timestamps_seconds):
            raise ValueError("Negative beat time")
        return self


class Report(Strict):
    schema_version: Literal["1.0.0"] = "1.0.0"
    algorithm_version: Literal["librosa-0.11.0-musaix-1"] = "librosa-0.11.0-musaix-1"
    duration_seconds: float = Field(gt=0, le=180)
    sample_rate_hz: int = Field(gt=0, le=96000)
    channels: int = Field(ge=1, le=2)
    feature_sample_rate_hz: Literal[22050] = 22050
    tempo_bpm: Scalar
    tempo_confidence: Unavailable
    beats: Beats
    key: Unavailable
    mode: Unavailable
    key_confidence: Unavailable
    rms: Scalar
    rms_dbfs: Scalar
    integrated_lufs: Unavailable
    mfcc_mean: list[float] = Field(min_length=13, max_length=13)
    mfcc_std: list[float] = Field(min_length=13, max_length=13)
    chroma_mean: list[float] = Field(min_length=12, max_length=12)
    spectral_centroid_hz: Scalar
    spectral_bandwidth_hz: Scalar
    spectral_rolloff_hz: Scalar
    zero_crossing_rate: Scalar
    onset_timestamps_seconds: list[float]
    harmonic_rms: Scalar
    percussive_rms: Scalar
    analysis_duration_seconds: float = Field(ge=0)
