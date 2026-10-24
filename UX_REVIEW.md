# UX consistency review

Code review, 2026-10-25. This is a prioritized proposal, not a claim that the whole UI has been standardized.

| Priority | Observed inconsistency | Proposed change |
|---|---|---|
| High | Transport, live takes, input recording and the Scratch Deck expose different play/stop/pause/capture states. | Give each source explicit Ready / Playing / Paused / Recording / Processing states; reserve Record for live input and Capture for mix rendering. |
| High | Some edits expose Undo feedback while tempo/meter insertion and audio-lane creation do not follow the same history flow. | Audit each project mutation and standardize snapshot + Undo; keep live performance controls separate. |
| High | Scratch buffers are temporary while imported Audio assets are persisted. | Show temporary status and offer a direct Keep in project action next to each loaded sample. |
| Medium | Typography is overridden with panel-specific selectors; uppercase headings coexist with sentence-case actions and small legacy labels. | Use shared text tokens: body 14–16 px, secondary 12–13 px, labels 12–14 px; reserve uppercase for short section headings. |
| Medium | Buttons use different heights and selector exclusions; file import uses labels instead of the same button component. | Standardize primary/secondary/destructive/icon variants, 44 px touch targets and common disabled/busy/focus states. |
| Medium | Main mode bar and mobile destination bar overlap; Sound is a Forge substate while Arrange/Mix are views. | Make navigation hierarchy explicit and preserve per-view scroll and state. |
| Medium | Tempo and meter editing use native prompts; exports use dialogs; other edits are inline. | Replace prompts with consistent validated dialogs and cancellation behavior. |
| Medium | Several dynamic recording and utility strings are hardcoded instead of using bilingual copy. | Centralize labels and ensure language changes update active control states. |

## Scratch additions in this delivery

Microphone capture (browser permission, no live monitoring, maximum 60 seconds, device tracks released on stop/page exit), selectable stutter divisions 1/1–1/64, motor speed 0.5–1.5×, reverse and restart. Horizontal/vertical platter behavior remains available. Releasing scratch returns to the chosen motor speed and direction. New microphone buffers stop after loading to avoid unexpected playback. Scratch data remains temporary until resampled into Audio.

## Further professional features proposed

Multiple named hot cues, loop in/out with quantization, slip mode, adjustable crossfader curve and cut-in, momentary cut pads, waveform zoom and sample trimming. These need persistent deck state and dedicated audio regression tests; they are not included in this delivery.

Validation: typecheck/build/lint/core tests passed. A dedicated Chromium mobile test passed using a simulated microphone: capture, decode/load, stopped state, stutter, reverse, restart and document width. This does not verify physical microphones or Safari. The general E2E command was also attempted; its result must be considered separately.
