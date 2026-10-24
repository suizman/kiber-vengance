# Persistent project memory

This file is the operational memory for КИБЕР VENGANCE. It must be read alongside `kiber-vengance.md` before development continues. It records the product's actual state, established decisions, and user expectations; it does not replace the code or tests as the ultimate source of truth.

Last updated: 2026-10-23.

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
- Perform includes a dedicated Scratch Deck. It renders the active mix into a temporary 1/2/4/8-bar buffer and provides sample-interpolated bidirectional touch/mouse/keyboard scratching, waveform feedback, crossfader, filter, sync, brake, spinback, and tempo-derived stutter through an `AudioWorklet`.
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
