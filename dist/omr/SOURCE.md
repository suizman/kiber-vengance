# Local score reader source and licenses

This optional component is derived from Partsong (AGPL-3.0-only), commit
`e7cbd9112763aa31e45abaea2d1bbe09159a8f1b`, using homr-rs commit
`86ac1ae05278f383cb0dc409711943fb4bf70de0`. The host application is GPL-3.0-or-later.
The application and modified worker source for this exact publication are
[available as a ZIP](../source/studio-source.zip), independently of repository access.
Version history: https://github.com/suizman/kiber-vengance .

- Complete original Partsong source: [download](./partsong-source.tar.gz).
- Pinned homr-rs source: https://github.com/pzfreo/homr-rs/tree/86ac1ae05278f383cb0dc409711943fb4bf70de0 .
- Build the original WASM with `scripts/build-omr.sh` from that source, Rust's
  `wasm32-unknown-unknown` target and its pinned Cargo dependency. The distributed
  standard/relaxed-SIMD binaries are unchanged upstream binaries; hashes are in
  `models.json` and the repository's delivery documentation.
- Our worker modifications: fixed model revision, SHA-256 verification on hydration,
  reduced retries, serial requests, single-thread runtime, bounded images,
  explicit progress/truncation warnings and tensor cleanup. The modified worker
  is itself the preferred editable source, served alongside this notice.
- Model weights: AGPL per homr's [license FAQ](./LICENSE_FAQ.md), including its
  dataset attribution and licensing uncertainties. This notice does not assert
  unrestricted commercial rights to training data.
- ONNX Runtime Web: MIT. PDF.js: Apache-2.0. Their licenses are retained in the
  application dependency lock and third-party notices.

No score or microphone data is sent to a recognition service. The models are
optional downloads from the fixed public Hugging Face URLs in `models.json`.
