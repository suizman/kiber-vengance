# Browser validation

Run `npm run check:full` after building the application. Browser tests do not skip missing engines.

Install Chromium and Firefox once with `npx playwright install chromium firefox`. The portable resolver also accepts `CHROMIUM_EXECUTABLE_PATH` and `FIREFOX_EXECUTABLE_PATH`, system `/usr/bin/chromium`, and a local `.cache/ms-playwright` directory in the repository or its parent. Preview processes and browser contexts are closed on failure.

On headless Linux without an audio device, Firefox can leave AudioContext suspended indefinitely even after a real click. Install PulseAudio and use:

```
node scripts/with-null-audio.mjs npm run check:full
```

The wrapper creates a temporary local null sink, runs the tests and cleans up. It also supports an extracted PulseAudio installation under `../.cache/pulse` or an explicit `PULSEAUDIO_EXECUTABLE_PATH`. This exercises real Web Audio scheduling with a virtual output; it does not verify physical audio hardware. Restricted sandboxes may need broader process permissions for Firefox's temporary profile.

Coverage includes composition/edit/history, arrangement, mixer, import/export, persistent audio assets, clip-scoped sound, command palette, accessibility, responsive layouts, sampler, scratch capture and waveform seeking. The touch regression deliberately delays worklet initialization and releases a real touch pointer before initialization completes; it also checks rapid taps and pointer cancellation. The microphone flow uses Chromium's fake audio device and checks persistence after reloading.

`node scripts/measure-ui.mjs` collects a five-run local Chromium load reference and compressed asset sizes. These are repeatable local comparisons, not field-performance measurements or a physical-iPhone substitute.
