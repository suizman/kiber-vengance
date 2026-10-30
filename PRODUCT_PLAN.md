# Product plan and release record

## Vision and current model

КИБЕР VENGANCE turns “cinematic machinery” into an instrument: graphite, ivory, thermal amber and pressure red; mechanical geometry, motion tied to musical state, and an original vocabulary—Forge, Signal, Impact, Mutation—without copying an existing band, game or DAW.

The workflow moves from immediate sound to detailed production: play the demo, experiment with clips and presets, edit notes and sound, arrange the song, perform, then export useful files. The current four workspaces are **Compose, Arrange, Live and Mix**, with a shared Sound inspector. Earlier references to Forge, Audio and Perform describe internal panels or the previous interface, not additional current workspaces.

The project model is **v6**, with **v2–v5 import compatibility**. Speech and singing generation are desktop-only; general audio editing, recording, sample playback and project portability remain independent of generation engines. Historical milestones and validation counts below describe their dated deliveries; `PROJECT_MEMORY.md` records the current publication and acceptance state.

## Delivered milestones

**Contextual AI composition — 2026-10-27, Sites version 30.** Active-clip harmonic context; continue, answer, vary or change the selected motif's rhythm; phrase/loop/free structure; density, register, leap, repetition and variation controls; A/B/C proposals from one inference, looped comparison and partial regeneration preserving other bars; persistent personal recipes with favorites and search. Composition shaping reuses the existing plan without inference. The v6 format is unchanged. See `docs/LOCAL_AI.md`; closure evidence is recorded in project memory.

**Local AI and presets — 2026-10-26, local preview.** Musical styles, explicit rhythm and preview BPM; nine melody recipes and six original sounds with combined search, JSON catalog/bank import from file or HTTPS, and Preset Vault storage. Global tempo changes require explicit opt-in and preserve later tempo events. External official sources identify compatibility; other engines' patches are not interchangeable. At that preview, the committed catalog's anonymous URL returned HTTP 404, so anonymous hosting was not verified; see `docs/PRESET_CATALOG.md`. Genuine CPU inference, insertion, Undo/Redo and persistence were verified in WebKit.

**Control feedback — 2026-10-26.** Immediate QWERTY feedback in Compose, Live and Prism Keys; shared hover/focus/pressed/disabled states; visible slider progress, dial response and values; cyan/track/magenta semantics and reduced motion. Verified in Chromium at that milestone; Firefox verification was then blocked by its missing binary.

1. **Foundations:** Web Audio engine, five tracks, transport, scheduler, persistence, demo and visual identity.
2. **Composition:** independent clips, multi-octave/multi-bar piano roll, expressive editing, automation, arrangement, recording and versions.
3. **Depth:** dual oscillators, ADSR, three filters, unison/detune/glide/pan, LFO, arpeggiator, seven drum voices, harmonic generators, presets and six macros.
4. **Polish:** persistent FX buses, full WAV/MIDI export, error recovery, responsive layouts, accessibility, typed contracts, multi-browser tests and documentation.
5. **UX remaster:** command palette, Focus, persistent collapsible racks, action shortcuts, responsive mobile music workflows and a higher-contrast industrial visual language.
6. **Spectral Deck:** original vector identity, multicolor cyberpunk styling, EN/ES interface, interactive tutorial and contextual help.
7. **Guitar & Backing:** plucked-string guitar synthesis with its own presets/FX; section-based backing generation preserving guitar and lead material.
8. **Clip Character:** independent arpeggiator, LFO, effects and macros per clip, v4 migration and consistent export.
9. **Fast Mix & Export:** active-track Solo/Mute without QWERTY conflicts, updated command palette and responsive WAV/MIDI/JSON shortcuts.
10. **Scratch Deck:** mastered 1–8-bar capture; bidirectional AudioWorklet turntable; waveform, crossfader, filter, sync, brake, spinback, stutter and responsive touch/mouse/keyboard control.
11. **Studio Workflow:** clip/song locators, navigable timeline, metered mixer and A/B, live master recording, Export/Export As, destination management, 16/32-bit WAV, normalization and stems ZIP.
12. **Performance Studio v5:** quantized/capturable Clip Launcher, advanced arrangement, precision mixing, takes with editable events, Preset Vault, local samples, Project Package and configurable professional export.
13. **Signal Core Identity:** official `КИБЕР VENGANCE` name, Cyrillic/Latin wordmark, original К/V monogram, refreshed PWA icon and accessible signal animation respecting reduced motion.
14. **Hybrid Studio v6:** non-destructive audio tracks/regions; import, microphone and deck resampling; offset/fades/pitch/warp editing; transient slicing; global automation/modulation; MIDI Learn; tempo/meter maps; musical transforms; routing/sidechain; mastering; templates; recovery; 80–120% interface scaling.
15. **Prism Keys:** persistent polyphonic chromatic sampler with a multicolor 25-key touch keyboard, waveform, root/trim/tune/envelope/filter, reverse, gate/one-shot/loop, QWERTY/MIDI and Project Package portability.
16. **Audio-to-Deck & Pause:** position-preserving transport pause and audio-region resume from the correct source offset; Audio Studio follows global transport, sends edited regions to Scratch Deck and accepts browser-decodable audio directly into the deck.

