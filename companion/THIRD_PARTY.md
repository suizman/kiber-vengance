# Third-party components

The companion source is GPL-3.0-or-later, matching the studio. The corresponding companion source archive and LICENSE accompany portable packages.

- CPython / python-build-standalone: Python Software Foundation license and bundled component notices in the runtime distribution. Exact archive revisions and SHA-256 are in `packaging/artifacts.json`.
- uv: MIT OR Apache-2.0, Astral. The dependency manager is bundled; its source and licenses are at https://github.com/astral-sh/uv . Exact version and hashes are in `packaging/artifacts.json`.
- AppImage tooling/runtime: upstream AppImage projects' respective licenses, https://github.com/AppImage/appimagetool and https://github.com/AppImage/type2-runtime . The packaging tool is not a vocal model.
- ACE-Step: MIT, https://github.com/ace-step/ACE-Step-1.5 . Upstream source revision is fixed by the adapter. Model files and checksums are pinned in `kv_companion/resources/ace-model.json`. Framework/runtime dependencies are installed only after explicit user selection, in a separate environment; their license files remain installed there.
- DiffSinger: published Apache-2.0 model interface, https://github.com/openvpi/DiffSinger . The adapter independently implements the ONNX protocol. OpenUtau's MIT reference implementation informed tensor compatibility: https://github.com/openutau/OpenUtau . No third-party voice weights are bundled or relicensed.
- ONNX Runtime: MIT, https://github.com/microsoft/onnxruntime . CoreML, DirectML, CUDA and MIGraphX/ROCm provider support depends on the selected wheel and host driver. NumPy (BSD-3-Clause), PyYAML (MIT) and CMUdict (BSD-style notices distributed with the package) are optional DiffSinger runtime dependencies.

Voicebank and vocoder terms are independent. The optional Kaiz catalog entry downloads directly from PRINTmov, preserves the author's files/readme and identifies its bundled vocoder's CC-BY-NC 4.0 terms. It is **not** presented as cleared for commercial music. Imported voices remain subject to their own terms. Attribution/license URL and model hash travel with generated project regions; model weights do not enter Project Package.

The companion never claims ownership of independently created user compositions. Signing/notarization certificates and driver licenses are not supplied by this repository.
