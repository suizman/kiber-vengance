# Persistent project memory

This file is the operational memory for КИБЕР VENGANCE. It must be read alongside `kiber-vengance.md` before development continues. It records the product's actual state, established decisions, and user expectations; it does not replace the code or tests as the ultimate source of truth.

Last updated: 2026-10-25.

## Product intent

- КИБЕР VENGANCE is a professional music-composition workstation for cinematic electro-rock, industrial, synthwave, darksynth, and hybrid cyberpunk styles.
- The official display spelling is exactly **КИБЕР VENGANCE**: `КИБЕР` uses Cyrillic characters and `VENGANCE` uses Latin characters. Technical filenames and legacy storage keys retain `kiber-vengance` for compatibility.
- It should feel like a complete creative instrument, not a dashboard or musical toy.
- The default language is English; Spanish is available and the preference persists.
- The interface prioritizes speed, clarity, an aggressive character, and practical desktop use while retaining a functional mobile experience.

## Implemented product

### Composition and structure

- Five tracks: lead, guitar, bass, pad, and drums.
- Independent clips per track, each 1, 2, 4, or 8 bars long; the former practical limitation of a 12×13 grid no longer exists.
- Multi-octave piano roll, seven-piece drum sequencer, zoom, and grid resolutions from 1/64 to 1/4.
- Note editing through creation, drag, resize, velocity, duration, deletion, copy/paste, undo/redo, and quantization.
- Multiple selection with `Shift`, `Ctrl/Cmd+A`, and a rectangular mouse marquee; `Shift` adds to the current selection.
- Section-based arrangement with five clips, repeats, names, duplication, deletion, reordering, and automatic distribution.
- Key, scales, chords, riffs, bass lines, beats, Mutation, and a backing generator with 2–6 sections.
- The backing generator creates bass, pad, and drums in cinematic, driving, or dark styles while preserving guitar and lead.
- The v6 arrangement supports multi-selection, copy/paste/duplicate/delete, generated one-bar fills, zoom, named markers, exact timeline cursor placement, loop/punch regions, and serializable tempo/meter maps.
- Launch is a dedicated five-track clip matrix. Launches are beat/bar quantized, can stop one track independently, accept MIDI notes 36–63, and can be captured as new arrangement sections.

### Sound and performance

- Native Web Audio with stable look-ahead scheduling, explicit voice management, and persistent buses.
- Two-oscillator polyphonic synthesis, ADSR, LP/HP/BP filters, unison, detune, glide, panorama, and presets.
- Guitar through a plucked-string model with pick attack, harmonics, and body resonance.
- Synthesized drums with kick, snare, closed/open hat, tom, percussion, and crash.
- Arpeggiator, LFO, cutoff/volume/pan automation, and saturation, distortion, chorus, delay, reverb, tone/EQ, compression, and limiter effects.
- Six macros: energy, darkness, tension, aggression, space, and complexity.
- The arpeggiator, LFO, effects, and macros belong to the clip rather than globally to the track. Every clip preserves and exports its own character.
- Visual keyboard and QWERTY `A S D F G H J K`, quantized or free recording, metronome, count-in, swing, and 4/4, 3/4, and 6/8 time signatures.
- Web MIDI supports note-on/off, velocity, pitch bend, channel/poly pressure, and CC74/timbre when supported by the browser.
- Perform includes a dedicated Scratch Deck. It renders the active mix into a temporary 1/2/4/8-bar buffer, accepts direct local audio import through the browser's Web Audio codecs, and receives edited Audio Studio regions through `Load Deck`. It provides sample-interpolated bidirectional touch/mouse/keyboard scratching, waveform feedback, crossfader, filter, sync, brake, spinback, and tempo-derived stutter through an `AudioWorklet`.
- Audio Studio provides arbitrary non-destructive audio lanes and regions. Local files, microphone recordings, and committed Scratch Deck buffers support position, length, source offset, gain, fades, pitch, source BPM, reverse metadata, and rate-based tempo warp in live playback and offline WAV.
- Audio Studio also contains **Prism Keys**, a persistent chromatic sampler with a large multicolor 25-key keyboard, strong per-note light feedback, waveform, root note, trim, tuning, level, low-pass filter, attack/release, 1–24 voice polyphony, reverse, and gate/one-shot/loop modes. It is playable by touch/mouse, the full chromatic QWERTY row `A W S E D F T G Y H U J K`, and velocity-sensitive MIDI when armed; `Z/X` or the visible octave buttons move QWERTY between C3–C4 and C4–C5. Record Take captures its live master output.
- The Automation Lab stores global lanes with curve points and write-mode metadata, audible LFO modulation routes, and persistent MIDI CC Learn mappings. Musical transforms include retrograde, inversion, double/half time, and deterministic humanization.