## Technical decisions

- Native Web Audio synthesis avoids mandatory sample downloads, CORS dependencies and third-party sample licensing for the built-in instruments.
- Look-ahead scheduling separates the musical clock from animation; a controlled-clock test simulates ten minutes of playback.
- FX buses persist with bounded graph size. Each voice's oscillators, noise sources and modulators are explicitly stopped and disconnected.
- `OfflineAudioContext` uses the playback event model and renders the whole arrangement rather than recording real time.
- The runtime (`core`, `audio`, `app` and model) is strict TypeScript compiled to static ES modules in `dist/`.
- Free recording preserves fractional offsets and sub-step duration. Web MIDI records/replays pressure, CC74/timbre and pitch bend per channel, including updates to held voices.
- v6 separates serialized take/sample/audio-region metadata from binary blobs in IndexedDB. Project Package combines JSON and local assets in a portable ZIP without a project server or remote storage service.
- Audio Studio regions share scheduling and the composition's master path with instruments and participate in offline WAV. Native warp changes playback rate and pitch together; it is not independent pitch-preserving time stretch.
- Faders act on persistent buses rather than note velocity. Volume, pre-gain, pan, Solo/Mute and pre/post sends respond during sustained voices.
- The installable PWA includes an exportable compatibility/diagnostic report without sending device data elsewhere.
- Studio hosting serves static `dist/`. Selenium/Firefox, Playwright/Chromium and axe-core are development tools.

## Acceptance checklist

The checked items below record implemented capabilities. The original baseline validation count is retained as historical evidence, not the current suite size.

