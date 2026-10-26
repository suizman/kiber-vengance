# Browser validation

Run `npm run check:full` after building the application. Browser tests do not skip missing engines.

Install Chromium and Firefox once with `npx playwright install chromium firefox`. The portable resolver also accepts `CHROMIUM_EXECUTABLE_PATH` and `FIREFOX_EXECUTABLE_PATH`, system `/usr/bin/chromium`, and a local `.cache/ms-playwright` directory in the repository or its parent. Preview processes and browser contexts are closed on failure.

On headless Linux without an audio device, Firefox can leave AudioContext suspended indefinitely even after a real click. Install PulseAudio and use:

```
node scripts/with-null-audio.mjs npm run check:full
```

The wrapper creates a temporary local null sink, runs the tests and cleans up. It also supports an extracted PulseAudio installation under `../.cache/pulse` or an explicit `PULSEAUDIO_EXECUTABLE_PATH`. This exercises real Web Audio scheduling with a virtual output; it does not verify physical audio hardware. Restricted sandboxes may need broader process permissions for Firefox's temporary profile.

Coverage includes composition/edit/history, arrangement, mixer, import/export, persistent audio assets, clip-scoped sound, command palette, accessibility, responsive layouts, sampler, scratch capture and waveform seeking. The touch regression deliberately delays worklet initialization and releases a real touch pointer before initialization completes; it also checks rapid taps and pointer cancellation. The microphone flow uses Chromium's fake audio device and checks persistence after reloading.

Local AI: normal unit tests validate model plans and musical compilation across keys, scales, tracks and meters. Browser tests check explicit opt-in, unsupported WebGPU, cancellation, Spanish mobile dialog/accessibility and zero model requests before load. They never replace model inference with a fake successful generation.

Opt-in real-model smoke (build first): `node scripts/test-local-ai.mjs`. This downloads Qwen3 0.6B and requires a WebGPU adapter, sufficient GPU memory and model-host network access. It tests English inference, audition, new clip, Undo/Redo, reload, cached offline Spanish inference and unload. It is intentionally excluded from normal E2E. This macOS host's headless Chromium used `AI_TEST_UNSAFE_WEBGPU=1` plus its compatible `CHROMIUM_EXECUTABLE_PATH` to enable its test backend; this does not establish default browser support or physical audio quality.

`node scripts/measure-ui.mjs` collects a five-run local Chromium load reference and compressed asset sizes. These are repeatable local comparisons, not field-performance measurements or a physical-iPhone substitute.

For older macOS hosts, `FIREFOX_PLAYWRIGHT_MODULE=/absolute/path/to/a/matching/playwright/index.mjs` selects a matching installed Firefox launcher/browser pair. Chromium retains the current launcher and can use CHROMIUM_EXECUTABLE_PATH; the legacy all-browser launcher stalled even an isolated Chromium AudioWorklet probe on this host. An arbitrary Firefox executable from a different release can fail its browser protocol before any application test.

The real-model smoke also accepts `AI_TEST_BROWSER=firefox|webkit|chromium`, `AI_TEST_BACKEND=cpu|gpu|auto`, `AI_TEST_PORT` and `AI_TEST_PLAYWRIGHT_MODULE`. It exercises real CPU/GPU generation, cancellation controls, application insertion/Undo/persistence and offline reload. CPU requests use a compact schema and may take minutes. Native Safari/Orion are not replaced by an automated WebKit engine test.