### Mixing and isolation

- Per-track Mute and exclusive Solo: enabling Solo makes only that instrument audible; switching Solo transfers the isolation, and pressing it again restores the full mix.
- `Shift+S` toggles Solo on the active track. Unmodified `S` remains a musical key.
- `Shift+M` toggles Mute on the active track.
- Mutation was reassigned to `Shift+V` to avoid colliding with Mute.
- Typing in fields or in the `Ctrl/Cmd+K` palette never triggers notes or mixing shortcuts.
- Mix is a dedicated five-channel console with stereo RMS/peak metering, peak hold, approximate momentary LUFS, dB faders, pre-gain, pan, pre/post delay/reverb sends, Solo/Mute, customizable track colors, master FX bypass, and loudness-matched in-memory A/B comparison. Faders act at the persistent bus, so sustained voices respond immediately. Mixer edits participate in project undo/autosave.
- v6 adds mixer-group assignments, group levels, kick-triggered sidechain ducking, target-LUFS and ceiling controls, and a mono compatibility check.

### Transport and performance capture

- The global song locator and active-clip locator select an exact musical start position. Playback begins from the selected scene/repeat/step rather than always returning to zero; the Arrange timeline also sets the global locator.
- The dedicated Pause control preserves the active clip or global song playhead. Resume schedules imported audio from the matching source offset instead of restarting or dropping a region that began before the cursor. Audio view uses song-mode playback so its lanes sound from the global transport.
- `Perform` records the audible master in real time, including live notes, macros, mixer changes, launcher actions, and Scratch Deck output. Audio is persisted locally in IndexedDB, while the v6 project stores take metadata and an editable, quantizable event log.
- Takes can be trimmed, renamed, replayed, exported, or deleted. Individual automation events expose editable time/value and deletion; replay applies those edited events over the exact captured audio.

### Presets and local samples

- Preset Vault provides search, tags, favorites, user presets, and JSON bank import/export alongside the factory bank.
- Each of the seven drum voices accepts a private local audio sample with trim, semitone tuning, attack, release, and reverse. Blobs remain in IndexedDB; missing assets are reported and fall back to the synthesized kit.
- Project Package exports an uncompressed ZIP containing the v6 JSON and available local sample and Audio Studio assets.
- Prism Keys stores its source blob in IndexedDB and includes it in Project Package; plain JSON preserves only the sampler settings and asset reference.

### Projects and export

- Local autosave with v2/v3/v4/v5-to-v6 migration, templates, duplication, named and automatic recovery snapshots, restoration, and JSON/package import/export.
- Autosave updates `localStorage`; it does not modify previously downloaded files.
- Stereo WAV at 44.1, 48, or 96 kHz and type 1 MIDI can export the full song or the active clips. WAV and MIDI respect the arrangement, repeats, arpeggiators, automation, expression, and independent character of every clip.
- The header separates `EXPORT` from `EXPORT AS`: Export repeats the last recipe into its linked file, while Export As opens the format/destination dialog. `Ctrl/Cmd+E` exports and `Ctrl/Cmd+Shift+E` opens Export As.
- In browsers with the File System Access API, Export asks for a destination when none is linked and subsequently updates it. Export As always asks for a new destination. Handles can be inspected or forgotten in Project Core and are stored locally in IndexedDB.
- WAV supports 16-bit PCM or 32-bit float, 44.1/48/96 kHz, optional TPDF dither and peak normalization, configurable FX tail, dry rendering, and loop-region export. The cancellable stems queue exports any selected master/tracks plus a manifest and reports progress.
- Browsers without that API retain the safe download fallback and may add a suffix when a filename already exists.

### UX, identity, and accessibility

