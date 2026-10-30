# КИБЕР VENGANCE · Local vocal companion

Optional native CPU/GPU singing for the browser studio. Model weights are downloaded separately and audio inference stays on your computer.

## Install and connect

- **Linux x86_64 (Arch / Ubuntu LTS):** download the AppImage, mark it executable in your file manager and open it. If FUSE is unavailable, run `./KiberVengance-Companion-1.0.0-x86_64.AppImage --appimage-extract-and-run`. System Python is not required. The graphics driver remains a host dependency.
- **macOS Apple Silicon:** open the DMG, copy the application to Applications and open it. Packages without an owner Developer ID certificate/notarization are unsigned for distribution; macOS may require its Open Anyway action. Ad-hoc signing is not notarization.
- **Windows x64:** run the per-user installer. It installs the application and URL handler without removing model/user data. Unsigned installers may show a publisher warning.

The companion opens a local management page. Install an engine/runtime and review/download its model or voice. In the studio, open **Arrange → Audio & sampler → Singing · Desktop**, enter the companion's six-digit code and connect. Browser local-network permission may be required. Use the same computer; the companion deliberately binds only to loopback.

## Engines and hardware

- DiffSinger: monophonic notes plus one syllable/word per note, `+` for melisma, `_` for silence, optional explicit phonemes, vibrato and bank voice colors. ONNX voice ZIPs must include a matching vocoder. CPU is available on each platform. macOS wheels include CoreML; Windows has a DirectML profile. Linux AMD uses the available MIGraphX wheel and host ROCm libraries; missing GPU providers fail visibly when GPU is explicitly selected.
- ACE-Step 1.5: lyrics/style/BPM/seed/duration produce a musical proposal, potentially including accompaniment. Exact score playback and isolated vocals are not guaranteed. Its upstream revision and model hashes are pinned. CPU, Apple, AMD ROCm and CUDA are separate profiles. AMD profiles must not resolve CUDA PyTorch dependencies. The default DiT-only generation avoids another multi-GB language-model download.

The runtime checks the selected accelerator before rendering. Automatic can use CPU when no GPU provider is available; explicit GPU never silently claims CPU output as GPU. No fixed generation speed or M3/7900 XTX performance is certified without a real-device run.

## Data and lifecycle

User data: Linux `$XDG_DATA_HOME/kiber-vengance` (default `~/.local/share/kiber-vengance`); macOS `~/Library/Application Support/KiberVengance`; Windows `%LOCALAPPDATA%/KiberVengance`. Application updates preserve this directory. Model removal targets the selected model only. Existing generated WAVs and browser projects remain intact. Failed downloads keep resumable partial files; completed pinned downloads are checksum-verified. Voice terms must be reviewed before downloading/importing.

Only one heavy job runs at a time. Cancel terminates its owned subprocess tree. Closing a studio generation dialog cancels that generation. Completed audio remains recoverable from companion jobs. Music and generated audio can be backed up through the studio's Project Package; model weights are separate.

## Development and build

```sh
PYTHONPATH=companion python -m kv_companion
python -m unittest discover -s companion/tests -v
python companion/packaging/build.py --platform linux-x64
```

Use native macOS ARM64 and Windows runners for their respective installer formats. `packaging/artifacts.json` pins portable CPython, uv and AppImage tooling. GitHub Actions builds all three packages, runs the bundled runtime self-test, and uploads artifacts plus SHA-256 sidecars. Actual generation does not run in packaging fixtures. Review `../docs/DESKTOP_VOCALS.md` for the evidence and outstanding device checks.
