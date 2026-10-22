"""Bounded MIR analysis; no recognition, quality scoring or synthetic confidence."""
import io
import time
import librosa
import numpy as np
import soundfile as sf
from contract import Beats, Report, Scalar, Unavailable

MAX_BYTES = 10 * 1024 * 1024


def unavailable(reason, status="unsupported"):
    return Unavailable(status=status, reason=reason)


def scalar(value, unit):
    return Scalar(value=float(value), status="measured", unit=unit)


def analyze(data: bytes) -> Report:
    started = time.perf_counter()
    if not data or len(data) > MAX_BYTES:
        raise ValueError("Audio must be between 1 byte and 10 MiB")
    with sf.SoundFile(io.BytesIO(data)) as source:
        if source.format not in {"WAV", "MP3"}:
            raise ValueError("Only WAV and MP3 audio are supported")
        rate, channels, frames = source.samplerate, source.channels, source.frames
        duration = frames / rate
        if not 0 < duration <= 180 or not 1 <= channels <= 2 or rate > 96000:
            raise ValueError("Audio exceeds duration, channel or sample-rate limits")
        audio = source.read(dtype="float32", always_2d=True)
    if not np.isfinite(audio).all():
        raise ValueError("Audio contains non-finite samples")
    y = librosa.resample(audio.mean(axis=1), orig_sr=rate, target_sr=22050)
    sr, hop = 22050, 512
    envelope = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=envelope, sr=sr, hop_length=hop)
    beat_frames = beat_frames[librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop) < duration]
    onsets = librosa.onset.onset_detect(onset_envelope=envelope, sr=sr, hop_length=hop)
    onset_times = librosa.frames_to_time(onsets, sr=sr, hop_length=hop)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    harmonic, percussive = librosa.effects.hpss(y)
    rms = float(np.sqrt(np.mean(y.astype(np.float64) ** 2)))
    tempo_value = float(np.asarray(tempo).reshape(-1)[0])
    tempo_result = (scalar(tempo_value, "BPM") if len(beat_frames) >= 2 and tempo_value > 0
                    else Scalar(value=None, status="unavailable", unit="BPM",
                                reason="Insufficient detected beats"))
    return Report(
        duration_seconds=duration, sample_rate_hz=rate, channels=channels,
        tempo_bpm=tempo_result,
        tempo_confidence=unavailable("Estimator has no calibrated confidence"),
        beats=Beats(timestamps_seconds=librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop).tolist(),
                    strength=envelope[beat_frames].astype(float).tolist()),
        key=unavailable("Key estimator not implemented in algorithm v1"),
        mode=unavailable("Mode estimator not implemented in algorithm v1"),
        key_confidence=unavailable("No calibrated key estimator"),
        rms=scalar(rms, "linear full scale"),
        rms_dbfs=(scalar(20 * np.log10(rms), "dBFS") if rms > 0 else
                  Scalar(value=None, status="unavailable", reason="Silence has undefined finite dBFS", unit="dBFS")),
        integrated_lufs=unavailable("BS.1770 integrated loudness not implemented; RMS is not LUFS"),
        mfcc_mean=mfcc.mean(axis=1).astype(float).tolist(),
        mfcc_std=mfcc.std(axis=1).astype(float).tolist(),
        chroma_mean=chroma.mean(axis=1).astype(float).tolist(),
        spectral_centroid_hz=scalar(librosa.feature.spectral_centroid(y=y, sr=sr).mean(), "Hz"),
        spectral_bandwidth_hz=scalar(librosa.feature.spectral_bandwidth(y=y, sr=sr).mean(), "Hz"),
        spectral_rolloff_hz=scalar(librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=.85).mean(), "Hz"),
        zero_crossing_rate=scalar(librosa.feature.zero_crossing_rate(y).mean(), "crossings/sample"),
        onset_timestamps_seconds=onset_times[onset_times < duration].astype(float).tolist(),
        harmonic_rms=scalar(np.sqrt(np.mean(harmonic.astype(np.float64) ** 2)), "linear full scale"),
        percussive_rms=scalar(np.sqrt(np.mean(percussive.astype(np.float64) ** 2)), "linear full scale"),
        analysis_duration_seconds=time.perf_counter() - started,
    )