- Professional cyberpunk visual remaster with a multicolor palette, an original К/V signal-core vector emblem, Cyrillic/Latin wordmark, technical typography, high contrast, and a music-studio hierarchy.
- The emblem uses an open mechanical hexagon, fused К/V geometry, and an audio-signal incision. Header, boot, about, Performance Deck, Scratch Deck, favicon, and PWA icon share the same mark. Motion is restrained and honors `prefers-reduced-motion`.
- Forge, Launch, Audio, Arrange, Mix, and Perform views; Focus mode; collapsible racks with persistent state; command palette; contextual help for each control; manual; and interactive tutorial.
- Compact workspace density, 80–120% interface scaling, responsive breakpoints, and track colors persist without changing musical data. Wide editors scroll locally and the page must not gain global horizontal overflow.
- Mobile knobs with −/+ buttons and large touch targets.
- Responsive layout without global horizontal scrolling; wide subsystems deliberately use local scrolling.
- Focus, hover, active, disabled, loading, and error states; automated auditing with axe-core.
- Decorative horizontal lines that looked like visual artifacts were removed.

## Agreed shortcuts

- `Space`: play/stop.
- `A S D F G H J K`: performance/recording.
- In armed Prism Keys: `A W S E D F T G Y H U J K` plays a chromatic octave and `Z/X` moves it down/up.
- `1`–`5`: select track.
- `Ctrl/Cmd+K`: command palette.
- `Shift+S`: Solo the active track.
- `Shift+M`: Mute the active track.
- `Shift+V`: Mutation on the active clip.
- `Shift+F`: Focus mode.
- `Shift+G/A/P`: Forge/Arrange/Perform.
- `Shift+L`: Clip Launcher.
- `Shift+X`: Mix Console.
- `Ctrl/Cmd+E`: repeat the last export into its current destination.
- `Ctrl/Cmd+Shift+E`: open Export As to choose format and destination.
- `Shift+N/D/Q`: new clip, duplicate, and quantize.
- `Ctrl/Cmd+A/C/V`: select all, copy, and paste notes.
- Arrow keys: move selection; `Alt+←/→`: resize; `Delete/Backspace`: delete.
- `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`: undo/redo.

## Current architecture

- `src/model.ts`: serializable v6 hybrid project contracts.
- `src/core.ts`: music/audio model, migrations, clips, regions, automation, transforms, arrangement, generators, playback, and MIDI.
- `src/audio.ts`: hybrid Web Audio engine, voices, regions, buses, modulation, routing, scheduling, and offline WAV rendering.
- `src/scratch-worklet.ts`: off-main-thread bidirectional scratch buffer processor with interpolation, stutter, and live position reporting.
- `src/app.ts`: interaction, UI rendering, persistence, accessibility, commands, and export.
- `dist/`: distributable static application/PWA.
- No runtime dependencies or remote services. TypeScript, ESLint, Playwright, Selenium/geckodriver, and axe-core are development tools.

## Licensing

- The application source, build/test tooling, configuration, and generated application code are GPL-3.0-or-later; the full text and scope are in `LICENSE`.
- Musical works and project files in `projects/`, currently including **The Arrival**, are excluded from the software licence and use CC BY-NC-ND 4.0 under `projects/LICENSE.md`.
- The CC licence permits attributed, non-commercial redistribution of an unmodified project. Commercial use, remixes, adaptations, stems, synchronization, and altered distribution require prior written permission from КИБЕР VENGANCE.
- The КИБЕР VENGANCE name, logo, and other trademarks are not licensed by either file. Music created independently by application users remains outside this policy.

## Current validation

- `npm run check:full` is the mandatory quality gate.
- The mandatory final state is a clean `npm run check:full`, including the v6 Audio Studio workflow and 1366×768 density check.
- Coverage includes migration, serialization, editing, generators, arrangement, a ten-minute scheduler run, Solo, buses, metronome, MIDI export, Firefox with audio/WAV, and Chromium responsive/a11y/PWA/Prism Keys behavior.
- Export/Export As, reusable file handles, fallback downloads, local/global seek, the five-channel mixer, performance capture, Scratch Deck, and the full Firefox WAV workflow are covered.

## Deliberate and honest limitations