- [x] Complete five-track composition using independent 1–8-bar clips.
- [x] Multi-octave piano roll, drum sequencer, zoom and 1/64–1/4 resolution.
- [x] Velocity, duration, multi-selection, drag/resize, keyboard editing, copy/paste, Undo/Redo and quantization.
- [x] Mouse-marquee selection with additive Shift selection.
- [x] Safe clip deletion: confirmation, last-clip protection, arrangement reassignment and Undo/Redo.
- [x] Key, five scales, visual guidance, chords, riffs, bass, beats and controlled variation.
- [x] Song arrangement with five-clip assignment, repeats, names, duplication, deletion and reordering.
- [x] Interpolated cutoff, volume and pan automation.
- [x] Polyphonic dual oscillators, ADSR, LP/HP/BP filters, LFO, arpeggiator, unison, detune, glide and stereo.
- [x] Electronic drums: kick, snare, closed/open hat, tom, percussion and crash.
- [x] Plucked-string guitar with pick transient, harmonics, resonant body, presets and full export.
- [x] Backing generation with 2–6 sections and three styles; bass, pad and drums follow key, scale and intensity.
- [x] Independent distortion/saturation, tone EQ, chorus, delay, reverb, compression and limiting.
- [x] Exclusive Solo and per-track Mute, immediate bus switching and matching WAV isolation.
- [x] Metronome, count-in, QWERTY/touch/MIDI recording, 4/4, 3/4, 6/8 and swing.
- [x] Six macros: energy, darkness, tension, aggression, space and complexity.
- [x] Per-clip arpeggiator, LFO, effect chain and macros, with v2/v3 migration and per-clip WAV rendering.
- [x] Autosave, empty/demo projects, duplication, snapshots, restore and JSON import/export.
- [x] Full-arrangement or active-clip WAV and MIDI.
- [x] Visible errors/render states and v2/v3/v4/v5→v6 migration preserving musical material.
- [x] Static/PWA build and strict TypeScript runtime. Historical baseline: 26 unit tests and 10 browser workflows covering Firefox audio/WAV/sustained MPE and Chromium responsive/a11y/PWA/Scratch Deck/Prism Keys/linked export/Launcher/Arrange/Audio Studio/mixing/libraries.
- [x] Desktop/mobile visual checks without overlap or global horizontal overflow.
- [x] English by default, persistent Spanish, guided tutorial and accessible contextual descriptions.
- [x] Non-conflicting shortcuts: `Shift+S` Solo, `Shift+M` Mute and `Shift+V` Mutation; text entry isolated in fields/dialogs.
- [x] Header export repeats the last format/destination while retaining advanced options.
- [x] Per-format linked destinations: Export reuses a file, Export As selects another, Project Core inspects/forgets targets, with downloads as fallback.
- [x] Smooth bidirectional Scratch Deck in the performance panel, temporary non-destructive buffer, touch/mouse/keyboard control, waveform, equal-power crossfade and performance effects.
- [x] Independent clip/song start positions, exact seek, musical readout and Arrange timeline navigation.
- [x] Five-channel Mix console with real meters, volume, pan, sends, Solo/Mute, master and A/B.
- [x] Live master recording including Scratch Deck, with explicit take saving.
- [x] Export/Export As shortcuts, destination management, 16/32-bit WAV, normalization and master plus five stems ZIP.
- [x] Five-track Clip Launcher with beat/bar queueing, per-track stop, MIDI, scene capture and arrangement commit.
- [x] Advanced Arrange multi-selection, copy/paste/duplicate/delete, fills, zoom, markers, exact cursor, loop and punch-in.
- [x] Precision mixing: pre-gain, dB faders, stereo RMS/peak, peak hold, approximate momentary LUFS, pre/post sends, colors, master bypass and loudness-matched A/B.
- [x] Persistent takes with IndexedDB audio and editable v6 events: trim, quantization, retiming, values, deletion and replay.
- [x] Preset Vault search, tags, favorites, user presets and JSON bank import/export.
- [x] Seven local sample slots with trim, tuning, envelopes and reverse in live/offline playback.
- [x] Export at 44.1/48/96 kHz, TPDF dither, FX tail, dry/wet, loop region, selected stems, progress/cancellation and Project Package.
- [x] Audio Studio lanes/regions, multi-file import, microphone capture, Scratch Deck resampling and non-destructive position/offset/length/gain/fades/pitch/rate-warp editing.
- [x] Serialized global automation, audible modulation routes, persistent MIDI Learn, tempo/meter maps and retrograde/invert/double/half/humanize transforms.
- [x] Group routing, kick-triggered sidechain, target LUFS, ceiling, mono check, templates and automatic recovery points.
- [x] Density audit at 80–120% scale, 1550/1320/900/760 px breakpoints and local scrolling for wide controls.
- [x] Prism Keys persistent sample, 25 large multicolor chromatic keys, per-note feedback, configurable polyphony, gate/one-shot/loop, full chromatic QWERTY/octaves, touch/MIDI and asset packaging.
- [x] Dedicated pause preserves clip/song cursor and resumes within audio regions without restarting their source.
- [x] Scratch input from mix capture, direct audio import or edited Audio Studio regions, with visible codec errors and temporary non-destructive buffers.

## External dependencies and deliberate exclusions

