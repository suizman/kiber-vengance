# Persistent project memory

This file is the operational memory for Kiber Vengance. It must be read alongside `kiber-vengance.md` before development continues. It records the product's actual state, established decisions, and user expectations; it does not replace the code or tests as the ultimate source of truth.

Last updated: 2026-10-23.

## Product intent

- Kiber Vengance is a professional music-composition workstation for cinematic electro-rock, industrial, synthwave, darksynth, and hybrid cyberpunk styles.
- The official spelling is exactly **Kiber Vengance** and must not be corrected.
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

### Mixing and isolation

- Per-track Mute and exclusive Solo: enabling Solo makes only that instrument audible; switching Solo transfers the isolation, and pressing it again restores the full mix.
- `Shift+S` toggles Solo on the active track. Unmodified `S` remains a musical key.
- `Shift+M` toggles Mute on the active track.
- Mutation was reassigned to `Shift+V` to avoid colliding with Mute.
- Typing in fields or in the `Ctrl/Cmd+K` palette never triggers notes or mixing shortcuts.

### Projects and export

- Local autosave with v2/v3-to-v4 project migration, demo and empty projects, duplication, named snapshots, restoration, and JSON import/export.
- Autosave updates `localStorage`; it does not modify previously downloaded files.
- Stereo WAV at 44.1 kHz and type 1 MIDI can export the full song or the active clips. WAV and MIDI respect the arrangement, repeats, arpeggiators, automation, expression, and independent character of every clip.
- The header provides quick full-song WAV/MIDI exports and a JSON project copy. `EXPORT` retains the advanced options.
- Every quick export creates a file from the current state. The browser may add a suffix if a file already exists; automatic overwriting of the previous file is not promised.

### UX, identity, and accessibility

- Professional cyberpunk visual remaster with a multicolor palette, an original KV vector logo, technical typography, high contrast, and a music-studio hierarchy.
- Forge, Arrange, and Perform views; Focus mode; collapsible racks with persistent state; command palette; contextual help for each control; manual; and interactive tutorial.
- Mobile knobs with −/+ buttons and large touch targets.
- Responsive layout without global horizontal scrolling; wide subsystems deliberately use local scrolling.
- Focus, hover, active, disabled, loading, and error states; automated auditing with axe-core.
- Decorative horizontal lines that looked like visual artifacts were removed.

## Agreed shortcuts

- `Space`: play/stop.
- `A S D F G H J K`: performance/recording.
- `1`–`5`: select track.
- `Ctrl/Cmd+K`: command palette.
- `Shift+S`: Solo the active track.
- `Shift+M`: Mute the active track.
- `Shift+V`: Mutation on the active clip.
- `Shift+F`: Focus mode.
- `Shift+G/A/P`: Forge/Arrange/Perform.
- `Shift+N/D/Q`: new clip, duplicate, and quantize.
- `Ctrl/Cmd+A/C/V`: select all, copy, and paste notes.
- Arrow keys: move selection; `Alt+←/→`: resize; `Delete/Backspace`: delete.
- `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`: undo/redo.

## Current architecture

- `src/model.ts`: serializable v4 project contracts.
- `src/core.ts`: music model, migrations, clips, arrangement, generators, playback, and MIDI.
- `src/audio.ts`: Web Audio engine, voices, buses, scheduling, and offline WAV rendering.
- `src/app.ts`: interaction, UI rendering, persistence, accessibility, commands, and export.
- `dist/`: distributable static application/PWA.
- No runtime dependencies or remote services. TypeScript, ESLint, Playwright, Selenium/geckodriver, and axe-core are development tools.

## Licensing

- The application source, build/test tooling, configuration, and generated application code are GPL-3.0-or-later; the full text and scope are in `LICENSE`.
- Musical works and project files in `projects/`, currently including **The Arrival**, are excluded from the software licence and use CC BY-NC-ND 4.0 under `projects/LICENSE.md`.
- The CC licence permits attributed, non-commercial redistribution of an unmodified project. Commercial use, remixes, adaptations, stems, synchronization, and altered distribution require prior written permission from Kiber Vengance.
- The Kiber Vengance name, logo, and other trademarks are not licensed by either file. Music created independently by application users remains outside this policy.

## Current validation

- `npm run check:full` is the mandatory quality gate.
- Known state when this memory was created: 20 unit tests and 4 browser suites/flows passing.
- Coverage includes migration, serialization, editing, generators, arrangement, a ten-minute scheduler run, Solo, buses, metronome, MIDI export, Firefox with audio/WAV, and Chromium responsive/a11y/PWA behavior.
- Quick MIDI/JSON buttons are tested as real downloads; WAV uses the full renderer already covered by the Firefox flow.

## Deliberate and honest limitations

- Projects live in the browser; there are no accounts, backend, cloud, or remote collaboration.
- Clearing browser data can remove autosave: exported JSON is the portable backup.
- Web MIDI depends on browser support and user permission.
- Safari/iOS requires physical verification on Apple hardware.
- The guitar is an expressive synthetic instrument, not a multisampled acoustic library.
- There are no VST/AU plugins or commercial samples.
- Quick export downloads a current revision; it cannot silently overwrite a previous file because of the browser security model.

## User collaboration preferences

- Implement autonomously and completely, avoiding partial deliveries.
- Third-party software may be used when it clearly improves the result.
- Fix real limitations instead of hiding them, and keep documentation honest.
- After implementing features, prioritize a fast UX, aggressive design, and professional quality.
- Keep the product bilingual, with English as the default language.
- Every new visible feature must work, include help where appropriate, and receive validation proportional to its risk.

## Rule for future sessions

Before modifying Kiber Vengance, read this file, `kiber-vengance.md`, `PRODUCT_PLAN.md`, and the current test state. If the code contradicts this memory, verify the behavior and update the documentation; do not perpetuate stale information.