- Projects live in the browser; there are no accounts, backend, cloud, or remote collaboration.
- Clearing browser data can remove autosave: exported JSON is the portable backup.
- Web MIDI depends on browser support and user permission.
- Safari/iOS requires physical verification on Apple hardware.
- The guitar is an expressive synthetic instrument, not a multisampled acoustic library.
- There are no VST/AU plugins or commercial samples.
- Reusable export destinations require File System Access support. Unsupported browsers download a new revision; supported browsers may ask to renew write permission after a restart or browser-data cleanup.
- Scratch buffers remain temporary unless committed through `Resample Deck`; recorded performance audio persists in IndexedDB and its event data is serialized in v6. Editing events changes event replay; it does not retroactively re-synthesize the already captured compressed audio.
- MediaRecorder container/codec support is browser-dependent. Performance capture is normally WebM/Opus in Chromium; deterministic composition, local samples, and stem exports use WAV.
- Direct Scratch Deck import supports WAV plus MP3, OGG, WebM, and other formats only when the current browser exposes the corresponding decoder through `decodeAudioData`; unsupported codecs produce a visible error.
- Sample and Audio Studio blobs are device-local and are not embedded in plain JSON. Project Package is required to move them; if an asset is missing, the serialized edit remains but cannot sound until the blob is restored.
- Audio warp currently uses native playback-rate conversion. Tempo and pitch therefore move together; independent pitch-preserving time stretch would require a separate granular/phase-vocoder worklet and is not claimed by the current UI.
- `OfflineAudioContext` cannot interrupt DSP already in progress. Export cancellation is observed before and after each render and between selected stems, and prevents subsequent file writes; an individual stem already rendering must finish first.

## User collaboration preferences

- Implement autonomously and completely, avoiding partial deliveries.
- Third-party software may be used when it clearly improves the result.
- Fix real limitations instead of hiding them, and keep documentation honest.
- After implementing features, prioritize a fast UX, aggressive design, and professional quality.
- Keep the product bilingual, with English as the default language.
- Every new visible feature must work, include help where appropriate, and receive validation proportional to its risk.

## Rule for future sessions

Before modifying КИБЕР VENGANCE, read this file, `kiber-vengance.md`, `PRODUCT_PLAN.md`, and the current test state. If the code contradicts this memory, verify the behavior and update the documentation; do not perpetuate stale information.

## Sites mobile scrolling correction

- Mobile and tablet layouts through 820 px use document-level vertical scrolling, including at 80–120% UI scale. The app height follows its content; workspace clipping is horizontal only. The piano roll and horizontal control strips retain their own local scrolling.
- The Service Worker cache revision is v20-mobile-scroll.
- Validation: dedicated Chromium checks with touch gestures passed at 320/390/768/820 px and UI scales 0.8/1/1.2; the footer was reachable in each case. Desktop layout was checked at 1366 px with all three scales. Typecheck, build, lint and the unit-test command passed. The repository Firefox/Chromium E2E commands failed in this environment; no full-suite pass is claimed. Physical Safari/iOS validation remains outstanding.

## Composition-first usability update (2026-10-24)

- Clips is the default editing workspace; Sound reveals existing synth, motion, FX and macro racks. The four direct destinations are Clips, Sound, Arrange and Mix; Launcher, Audio Studio and Perform remain accessible through the main mode bar.
- Mobile through 820 px has a fixed transport and bottom navigation, 44 px primary controls, document scrolling and native device scale. Desktop retains the adjustable UI scale. Mobile scale selector is disabled with an explanation.
- A context strip identifies track, clip and bars and explains note recording versus audio takes. The piano roll has Draw, Select (tap to toggle notes) and Navigate (scroll without editing) tools. Music generation/harmony is disclosed on demand. New clip and Undo are directly available by the editor.
- Export presents complete project package, audio and MIDI first. Advanced rendering options, other formats and linked destinations remain available in disclosure panels.
- Autosave writes the current project before optional recovery snapshots. Failures display a persistent local-save warning; failed recovery snapshots do not block the project save. Duplication, generation and quantization offer Undo feedback.
- Validation: typecheck/build/lint/unit-test command passed. Dedicated real Chromium workflows passed at widths 390, 768 and 1366: create/duplicate/undo clips, draw/select/navigate, export disclosures, quota-failure feedback, transport visibility and absence of horizontal overflow. Existing full E2E suite still fails in this environment; Safari/iOS physical verification remains pending.

## Touch editing and usability completion (2026-10-24)