The studio includes Preact and optional WebLLM for local AI. Browser APIs provide Web Audio/live and offline rendering, permission-dependent Web MIDI, `localStorage`, IndexedDB, File System Access for compatible linked export targets, and Service Worker/manifest installation. AI requires explicit initial downloads from Hugging Face/GitHub and runs inference on-device. Projects have no remote generation or storage backend. TypeScript, ESLint, Playwright, Selenium, geckodriver and axe-core are development tools. The separate optional desktop companion is described in the native-singing section below.

The guitar is a deliberately synthetic plucked-string instrument for this electro-rock product, not an acoustic multisample replacement. Commercial sample libraries, external plugins, accounts, cloud storage and remote collaboration require additional licensing, infrastructure and privacy decisions and remain excluded. General music uses native-node scheduling; Scratch Deck uses a dedicated `AudioWorklet` because continuous bidirectional reading belongs off the UI thread.

## Verifiable external limits

- Physical Apple hardware is required to validate Safari/iOS. Linux or automated WebKit cannot replace that evidence; the compatibility report can supply device details.
- Web MIDI depends on browser support and permission. QWERTY, mouse and touch remain usable without it.
- File System Access is not universal. Export/Export As fall back to downloads; compatible browsers can request write permission again between sessions.
- Performance recording uses MediaRecorder's available container, normally WebM/Opus. Composition/stem rendering remains WAV.
- Direct Scratch import accepts WAV and compressed formats supported by that browser's `decodeAudioData`. MP3/OGG/WebM work when codecs exist; unsupported files show an error and do not arm the deck.
- MediaRecorder captures an already compressed waveform. Editing take events changes control replay over the captured audio; it does not re-synthesize that recording.
- Sample, audio-region and take blobs live in IndexedDB and can disappear when site data is cleared. JSON preserves metadata; moving a project with audio requires Project Package.
- `OfflineAudioContext` cannot cancel DSP already underway. Cancellation is checked before/after rendering and between stems to prevent subsequent writes.
- System-font fallbacks support offline use but can vary across platforms.

## Sites mobile scrolling correction

At widths up to 820 px, the document uses vertical scrolling and automatic height so the editor/footer remain reachable. Piano roll retains local scrolling. This removed the former `overflow:hidden` and desktop-height lock on small screens.

## Composition-focused usability — 2026-10-24

Clips opens the editor; Sound reveals racks on demand. The interface at that milestone used fixed transport and Clips/Sound/Arrange/Mix navigation on small screens, with 44 px main targets. The editor distinguishes Draw, Select and Navigate, showing track/clip/bar context. Generation/harmony start collapsed. Export prioritizes complete project/audio/MIDI while retaining advanced formats/options. Autosave warnings stay visible; snapshots do not block saving. Mobile scale follows the device; desktop retains 80–120% control. The later four-workspace refactor below supersedes that navigation structure.

## Touch editing and usability completion — 2026-10-24

- Duplicate, quantize and delete operate on selected notes. Duplication selects copies and refuses overflow with an instruction to extend the clip. Quantization uses the active snap grid.
- Undo feedback covers clip creation/variation/deletion, note deletion, selection changes, backing generation and automation clearing. Toast timers do not dismiss newer feedback early.
- Automation is collapsed until requested. Shared controls/dialogs have larger text and touch targets; mobile inputs use 16 px text to avoid focus zoom.
- Forge, Perform and Prism keys use `touch-action: manipulation`, suppressing double-tap zoom while retaining browser pinch zoom. Forge/Perform track pointers separately and release held voices on pointer cancellation, lost capture, blur and page hiding.
- Historical validation: `npm run check` passed. Dedicated Chromium checks at 390/768/1366 px covered selection/Undo, automation disclosure, repeated touch without scale changes, blur note release, all six then-existing views without horizontal overflow, export and autosave warnings. `check:full` could not complete because the configured Playwright browser and Firefox binary were missing. Physical iPhone/Safari verification remained outstanding.

## Mobile note release and position sliders

- Releasing a key before asynchronous audio initialization completes cancels the pending note. Global pointer release/cancel also clears held keys.
- Song/clip position sliders flex across available width instead of retaining their native input width.
- Typecheck, build, lint and core tests passed at that milestone; physical iPhone verification remained pending.

