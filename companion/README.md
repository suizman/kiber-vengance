# КИБЕР VENGANCE · Companion

**Local singing for the studio, with separately downloaded models.**

[Download an installer](https://github.com/suizman/kiber-vengance/releases/latest) · [Speech and singing manual](https://github.com/suizman/kiber-vengance/blob/master/docs/wiki/Speech-and-singing.md)

![The studio's desktop singing dialog](https://github.com/suizman/kiber-vengance/blob/master/docs/wiki/assets/desktop-vocals.png?raw=true)

*Actual interface with an HTTP protocol fixture; this is not evidence of model-generated audio.*

## Install and connect

| System | Package |
| --- | --- |
| macOS 13+ | `arm64` DMG for Apple Silicon or `x86_64` for Intel; copy to Applications |
| Windows x64 | Per-user installer, uninstaller and URL handler |
| Linux x86_64 | AppImage for Arch/Ubuntu; use `--appimage-extract-and-run` without FUSE |

Installers are in a private repository: GitHub access is required. Python is included. Mac packages are ad-hoc signed without notarization; Windows has no publisher certificate.

1. Open the companion and install your chosen runtime/model or voicebank after reviewing its licenses.
2. In the studio, open **Arrange → Audio & sampler → Singing · Desktop**.
3. Enter the six-digit code; allow local-network access if your browser asks.
4. Generate, audition Original/Processed, then download WAV or insert a new audio region.

## Engines

**DiffSinger** follows monophonic notes and syllables: `+` extends a vowel; `_` inserts silence. Phonemes, vibrato, portamento and bank-supported expression are available. A compatible ONNX voicebank and vocoder are required.

**ACE-Step** proposes music from lyrics, style, BPM, duration and seed. It may include accompaniment; exact notes and isolated vocals are not guaranteed. It is unavailable on Intel Macs because of its PyTorch dependency.

CPU is the baseline; Apple/CoreML, DirectML, CUDA and AMD support depend on engine, runtime and drivers. Since 1.0.2, CoreML acoustic generation uses a CPU vocoder. Installed profile and generation device are separate controls. No GPU benchmark is promised without testing the hardware.

## Data and maintenance

One heavy job runs at a time. Cancel terminates its process; completed jobs can be recovered. App updates preserve models and WAVs. **Restart the previous companion process after installing an update.** Repair and Delete model manage runtime/weights separately from the musical project.

Data locations: Linux `$XDG_DATA_HOME/kiber-vengance` or `~/.local/share/kiber-vengance`; Mac `~/Library/Application Support/KiberVengance`; Windows `%LOCALAPPDATA%/KiberVengance`. Project Package backs up inserted audio, not model weights.

Kaiz includes a **CC-BY-NC 4.0** vocoder and is not presented as cleared for commercial music. Software is GPL-3.0-or-later; see [third-party notices](https://github.com/suizman/kiber-vengance/blob/master/companion/THIRD_PARTY.md).

[Development, packaging and releases](https://github.com/suizman/kiber-vengance/blob/master/docs/wiki/Development.md) · [Licenses, hashes and evidence](https://github.com/suizman/kiber-vengance/blob/master/docs/DESKTOP_VOCALS.md).