- Selection actions duplicate, quantize or delete only selected notes. Duplication selects the copies and refuses overflow with an instruction to extend the clip. Quantization uses the current snap grid.
- Undo feedback now covers clip creation/variation/deletion, note deletion, selection edits, backing generation and clearing automation. Toast timers no longer dismiss newer feedback early.
- Automation is collapsed until requested. Shared controls and dialogs have larger text and touch targets; mobile inputs use 16 px text to avoid focus zoom.
- Forge, Perform and Prism piano keys use `touch-action: manipulation` to suppress double-tap zoom while retaining browser pinch zoom. Forge/Perform track separate pointer IDs and release held voices on pointer cancellation, lost capture, blur and page hiding.
- Validation: `npm run check` passed. Dedicated Chromium workflows passed at 390/768/1366 px, including selected-note actions and Undo, automation disclosure, repeated touch taps without scale changes, blur voice release, all six views without horizontal document overflow, export and autosave-error feedback. `npm run check:full` could not complete: its configured Playwright browser and Firefox binary are absent. Physical iPhone/Safari validation remains outstanding.

## Mobile note release and position sliders

- Cancel pending live-note initialization when a finger is released before audio initialization finishes. Global pointer release/cancel also clears held keys.
- Mobile song/clip position ranges flex across the remaining width instead of retaining the native input width.
- Typecheck, build, lint and core tests passed; physical iPhone verification remains pending.

## Precision touch dials

- Dials support continuous captured pointer dragging: vertical movement spans the range in 300 px, horizontal movement is five times finer; Shift adds desktop precision. Other fingers cannot interrupt a dial gesture. Release, cancellation, lost capture and blur clean up the gesture. Plus/minus remain available.
- Dial and scratch surfaces own touch gestures; Perform buttons/ranges suppress double-tap zoom without disabling page pinch zoom. Physical iOS validation remains outstanding.

## Audio transport and Scratch Deck sources (2026-10-25)

- Audio Studio now stays in song mode when the global Play control is pressed, fixing imported regions that were visible but silent.
- A dedicated Pause button stores the current clip/song cursor. Resuming inside a running audio region derives the correct source offset, remaining length and fade state.
- Every Audio Studio region has `Load Deck` / `Al plato`; its temporary scratch buffer applies source offset, region length, lane/region gain, fades, pitch/tempo rate and reverse.
- Perform adds direct local Scratch Deck import for browser-decodable WAV, MP3, OGG, WebM and related audio formats. The deck buffer remains temporary and non-destructive.
- Service Worker cache revision is `v25-audio-scratch-pause`.
- Validation: `npm run check:full` passed with 26 core tests and all 10 Chromium/Firefox functional workflows, including Audio Studio import/play/pause/resume and both Scratch Deck loading paths.

## Scratch input and controls

Microphone capture loads a temporary scratch buffer, stops playback after capture, releases microphone tracks and limits recording to 60 seconds. Stutter supports whole-note divisions 1/1–1/64. Motor speed (with pitch change), reverse and restart are available. UX_REVIEW.md records observed inconsistencies and proposed work, not completed global standardization.

## Consistency and waveform seeking

Scratch waveform supports touch/mouse seeking and keyboard arrows/Home/End without starting paused audio. Seeking clears stutter. Keep in project persists a scratch copy as an audio region. Shared control typography/targets/focus states and bilingual main action labels are applied. Audio additions and several creation operations now snapshot history. Tempo/meter use validated cancelable dialogs. See UX_REVIEW.md for implementation boundaries. Dedicated Chromium simulated-microphone, waveform seek and save workflow passed; check passed; physical Safari remains unverified.

## Studio interface refactor (2026-10-25)

The approved four-workspace interface is implemented using Vite, a Preact shell and shared keyboards/dials/dialogs. Ten feature controllers preserve the music workflows and project schema v6. Signal KV is the selected SVG identity. Common typography, focus/disabled states, inspector, bilingual catalog and pointer lifecycles replace the previous navigation/control patches. Hidden panels render on demand; inactive animations stop and waveform envelopes are cached. Native edit prompts are replaced by validated cancelable dialogs. See `docs/REFACTOR.md` for feature parity, implementation decisions, performance evidence and real-device limits. Earlier descriptions of Forge/Audio/Perform as top-level tabs describe the previous interface.