## Precision touch dials

- Captured dragging supports a full vertical range over 300 px and horizontal adjustment five times finer; Shift adds desktop precision. Other pointers cannot interrupt the gesture. Release/cancel/lost capture/blur clean up. Plus/minus controls remain available.
- Dials and scratch surfaces own their gestures. Performance buttons/ranges suppress double-tap zoom while preserving page pinch zoom. Physical iOS validation remains a separate requirement.

Scratch additions and the prioritized consistency backlog are in `UX_REVIEW.md`; physical microphone/Safari checks remain necessary. The consistency pass added waveform seeking, direct deck persistence, shared control scale, creation Undo and validated timing dialogs. Remaining component, translation and navigation-architecture work is explicitly tracked there.

## Studio interface refactor — 2026-10-25

Vite, a Preact shell and shared keyboards/dials/dialogs implement the approved four workspaces. Ten feature controllers preserve music workflows and v6. Signal KV is the selected SVG identity. Shared typography, focus/disabled states, inspector, bilingual catalog and pointer lifecycles replace overlapping navigation/control patches. Hidden panels render on demand; inactive animations stop; waveform envelopes are cached. Validated cancelable dialogs replace native edit prompts. See `docs/REFACTOR.md` for parity, architecture, performance evidence and physical-device limits. Earlier Forge/Audio/Perform top-level tabs describe the previous interface.

Historical refactor gate: `node scripts/with-null-audio.mjs npm run check:full` passed, including 12/12 Chromium/Firefox workflows without skips. Hardware input/output and physical Safari were not verified. Initial DOM was 1,342 nodes versus a local 1,790-node baseline; this is not a hardware-speed guarantee. Full evidence: `docs/REFACTOR.md`.

## Independent sound per clip — 2026-10-25

Sound edits the active clip's preset/instrument: oscillators, filter, ADSR, glide, unison and detune, with bilingual scope guidance. Track volume, pan, Mute/Solo, pre-gain and routing stay unchanged when loading presets, including legacy banks. New, duplicated and generated clips keep independent copies of the source instrument.

Additive `clip.instrument` preserves v6, migrating older projects by copying each track instrument to its clips. History, autosave, JSON, Package, playback, launcher, arrangement, Scratch capture and WAV/stems retain per-clip instruments. Held voices retain their note-on parameters. Live FX buses remain shared per track: tails continue, but subsequent FX changes can recolor them. MIDI does not encode synth patches; use WAV or project/package for the complete sound. Older application versions cannot interpret independent clip instruments.

Historical final gate: `npm run check:full` passed 28 unit tests and 16 Firefox/Chromium workflows without skips, including real WAV comparison, preset persistence and simulated MIDI.

## Load a complete section into Compose — 2026-10-25

- [x] A bilingual Arrange action activates the section's five clips and opens Compose without changing arrangement or mix.
- [x] Firefox/Chromium verify all five active clips and the Spanish action label.

Historical gate: 28 unit tests and 20 Firefox/Chromium workflows, no skips.

## Two decks in Live — 2026-10-26

- [x] Independent A/B AudioWorklets and playback, scratch, waveform, seek, speed, source BPM, Sync, filter and stutter controls.
- [x] File import, mix capture and microphone recording on both, with optional Audio Studio persistence.
- [x] Equal-power A/B crossfade and Program/Deck balance; Record Take captures the master including both decks.
- [x] Optional headphone Cue via browser `selectAudioOutput`/`setSinkId`, excluded from master recording. Unsupported separate-output routing disables the control with an explanation.
- [x] Side-by-side desktop and stacked small-screen layout with reachable crossfade. Tempo adjustment changes both speed and pitch.

Historical gate: `check:full` passed 28 unit tests and 21 Chromium/Firefox workflows. Simultaneous mixing and simulated Cue routing passed; physical headphone separation and real Safari/iPhone remained separate verification work.

## Reliability, composer and desktop speech — local work, 2026-10-28

