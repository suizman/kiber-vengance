# Studio interface refactor — 2026-10-25

## Scope and compatibility

Four workspaces replace the overlapping navigation bars. Compose owns clips and the piano roll; Arrange has Arrangement and Audio & sampler; Live has Performance deck and Clip launcher; Mix owns channels and mastering. The Sound inspector is available from every workspace. Selection, scroll position and music playback have independent lifetimes. Changing views does not change a running transport's song/clip mode.

The project schema remains **version 6**, storage keys and IndexedDB stores are unchanged, and older projects continue through the existing migration functions. `src/core.ts` and `src/model.ts` were formatted for maintenance without changing the project format. No project reset, forced conversion or cloud upload is required.

## Feature parity inventory

| Existing capability | Destination / implementation |
|---|---|
| Five instruments, presets, arp, LFO, clip FX and macros | Global Sound inspector; instruments controller |
| Clip creation/variation, piano roll, selection, generators, automation | Compose; performance/instruments controllers |
| Sections, repeat/reorder, markers, loop/punch, tempo/meter | Arrange → Arrangement; arrangement controller |
| Audio import/input, non-destructive regions, slicing, automation/modulation | Arrange → Audio & sampler; audio-studio controller |
| Chromatic sampler, MIDI/QWERTY/octaves, local drum samples | Audio & sampler and Project libraries; shared keyboard |
| Quantized clip launching and committing a live arrangement | Live → Clip launcher; launcher controller |
| Live keyboard/macros, audio takes and editable performance events | Live → Performance deck; performance controller |
| Scratch capture/import/microphone, seek, stutter, reverse/speed, resample | Live → Performance deck; scratch controller |
| Track channels, solo/mute, buses/sends, master and reference compare | Mix; mixer controller |
| WAV/MIDI/stems/project/package export, cancellation and linked files | Global Export; storage/workflow controllers |
| Named snapshots, recovery, import/migration, local assets | Project menu; storage controller |
| Commands, shortcuts, help, guided tour, ES/EN, density/focus | Shared shell/workflow/localization |

## Architecture

- Vite bundles the static application. `index.html` and `public/` are sources; `dist/` is generated and tracked for static hosting. Do not edit generated files.
- Preact owns the shell, shared musical keyboards/dials and validated dialogs. Instrument/editor DOM is mounted as stable islands to preserve pointer captures and the existing sequencer coordinate system.
- `src/features/` separates instruments, performance, scratch, sampler, audio studio, arrangement, mixer, launcher, workflow and storage. An injected runtime context connects these controllers; UI components do not own audio lifetime.
- `src/ui/bridge.ts` publishes small immutable view snapshots. Audio scheduling and playhead/meter drawing do not pass through the shell's render loop.
- `src/ui/locales/` is the bilingual catalog. Translation updates known control text in place and excludes user-authored names/input values. Label changes do not recreate held keys.
- `src/ui/styles/` defines tokens, shell and component visuals. `instruments.css` retains only the legacy instrument geometry needed for note/ruler/platter rendering; obsolete application-layout rules and decorative overrides were removed.
- Shared pointer lifecycles handle release/cancel/lost capture/blur/hidden-page paths. Audio initialization is cancelable for both synth and sampler notes.
- Source-dependent offline caches are generated from the built asset list. Only this app's caches are retired; IndexedDB and local project data remain untouched.

## Design

Graphite surfaces, ivory/charcoal piano keys, restrained cyan interaction and magenta recording accents. The chosen mark is Signal KV, supplied as SVG; `public/brand-options.svg` documents the second considered direction. Workspaces use a single navigation hierarchy; mobile has the same four destinations, a compact transport and an inspector sheet. Expand/Focus share one state. Desktop retains interface scaling and both layouts offer density control.

## Performance work

Hidden studio panels no longer rebuild on every project update. Scratch and mixer animation stop when their view/document is hidden. Peak envelopes are cached by AudioBuffer and width. Shared keyboards use stable keyed rendering; dials keep local gesture state and commit once per gesture. Compiled JS/CSS are hashed and minified, with a small shell entry and separate music/runtime chunks.

Local Chromium reference: initial DOM reduced from **1,790 to 1,342 nodes (25.0%)**. This is not a network or device speed claim. DOMContentLoaded is not directly comparable across the old synchronous entry and the new deferred runtime, so it is not presented as an application-startup speedup. `node scripts/measure-ui.mjs` records reproducible local milestones and raw/gzip sizes. Libraries and complete bilingual catalogs add bundle cost; this trade-off is explicit.

## Validation and release

Run `npm run check:full` with the documented browser prerequisites. Linux environments without an audio server can use `node scripts/with-null-audio.mjs npm run check:full`. That exercises actual Web Audio with a null output sink; microphone fixtures are simulated and do not establish physical-device capture quality.

Use `tests/README.md` for browser configuration. Physical iPhone/Safari, hardware MIDI and audible latency still require real-device verification. Do not claim them from desktop emulation.

Sites retains the same project/domain/access audience. Publish only the verified build; the previous saved version remains available as a rollback target without touching project data or DNS.

The compact transport includes a Transport settings disclosure at every width; quantization/free recording, meter, swing and count-in are never removed on mobile. This closes an actual feature-parity regression found by the responsive suite.

## Final gate result

`node scripts/with-null-audio.mjs npm run check:full` passed: strict typecheck, static build verification, lint, core model tests and **12/12 real-browser workflows** (Chromium desktop/mobile emulation and Firefox), zero skips/failures. Automated axe checks include color contrast; separate contrast scans passed across all six views. The built asset reference is in `docs/performance-reference.json`. Hardware microphone/MIDI, audible latency and physical iPhone/Safari remain outside this automated evidence.
