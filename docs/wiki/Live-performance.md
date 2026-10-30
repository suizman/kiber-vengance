# Live performance

[English](Live-performance.md) | [Español](ES-Live-performance.md)

## Clip launcher

**Live → Clip launcher** provides a five-track matrix. Queue clips on beats/bars, stop tracks separately and use MIDI notes **36–63** for visible cells. **Capture** records the launch sequence; **Commit to Arrange** makes editable sections.

## Two Scratch Decks

**Live → Performance deck** contains independent Deck A/B, each using an AudioWorklet. Import local audio, record input or capture 1, 2, 4 or 8 bars of the active mix. Shorter clips repeat to fill the capture.

Each deck provides waveform/playhead, seeking, playback, bidirectional reading, speed, source BPM, Sync, filter, stutter, brake and spinback. Use mouse, touch, wheel/trackpad or platter keyboard controls; releasing the platter smoothly restores its motor.

The equal-power crossfader balances A/B. **Program/Deck** blends the song with the decks. Sync adjusts speed and pitch to the project tempo; it does not preserve the original pitch.

**Cue A/B** can route to a separate headphone output when the browser supports output selection/routing; otherwise it is disabled. Simulated Cue tests do not certify physical headphone separation.

## Record a performance

**Record Take** captures the audible master, including both decks, and stores audio plus an event log. Takes support trim, quantization, retiming, editing/deleting events and replay. Event edits do not re-synthesize the captured waveform.

Recording normally uses **WebM/Opus**, depending on MediaRecorder. Cue and previews are excluded. Save the take or include it in Project Package.

Deck buffers are temporary: reloading clears them unless kept as regions. Song WAV export renders the arrangement; use Record Take for a live scratching session.

[Mixing](Mixing.md) · [Projects and export](Projects-and-export.md).