Packages include deduplicated binary inventory, MIME manifest and takes, while retaining old ZIP imports. Missing sources can be relinked; export refuses required missing binaries. Scheduling/WAV share a tempo-aware clock; MIDI carries tempo/meter maps and sampled ramps. Instrumental and audio-lane stems are isolated. Global Solo/Mute/groups/automation and sidechain share evaluation. Corrupt autosave is preserved, pending edits flush on page hiding, and warnings appear across workspaces. DevTools traced the historical WAV stall to per-sample `getChannelData` calls; encoding now obtains each channel once. See `docs/RELIABILITY.md` for remaining live/offline differences.

Composer preserves octave degrees, uses pulse-window harmony and deterministic timing/gate variation, and offers optional Quality mode: three sequential inferences, local heuristic selection and retained proposals after cancellation/failure. No majority musical preference is established; blind listening remains pending.

Experimental desktop speech uses a separate Kokoro worker, ES/EN multilingual eSpeak, explicit downloads, managed caches, q8/FP32, audition/WAV, captured-lane/cursor insertion, v6 region provenance and Undo/Redo. Genuine ES/EN q8/FP32 generation/insertion/reload passed in Chromium. Desktop singing uses an independent companion; `docs/DESKTOP_VOCALS.md` records its inference, licenses and limits. Browser-only singing feasibility is a separate research question. See `docs/LOCAL_VOICE.md`; project memory records effective publication/version status.

Historical closure: `npm run check:full` exited 0 with typecheck/build/lint, 54 unit tests and 43 Chromium/Firefox workflows. Log: `/private/tmp/kiber-verified-check-full.log`. This does not establish blind-listening preference or browser-only singing feasibility.

## Authorized publication — 2026-10-28

The user requested updated memory, agent instructions and UX review, separate commits per improvement, push and deployment of the existing Site, preserving v6, the public audience and https://studio.suizman.org. The UX record is `UX_REVIEW.md`; perceptual acceptance and the browser-only singing research remained separate. Deployment outcomes were recorded after a terminal result.

Merge `e31a2c2` preserved remote refactor `43a2483`. The merged gate passed 56 unit tests and 43 Chromium/Firefox workflows. Distribution footer: `e31a2c2`.

Publication completed: Sites version 32, native status `succeeded`, Site source `bce68188ccd3a8771e4fd98b706ee2b5d2806170`, GitHub distribution `51b94c6`, footer `e31a2c2`. Existing audience/domain settings were preserved. Returned URL: https://kiber-vengance.starrylemur35.chatgpt.site. Later publications are recorded in project memory.

## Volume, audio FX and speech interpretation — 2026-10-28

Shared dB controls cover instruments, audio lanes, sampler, groups, decks and final output while preserving legacy Program values. Real stereo meters and a deck-inclusive final Master are implemented. Audio regions/lanes have independent non-destructive FX. Speech retains source assets and supports fragment pacing, treatment audition/download and an optional genuine expressive engine. Free-form Qwen direction remains gated on browser feasibility and has no decorative instruction field. Evidence and limits: `docs/AUDIO_MIX_AND_VOICE.md` and project memory.

### Current desktop speech policy

Speech and singing controls/modules load exclusively on desktop. Chatterbox is blocked when a computer reports 4 GB RAM or less; Kokoro q8 remains available on that computer with its text preserved. Model caches are separate from projects/audio. This admission policy does not guarantee available memory or physical-device performance.

## Native desktop singing — 2026-10-30

The approved native approach supersedes earlier browser-singing research statements. An optional loopback companion provides DiffSinger score singing and ACE-Step musical proposals through the existing audio workflow. Native Mac/Windows/Linux packages, including AppImage for Arch/Ubuntu, provide explicit model downloads/licenses, CPU/GPU profiles, pairing, cancellation, recovery and non-destructive effects/insertion. The studio stays static; generation controls load only on desktop; v6 assets/history/packages remain compatible. See [implementation, actual evidence and physical-device/listening limits](docs/DESKTOP_VOCALS.md). Native inference does not establish completed browser-only DiffSinger feasibility or perceptual superiority.
