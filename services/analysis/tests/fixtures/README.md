# Controlled WAV

`controlled.wav` is a generated 4-second mono PCM16 WAV at 22,050 Hz.
It contains a 0.1-amplitude 440 Hz sine plus a 512-sample Hann-windowed
0.4-amplitude 1500 Hz pulse every 0.5 seconds, starting at time zero.
No copyrighted audio, filenames or user recordings are included.

This is a deterministic measurement fixture, not a claim that the tempo/key
estimator recognizes musical ground truth. Tests require repeatable fields,
correct container metadata, nonzero RMS/centroid and detected beats. Timing is
excluded from equality. Analysis results are never substituted for user audio.
