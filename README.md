# Kiber Vengance

The complete specification is in [`kiber-vengance.md`](kiber-vengance.md), the product status is in [`PRODUCT_PLAN.md`](PRODUCT_PLAN.md), and persistent memory for future sessions is in [`PROJECT_MEMORY.md`](PROJECT_MEMORY.md).

Kiber Vengance is a cinematic electro-rock composition instrument that runs entirely in the browser. It combines five music engines—lead, modeled guitar, bass, pad, and a seven-piece drum kit—with independent clips, a multi-octave piano roll, arranger, automation, performance, recording, Web MIDI, and full-song export.

## Installation and use

Node.js 20 or later is required for the server and tests. The published application is static and has no runtime dependencies, accounts, telemetry, or secrets.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`. Web Audio requires a user gesture: press Play or touch a key to activate it.

To validate the complete product:

```bash
npm run check:full
```

`check:full` compiles the entire runtime with strict TypeScript, runs lint, 20 unit tests, the static build, a real Firefox flow with audio, sustained voices, and WAV, and four browser flows covering responsiveness, accessibility, PWA behavior, shortcuts, and downloads. Install the Playwright browsers with `npx playwright install chromium` if they are not already available.

## Creating a song

1. Select a track in the sidebar or with `1`–`5`.
2. Choose or create an independent clip. Each clip can have 1, 2, 4, or 8 bars and a resolution from 1/64 to 1/4.
3. Add notes in the piano roll, drag them to move them, and use the right handle to change their duration. Drag over empty space to select multiple notes with a marquee; `Shift` adds the marquee to the existing selection. The drums provide kick, snare, closed/open hat, tom, percussion, and crash.
4. Adjust the two oscillators, ADSR, filter, unison, detune, glide, panorama, LFO, arpeggiator, and effects. The guitar uses a plucked-string model with pick attack, harmonics, and body resonance; its presets genuinely change the engine, not merely its name.
5. Draw cutoff, volume, or panorama automation below the piano roll.
6. Use key, scale, chords, riffs, bass lines, beats, quantization, and Mutation to generate controlled musical material.
7. Use `Backing` to create two to six sections of bass, pad, and drums in cinematic, driving, or dark styles while preserving your guitar and lead clips. In Arrange, you can later reassign any clip, set repeats, and reorder sections with buttons or drag-and-drop.
8. Use the quick header buttons to export the complete song directly to WAV or MIDI, or create a JSON copy of the project. Export retains the advanced options for the song or active clips.

The transport supports 50–220 BPM, 4/4, 3/4, and 6/8 time signatures, swing, metronome, and a one- or two-bar count-in. Changing the time signature remaps note and automation positions to preserve the musical shape of the clips.

## Performance and editing

- `Space`: play/stop.
- `A S D F G H J K`: play or record with the computer keyboard.
- `1`–`5`: select track.
- `Ctrl/Cmd + K`: open the command palette with keyboard search and execution.
- `Shift + F`: toggle Focus, which hides the advanced racks and brings the editor to the foreground.
- `Shift + S`: toggle Solo on the selected track without interfering with the musical `S` key.
- `Shift + M`: mute/unmute the selected track.
- `Shift + V`: mutate the active clip (formerly `Shift + M`).
- `Shift + G/A/P`: open Forge, Arrange, or Perform.
- `Shift + N/D/V/Q`: create, duplicate, mutate, or quantize the active clip.
- `Shift + click`: multiple selection.
- `Ctrl/Cmd + A`, `C`, `V`: select, copy, and paste notes.
- Arrow keys: move the selection; `Alt + ←/→`: resize; `Shift` increases the step.
- `Delete`/`Backspace`: delete; `Ctrl/Cmd + Z` and `Ctrl/Cmd + Shift + Z`: undo/redo.

The visual keyboard responds to mouse and touch, sustaining voices until the key is released. Web MIDI records note-on, note-off, velocity, and per-channel expression: pitch bend, channel/poly pressure, and CC74 timbre; drum mapping follows the usual GM notes. The recording selector provides quantized or free mode: the latter preserves microtiming and sub-step durations, while `Quantize` can align them afterward.

Every clip preserves its own **character**: the Motion Engine arpeggiator and LFO, Signal Processing bypass and complete effect chain, and the six Vector Control macros. When switching clips, all three racks restore their independent values; duplicating or mutating a clip copies its character, while creating a new one starts from the active character. The base synthesizer and channel volume/pan remain instrument/track settings.

Each track card includes `S` (**Solo**) and `M` (**Mute**). Solo is exclusive: enabling it makes only that instrument audible, switches buses immediately even with sustained voices, and restores the complete mix when pressed again. It can also be enabled on the selected track by searching for `Solo` in `Ctrl/Cmd + K`. The state is respected when exporting WAV.

The synthesis, motion, effects, and macro racks can be collapsed independently; their state persists locally. On mobile, secondary racks start collapsed and tracks appear in a horizontal strip for faster access to the piano roll, without removing any controls. Knobs support vertical/horizontal dragging with increased range, fine adjustment with `Shift`, keyboard control, and touch-friendly `− / +` buttons. The project menu remains available on small screens.

Every track retains at least one clip. The `⌫` button deletes the active clip after a confirmation that identifies which sections use it; those references are automatically reassigned to another clip on the track, and the entire operation supports undo/redo.

The Spectral Deck interface uses track color-coding, a clear panel hierarchy, and highly legible illuminated states within a cyberpunk aesthetic. It avoids overlaid line textures, keeping the background clean and stable across displays with different pixel densities.

## Languages, tutorial, and help

The interface starts in English and can switch to Spanish using the `EN/ES` selector; on mobile, the same selector is available in the project menu. The preference is stored locally. Translation covers navigation, editing, arrangement, macros, commands, tutorial, dialogs, and accessible descriptions.

`Guide` starts a seven-step visual tutorial covering transport, tracks, synthesis, piano roll, arrangement, performance, and quick tools. The `?` button enables contextual help: focusing, touching, or hovering over any control reveals its purpose. All controls, including dynamically generated ones, also receive an accessible description.

## Projects and recovery

Versioned autosave is stored in `localStorage`. The project menu can create a demo, start from an empty project, duplicate the project, create up to 20 named snapshots, restore them, and export/import JSON. The v4 migration automatically converts v2/v3 projects and copies their former track/project settings into each clip's character without losing the previous sound.

## Architecture

- `src/core.ts`: v4 music model, migration, clips with independent character, harmony, generation, automation, arranger, history, and expressive MIDI.
- `src/audio.ts`: look-ahead scheduler, polyphonic and sustained/MPE dual-oscillator voices, plucked-string guitar, drum synth, five persistent FX buses, master, analyzer, and offline WAV.
- `src/app.ts`: UI state, piano roll, free/quantized recording, MIDI, versions, diagnostics, export, and editing flows.
- `src/model.ts`: strict serializable contract. `npm run build` compiles all four modules into `dist/`.
- `tests/`: model, migrations, ten-minute transport, MIDI, Firefox, Chromium, accessibility, and responsiveness.

The scheduler programs 120 ms ahead and wakes every 25 ms. If a tab is suspended, it discards stale time rather than firing delayed events. Each track maintains one bus with independent saturation and distortion, tonal EQ, chorus, delay, and reverb; temporary voices disconnect when they end. The master adds EQ, compression, and limiting, preventing the graph growth that caused the former audio cutoff.

Offline WAV renders the arrangement, loops, automation, and independent character of every clip—arpeggiator, LFO, macros, and effects—as well as modeled guitar, dual oscillator, unison, ADSR, and drums. MIDI contains one tempo/time-signature track and five music tracks; it materializes the arpeggiator as notes, while effects and timbral macros remain exclusive to the audio render.

## Compatibility, PWA, accessibility, and limitations

The app includes a manifest and Service Worker for installation and offline use after the first load. The `Compatibility report` menu item displays and copies capabilities, status, and sample rate without telemetry. The suite is verified in headless Firefox and Chromium. The interface provides visible focus, accessible labels, high contrast, reduced motion, and a mobile layout without horizontal overflow; detailed editing remains optimized for desktop.

There are no runtime dependencies: only standard browser APIs. Web MIDI depends on support and permission; Safari/iOS still requires manual verification on Apple hardware. The guitar is an expressive synthesized model, not an acoustic sample library. Plugins, cloud storage, and multi-user collaboration are not included: they would require licenses or external services and are deliberately excluded to preserve quality, local privacy, and static distribution.

## Licensing

Kiber Vengance source code is licensed under [GPL-3.0-or-later](LICENSE).
This applies to the application source, tooling, tests, configuration, and
generated application code as defined in that file.

Musical compositions and project files in [`projects/`](projects/), including
**The Arrival**, are expressly excluded from the software licence. They are
licensed under [CC BY-NC-ND 4.0](projects/LICENSE.md): unmodified,
attributed, non-commercial sharing is allowed; commercial use, remixes,
adaptations, stems, synchronization, and distribution of altered versions
require prior written permission from Kiber Vengance.

This policy does not claim ownership of music independently created by users
with the application. It does not grant any trademark rights in the Kiber
Vengance name, logo, or other brand assets.
