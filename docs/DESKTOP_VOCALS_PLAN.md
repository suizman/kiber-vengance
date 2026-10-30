# Desktop vocal production — implementation plan

Approved scope: native local singing on macOS Apple Silicon and Intel, Windows x64 and Linux x64; AppImage for Linux, including Arch Linux. The studio remains a static web application. The companion is optional and never uploads lyrics/audio to an inference service.

## Architecture and acceptance

1. A standalone companion serves a local management page and a versioned loopback API. Pairing is explicit, credentials are origin-bound, untrusted Host/Origin headers are rejected, and generation never accepts arbitrary shell commands, remote inference URLs or filesystem paths from a website. One heavy job runs at a time. Cancellation terminates the entire owned subprocess tree.
2. Engines have separate runtimes and model storage under the operating system's user-data directory. Downloads are explicit, resumable where supported, checksum-verified and staged before installation. Updating/removing the application does not silently erase models or generated audio. Model removal and runtime repair are separate actions.
3. DiffSinger renders monophonic notes with one lyric token per note, explicit melisma, rests, editable phonemes, pitch transitions and vibrato. An ONNX acoustic model and matching vocoder are required; only supported model inputs become editable expression controls. Voicebank terms remain visible. No voicebank is represented as unrestricted merely because the engine is Apache-licensed.
4. ACE-Step uses a pinned upstream revision and its actual generation API. Lyrics/style, duration, BPM, language, seed and model capabilities are validated. A generated musical proposal is distinct from a note-accurate vocal. CPU, Apple acceleration and AMD/NVIDIA profiles are installed separately; CUDA dependencies must never overwrite a selected ROCm profile.
5. The studio gets a bilingual desktop-vocals dialog, connection/setup flow, hardware/status display, captured clip notes and insertion target, job progress/cancellation, original/processed audition and WAV download. Insertions use the existing audio-region/asset/history/package contracts with additive v6 singing provenance. Existing browser speech remains available under its existing compatibility policy.
6. Portable builds include the companion runtime and dependency manager, not multi-GB model weights. Linux AppImage must launch without requiring system Python, with extraction fallback when FUSE is unavailable. Windows and macOS have native launchers/install packages. Build workflows publish versioned artifacts and checksums; signatures require the corresponding owner certificates and are never fabricated.

## Validation gates

- Unit/integration: pairing/Host/Origin/auth, interrupted installation, unsafe archives/paths, job serialization and cancellation, provider selection and explicit GPU failure, actual ACE API payloads/result decoding, DiffSinger phoneme/frame/pitch contracts.
- Real browser: connect/pair, model status, note/lyric validation, cancel, audio preview/insert/Undo/Redo/reload and persisted provenance; protocol fixtures are labeled and never claimed as model inference.
- Real inference: short Spanish singing and a held vowel over changing notes, non-silent finite PCM, timing/pitch and retained output. Record exact model hashes/revisions, licenses, device and elapsed time. Audition quality remains separate from waveform validity.
- Packaging: run the actual AppImage and its self-test, check a fresh user-data directory, and exercise an Arch Linux environment where available. Native macOS/Windows builds and M3/7900 XTX GPU tests require those runners/devices; report their observed outcomes, not assumed support.
- Existing product: `npm run check:full`; preserve v6/v2–v5 imports, four workspaces, browser speech, musical assets and unrelated files/DNS.

## Delivery record

Implementation and actual validation results are recorded in `DESKTOP_VOCALS.md` and `PROJECT_MEMORY.md`. A feature is not marked verified solely because an installer or a worker-protocol fixture succeeds.

Intel extension: build a separate native x86_64 DMG on `macos-15-intel`, including bundled-runtime/mounted-DMG/signature checks and checksum sidecars. DiffSinger uses the compatible CPU ONNX runtime; ACE-Step remains unavailable on Intel because its pinned framework has no compatible wheel.
