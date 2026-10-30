# Desktop singing: implementation and evidence

2026-10-30. This is an optional native extension of the existing browser studio. It follows the approved [implementation plan](DESKTOP_VOCALS_PLAN.md). Browser speech remains available; it is not presented as a singing engine.

## Install and use

Download a package from the [versioned companion release](https://github.com/suizman/kiber-vengance/releases/tag/desktop-vocals-v1.0.0). The repository remains private, so GitHub sign-in and repository access are required for these downloads.

- Linux x86_64: AppImage, including Arch Linux and Ubuntu LTS. Mark executable; if FUSE is absent use `--appimage-extract-and-run`. The management page can install a desktop launcher and the `kibervengance://open` handler. The registered launcher uses extraction mode and a persistent application copy.
- macOS Apple Silicon or Intel, macOS 13+: separate ARM64 / x86_64 DMGs, drag the application to Applications. It is ad-hoc signed, without Developer ID/notarization; macOS may require **Open Anyway**.
- Windows x64: per-user installer with URL handler and uninstaller. It is not publisher-signed; a system warning may appear.

Python and the dependency manager are bundled. Models and engine dependencies are installed separately, explicitly, in persistent user data. Application updates preserve downloaded voices, models and completed audio. See the [companion guide](../companion/README.md) for data paths, runtime repair and dependency requirements.

1. Open the companion and choose the runtime appropriate to your computer. CPU is the portable baseline. Review the separate model/voice conditions before downloading.
2. Open **Arrange → Audio & sampler → Singing · Desktop**, or use the singing action in the speech dialog.
3. Enter the local companion's six-digit code. The browser may request local-network permission. The connection token is separate from the musical project.
4. Choose **DiffSinger · Sing my notes** or **ACE-Step · Musical proposal**, the installed runtime, Automatic/CPU/GPU and the destination audio lane.
5. Generate, audition the original or processed result, optionally download WAV, and insert. Insertion retains the existing asset, audio-effects, history, autosave and portable-package contracts. Original clips and earlier takes are preserved. Completed companion jobs can be recovered after reconnecting.

Mobile shows a compatibility explanation before any localhost request or model download. Generated/imported audio remains playable and editable on mobile.

## Musical controls

**DiffSinger:** capture a monophonic melodic clip, assign one syllable/word per note and edit individual phonemes when needed. `+` extends the previous vowel; `_` is a rest. Notes use the project's tempo map and swing when captured. Up to 256 notes / 120 seconds, with a 30 ms minimum note duration. Pitch follows the score, with adjustable vibrato and portamento; voice colors and expression controls depend on actual bank inputs. Overlapping notes fail visibly instead of being silently flattened. Banks must supply a compatible acoustic ONNX model, vocabulary, speaker data when required, and a matching ONNX vocoder.

**ACE-Step 1.5:** lyrics, music/vocal style, ES/EN, project BPM, duration 10–120 seconds and seed. It creates a musical interpretation and can include accompaniment. It does not guarantee the piano-roll melody or an isolated vocal stem. This adapter uses the turbo DiT-only path (8 steps, one output); it does not silently download the optional multi-GB language model during inference.

Both outputs enter the existing non-destructive audio-effects rack. Generation provenance includes model/revision, requested musical settings, actual processing device, output hash and voice attribution where supplied. The project contains generated audio and provenance, never engine weights or pairing credentials.

## Hardware and acceleration

| System | DiffSinger | ACE-Step |
| --- | --- | --- |
| Mac Intel | CPU (ONNX Runtime 1.23.2) | Unavailable: pinned PyTorch 2.9.1 has no macOS Intel wheel |
| Mac Apple Silicon | CPU / ONNX CoreML | CPU / PyTorch MPS, Apple runtime |
| Windows x64 | CPU / DirectML; CUDA profile | CPU / CUDA; AMD ROCm SDK profile |
| Linux x64 | CPU / CUDA; AMD MIGraphX with host ROCm libraries | CPU / CUDA / ROCm |

The runtime probe and the engine's actual device initialization determine availability. Explicit GPU selection fails if unavailable; it never labels CPU output as GPU. Automatic can fall back to CPU. GPU wheels stay isolated per engine/profile, and framework version constraints prevent ACE dependencies from replacing ROCm PyTorch with CUDA packages. Graphics drivers and host ROCm libraries are operating-system dependencies, not bundled driver installers. Arch AppImage portability does not imply that every Arch graphics-driver combination is certified.

The user's M3/32 GB and Radeon 7900 XTX/64 GB are target configurations; physical-device speed, peak memory and GPU quality have not been measured in this environment.

## Licenses and pinned inputs

- Companion/studio: GPL-3.0-or-later. Each installer includes corresponding companion source and third-party notices.
- DiffSinger engine/interface: Apache-2.0; voice/vocoder terms are independent. Optional Kaiz 2.2.3 is downloaded from its creator, not redistributed in the application. Archive SHA-256: `cb932f7f4f0464352df546d1a75178dc34781b232e600f88b67bec4cf04a1e19`. Its bundled `pc_tgm_hifigan` vocoder is CC-BY-NC 4.0. This combination is **not cleared for commercial releases**. Creator terms are displayed before opt-in; compatible user-provided banks can be imported instead.
- ACE-Step upstream revision: `ca1e85fe9430179831e6bc6be790c332190a3866`; model `ACE-Step/Ace-Step1.5` revision `19671f406d603126926c1b7e2adc169acbcade22`, MIT. The 16-file manifest pins individual sizes/hashes (6,336,680,772 bytes); incomplete installation fails visibly.
- Portable Python, uv and AppImage tools have exact artifact hashes in `companion/packaging/artifacts.json`. Generated package SHA-256 sidecars accompany downloads.

## Security and lifecycle

Loopback only, explicit Host/Origin allowlists, expiring single-use pairing code, origin-bound bearer tokens, owner-only local management, no arbitrary command/URL/path API. Only one heavy job executes; cancelling terminates its owned subprocess tree. ZIP/source extraction rejects traversal and special files. Downloads are resumable and checksum-verified. Tokens are not stored in project exports or logs. Inference remains local; initial dependencies/models contact their upstream distribution services.

## Observed validation

- 14 native unit/HTTP integration tests: pairing, origin/auth/Host checks, unsafe archives, resumed download integrity, queue serialization, process cancellation, history recovery and engine validation.
- Browser protocol fixtures exercise pairing with the real HTTP server, score/lyrics, processed preview controls, insertion, provenance, Undo/Redo, reload, reconnection, desktop accessibility and mobile admission. Fixture PCM is deliberately not represented as model output.
- Genuine CPU DiffSinger inference: Spanish “Ho la mun do”, notes C4/E4/G4/F4, 0.8 seconds each, produced 3.4017 seconds of WAV in 8.72 seconds. Actual provider `CPUExecutionProvider`; SHA-256 `f9a82bf057ca45a967f0a851cc07e80ca25df2873f1009b60411254d065fef3e`.
- Genuine CPU ACE-Step: 10-second Spanish industrial/electro-rock request, BPM 120, seed 24680, produced 10 seconds of WAV in 45.34 seconds; SHA-256 `48d61512e486eaef0a00bb42c30743a623ec57e674db5452a66cd80225b22d3f`.
- A second genuine DiffSinger run sustained “la” across C4/E4/G4 with `+`, inserted a silent note, then F4: 4.2028 seconds of audio. Autocorrelation at voiced note centers measured −4.5/−2.7/+7.7/+3.8 cents (200–500 Hz analysis range); rest RMS was zero. This is a small score/pitch regression, not an intelligibility or broad quality study. WAV SHA-256 `6767a37374b9972b44ff2d73907fa9a1dd0da0cf2f43554cf5e5cbe4751e768d`.
- The real studio → local HTTP → engine → audition → insert → reload path passed with **both** real engines. UI elapsed times were 9.6 s for DiffSinger and 75.1 s for a 10-second ACE proposal on this shared CPU host; both regions and provenance survived reload. The run caught and fixed upstream's model-code synchronization changing `.py` sizes after the first generation. Audio hashes: `d83cbe48253cf9ce23a79f04ee5767367c7ec9ad2448d726bca53f104ee0d4f9` / `4b3220a9687b94f62a9e71803f83a2d74bbe9cc479f8d231f8e3c388e75ade47`.
- Native CI builds all three formats from companion source `54902da`. Each executes its bundled runtime. macOS additionally mounts and verifies the final DMG/application signature; Windows silently installs, runs the installed runtime and uninstalls. These are installer/runtime smokes, not physical GPU generation tests.
- The actual packaged AppImage installed the CPU DiffSinger runtime, stopped, launched again under a new temporary mount, and successfully re-probed that persistent runtime. Its virtual environment uses the copied persistent Python base rather than a vanished AppImage mount.
- Actual AppImage self-test passed in a clean `archlinux:base` container with networking disabled, without system Python/FUSE. Desktop window-manager integration and physical Linux GPU generation remain separate checks.

Real browser-to-native inference can be repeated with installed models in a disposable companion data directory:

```sh
npm run build
KV_VOCALS_REAL_DATA=/path/to/acceptance-data node scripts/verify-desktop-vocals.mjs
```

It uses the real loopback server and real engines, auditions PCM, inserts both outputs and checks reload/provenance. It is opt-in because model installation is multi-GB. Samples/acceptance data stay outside version control. Waveform generation and automated playback do not establish a blind preference, broad pronunciation/intelligibility, a commercial voice license, physical speaker output or M3/7900 XTX benchmarks.

Release gate: `npm run check:full` passed with 59 unit tests and 51 browser workflows, no skips; all 14 companion tests passed. Focused browser tests additionally cover cancellation retaining the prior result and non-destructive inserted effects.

Published installers: [desktop-vocals-v1.0.0](https://github.com/suizman/kiber-vengance/releases/tag/desktop-vocals-v1.0.0), native build [41038652221](https://github.com/suizman/kiber-vengance/actions/runs/41038652221). Package attachment checks hashes before upload and retains an existing differing asset instead of replacing it.


## Intel packaging extension — 2026-10-30

`macos-x64` adds pinned x86_64 Python/uv, an explicitly targeted native launcher and an `x86_64.dmg` plus SHA-256 sidecar. CI uses `macos-15-intel`, alongside the existing Apple Silicon task, and runs the same bundled-runtime, mounted-DMG and ad-hoc-signature checks. The draft attachment workflow now requires all four packages. Intel is CPU-only; unsupported ACE-Step/accelerator installations fail before downloads. No new Intel release download is advertised until its artifact is published. Local validation results are recorded in PROJECT_MEMORY.md; packaging checks do not establish real-model inference or listening quality on Intel.

Dependency evidence: [ONNX Runtime 1.23.2 files](https://pypi.org/project/onnxruntime/1.23.2/#files), [1.24.4 files](https://pypi.org/project/onnxruntime/1.24.4/#files) and [PyTorch 2.9.1 files](https://pypi.org/project/torch/2.9.1/#files). The Intel packaged dependency installation/probe passed locally on macOS 13.6.4; no Intel model inference/listening test has been performed.

Release 1.0.1 preparation: companion version fields are synchronized. Publication is chained from a successful version-tag build, verifies source/tag/version and every SHA-256 sidecar, then publishes the completed draft. Ordinary branch builds do not publish releases. Outcomes will be recorded after CI completes.