Final refactor validation: `node scripts/with-null-audio.mjs npm run check:full` passed, including 12/12 Chromium/Firefox workflows with no skips. Hardware input/output and physical Safari remain unverified. Initial DOM is 1,342 nodes versus the 1,790-node local baseline. Full evidence and limitations: `docs/REFACTOR.md`.

## Neon visual restoration (2026-10-25)

The studio keeps the four-workspace layout while restoring a stronger cyberpunk identity. Shared tokens now use a blue-black base and brighter cyan, magenta, amber, lime and violet accents. Navigation and track cards have clear active states; headers, the piano roll, keyboards, launcher, mixer and Scratch Deck use restrained gradients or glows. The changes are CSS-only and do not alter audio, touch behavior, project files or storage. See `docs/DESIGN.md` for color semantics.

## Scratch Deck module loading correction (2026-10-25)

Scratch Deck loads Vite-transformed source in development and a Vite-bundled, hashed processor URL in production. The former document-relative `./scratch-worklet.js` request returned the HTML fallback in development, producing Firefox's `expected expression, got '<'` error on import and mix capture. Development must avoid the classic worker wrapper because AudioWorklet has no `importScripts`. Firefox regression tests cover both actions from fresh pages against development and production servers. Project data and audio processing are unchanged.

Resumed validation after the interrupted session: `npm run check:full` passed on 2026-10-25 with 26 core tests and 14 Chromium/Firefox workflows, with no skips. Firefox independently initialized the deck through local WAV import and Capture Mix in development and production. The static build and offline cache include the hashed processor. Tests required execution outside the restricted process sandbox; this host used its existing audio service, without the optional PulseAudio null-sink wrapper. Physical sound output was not assessed.


## Instrument presets per clip (2026-10-25)

Each clip now stores `instrument`: preset, oscillator waves/mix, filter, ADSR, glide, unison and detune. Sound edits and factory/user preset loading affect the active clip only. Level, pan, mute, solo, pre-gain, sends and routing remain on the track; loading a preset never overwrites them, including older user banks containing mixer fields. New clips and duplicates inherit independent instrument copies; generated backing clips and fills inherit their source instrument. Autosave, history, snapshots, JSON and packages retain the settings.

This is an additive v6 field. Loading v2–v6 projects without it copies the old track instrument into each clip, preserving the existing sound. Legacy track instrument fields remain readable for compatibility but no longer drive normalized clips. New files require this application revision to reproduce different instruments per clip; older builds ignore the field. Live keys, clip playback, launcher, arrangement, Scratch Capture Mix and offline WAV/stems resolve the sounding clip's instrument. Voices retain their instrument snapshot, including release, when the clip or preset changes. Global cutoff automation applies to the resolved voice without overwriting saved clip settings. MIDI Learn cutoff edits the active clip instrument; MIDI volume/pan mappings still target the track.

Live effects still use the existing persistent bus per track: switching presets does not rebuild it or clear delay/reverb buffers, but changes to clip effects can color an existing tail. Fully isolated live effect tails per clip are not implemented. MIDI exports notes/expression, not these custom synthesizer patches; use WAV or a project/package to preserve the sound.

Validation: `npm run check:full` passed with 28 core tests and 16 Chromium/Firefox workflows, without skips. New coverage verifies v2–v6 migration, independent copies, song/active-clip scheduling, cutoff automation, preset switching and history, new-clip inheritance, reload, saving/importing user banks without mixer changes, simulated MIDI CC cutoff isolation, real offline WAV segment comparisons and live held-voice envelope retention. Physical MIDI/audio hardware remains unverified.


## Local clip play/pause (2026-10-25)

The clip locator button toggles between `▶ CLIP` and `Ⅱ PAUSE` (`Ⅱ PAUSA` in Spanish). During clip playback it pauses through the shared transport, retaining the clip cursor; pressing it again resumes there. Its visible state, accessible label and help follow global play/pause/stop and language changes. While song playback is running it remains a clip-start action and switches to clip playback, preserving the previous behavior. Startup disables the local button until audio initialization completes to prevent duplicate starts. This controls the active-clip mix, not a solo of the selected track.

Validation: `npm run check:full` passed with 28 core tests and 18 Chromium/Firefox workflows, no skips. Both browsers verify local pause, stable paused cursor, resume from that cursor, synchronization with global transport and switching from song to clip playback.
