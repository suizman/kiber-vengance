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

## Implemented consistency pass
Shared 14 px control typography, 12 px secondary labels, 44 px action targets and common focus/pressed/disabled styling now apply across studio panels. Main scratch and creation actions use sentence-case bilingual labels. Deck play/pause wording now matches its position-preserving behavior. The waveform supports pointer seeking and Home/End/arrows while retaining play state and clearing active stutter. A Keep in project action saves temporary deck audio into Audio. Audio import/record placement, audio-lane creation, automation/modulation insertion and mono-check now participate in history; creation actions expose Undo feedback. Tempo/meter insertion uses one validated dialog with cancellation instead of native prompts.

Remaining depth: this pass does not replace every legacy control with a shared component, migrate every dynamic string to a central catalog, or restructure the two navigation bars. Those architectural items remain a follow-up rather than a claim of full application-wide parity.

## Studio interface refactor (2026-10-25)

The approved four-workspace interface is implemented using Vite, a Preact shell and shared keyboards/dials/dialogs. Ten feature controllers preserve the music workflows and project schema v6. Signal KV is the selected SVG identity. Common typography, focus/disabled states, inspector, bilingual catalog and pointer lifecycles replace the previous navigation/control patches. Hidden panels render on demand; inactive animations stop and waveform envelopes are cached. Native edit prompts are replaced by validated cancelable dialogs. See `docs/REFACTOR.md` for feature parity, implementation decisions, performance evidence and real-device limits. Earlier descriptions of Forge/Audio/Perform as top-level tabs describe the previous interface.


## Reliability, contextual composition and speech review — 2026-10-28

The four-workspace interface remains the current design. This review covers the implemented local update and its verified limits; publication status is recorded in PROJECT_MEMORY.md.

| Workflow | Implemented UX | Evidence / remaining limit |
|---|---|---|
| Project portability | A complete package includes drum/sampler/region/take assets once, with persistent IDs and MIME types. Missing files have a relinking dialog; JSON remains available for recovery. | Fresh browser import checked original bytes/types/IDs, including a missing take and relinking. Native browser decoding can still reject unsupported audio. |
| Export confidence | Shared clock for tempo changes, tempo/meter MIDI events, isolated instrumental/audio stems and visible preparation/processing/encoding states. WAV encoder reads each channel once. | Real WAV/Scratch render flows pass. Live FX tails and offline clip buses are not claimed bit-identical; native offline DSP cannot be forcibly stopped. |
| Sustained audio mixing | Audio-lane output buses apply Solo/Mute/faders while an existing region keeps its position. Audio-only tails extend the song without repeating the instrumental section. | Real Chromium bus transitions and model/transport regressions pass; no physical speaker claim. |
| Recovery | Corrupt autosave is preserved before fallback; pending edits flush on hide/pagehide. Storage warnings are mounted in the shared shell across workspaces. | Corrupt data, immediate reload and quota failure were exercised; JSON remains exportable. |
| Automation honesty | Only Read point editing is offered for newly created lanes. Imported Touch/Latch/Write values remain in the data. | Automation recording modes are still not implemented and are not presented as working choices. |
| Contextual AI | Motif octaves survive compilation; rhythm/gates vary within exact density constraints; accompaniment preferences use pulse windows. Optional Quality uses three sequential model calls and local ranking; fast mode stays one call. | Structural/musical tests and cancellation pass. Blind before/after preference is still pending; three authored-plan A/B pairs were prepared as evaluation material. |
| Speech discovery and insertion | Arrange → Audio & sampler → VOICE · ES/EN opens one bilingual dialog: explicit download, language/voice/speed/precision, preview, WAV, captured-lane/cursor insertion and new region versions. | Desktop/mobile overflow and accessibility checks pass. User found the action after reloading localhost:8080; no additional top-level workspace or musical shortcut was added. |
| Speech lifecycle | Cancel retains the prior result; Free memory terminates the model worker; Delete downloads targets voice caches. Melody and speech cannot infer simultaneously. | Real ES/EN q8 and FP32 generation, insert/Undo/Redo/reload and retained-worker offline Spanish inference passed. The user judged one Spanish q8/Dora phrase intelligible and usable. |
| Accessible keys | Visible note and shortcut text agree with the shared keyboard's accessible names. | Full-deck axe audit passes; pointer and musical bindings are preserved. |

Acceptance remains deliberately open for broad pronunciation testing, a blind q8/FP32 preference, blind musical-majority preference, cold-offline speech startup, native Safari/Orion and physical audio hardware. DiffSinger singing has no product control: bank/vocoder permissions, real browser inference, alignment/pitch/memory and intelligible sung samples remain research work. A functional test pass does not replace those gates.

Validation: the current delivery passed `npm run check:full` with 54 unit tests and 43 Chromium/Firefox workflows. Protocol fixtures are identified separately from genuine model runs in `docs/LOCAL_VOICE.md` and `docs/LOCAL_AI.md`.
