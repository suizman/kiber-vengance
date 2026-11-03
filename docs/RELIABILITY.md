# Reliability update — local, 2026-10-28

The project contract remains v6 and retains v2–v5 imports. The old v5 reference in AGENTS.md was corrected against the model, migrations and delivered product.

## Portable binary assets

`projectAssets()` enumerates samples, sampler, audio regions and recorded takes by persistent identifier, deduplicating shared references. New packages include `assets.json` version 1 with an explicit path and MIME type per asset. ZIP import validates entry bounds/checksums, restores the same IDs and MIME types, and still reads the previous samples/sampler/audio layout. A new package fails visibly if a referenced binary is absent; it never silently calls an incomplete archive a complete backup.

On loading/importing a project, missing assets open a relinking dialog. Each replacement is stored under the original ID. WAV/stems/package preflight blocks missing sources; plain JSON remains available. Complete packages require the entire inventory. Composition WAV requires only participating audible audio regions and used drum slots in the selected range; missing unrelated takes or inactive sampler sources do not block it. Unavailable or undecodable participating sources fail visibly instead of silently falling back to synthesis or omitting a region.

## Clock, mixer and exports

`projectSeconds` integrates BPM jumps and linear ramps; the scheduler, note durations and offline event times share it. Region exports preserve the absolute tempo-map origin. MIDI includes tempo and meter events, discretizing ramps every quarter step. Its timing is an approximation; MIDI does not contain native synth patches or recorded audio.

Global source Solo/Mute spans instrumental and audio tracks, with group Solo/Mute/volume. Persistent live audio-lane output gains let those changes and faders affect regions already playing; silent lanes keep their source position for a mid-region unmute, and output nodes disconnect on stop/seek. Shared evaluation drives track volume/pan/cutoff, modulation and master automation; kick sidechain uses a shared release envelope. Pan and cutoff are evaluated when voices start; continuous movement of an already sustained voice is not claimed. Offline master gain, target compression threshold, ceiling and mono check follow the project settings.

Instrument stems explicitly remove audio lanes. Audio lanes have individual selectable stems and filenames with lane IDs, so duplicate names cannot overwrite each other. Active-clip renders exclude arrangement audio. Audio regions extending beyond the last instrumental section extend the song transport/export without repeating or modifying that section's clips.

Live track buses retain effect tails across clip changes; offline clip buses are separate. Random drum/noise/reverb processes and tail/truncation behavior also differ. This delivery improves common timing/mix evaluation; it does not claim bit-identical live/offline waveforms or complete bus-topology equivalence. Native playback-rate warp still couples pitch and speed and does not continuously time-stretch through a tempo ramp.

## WAV stall diagnosis

A Chromium DevTools pause located the busy renderer in WAV sample encoding, repeatedly calling `AudioBuffer.getChannelData()` inside the per-sample loop. Channel views are now fetched once before encoding. A regression checks stereo PCM/clipping and exactly two channel-view reads. The previous multi-minute busy-renderer reproduction and the corrected Scratch/export workflow are distinct from an `OfflineAudioContext` processing timeout.

Empty renders return silence without starting unused feedback/convolution graphs. Instrumental offline FX stages are allocated only when enabled; bypass/dry omit all processors. On browsers supporting offline suspend/resume, two-second scheduling windows bound connected per-note nodes, and completed voices are disconnected after their releases. Clip FX outputs stop being pulled after eight extra seconds of silence; chorus/delay/reverb tails remain within that guard. The 256-point distortion curve is symmetric around zero, preventing a DC output from a silent input.

UI states distinguish preparing, processing and encoding. Native rendering progress refreshes at offline checkpoints. Default failure detection measures 45 seconds without audio-clock progress rather than a fixed total render duration; explicit renderTimeoutMs remains a total deadline for diagnostics. Cancellation prevents encoding/writes and stops resuming at the next checkpoint. Browsers without suspend/resume (including the tested Firefox version) retain full scheduling and cannot interrupt native DSP already started. No immediate internal/native DSP interruption is claimed.

OGG is genuine Ogg/Vorbis, encoded with pinned wasm-media-encoders 0.7.0 in a dedicated worker. PCM moves one bounded block at a time, encoder output is copied before reuse, and worker termination cancels compression. Finalization transfers owned encoded bytes to the window, which validates the container header and creates the downloadable Blob; no worker-owned Blob is retained after termination. Requests/replies carry IDs, startup errors are captured before normalization yields, and failures identify loading, compression or finalization. Compression remains below 100% until the completed file is delivered. Quality q1/q4/q8, normalization and clipping are explicit; WAV bit depth/dither do not affect OGG. The local WASM asset is precached with the studio, without a CDN or MediaRecorder dependency. Third-party notices are distributed in public/third-party-audio-notices.txt. Compressed files reduce storage/transfer cost; rendering is still required.

## Recovery

Unreadable autosaves are copied to a timestamped `-unreadable-` localStorage key before trying a legacy project or demo. If the copy cannot be stored, the original stays untouched and autosave is blocked; JSON export is still available. Pending saves flush on `visibilitychange`/`pagehide`. Storage failures are shown in a warning shared across all workspaces. Failure to store export preferences cannot undo a successful file write. Asset writes await IndexedDB transaction completion.

Touch/Latch/Write are absent from the new-lane mode selector because recording those modes is not implemented. Existing serialized writeMode values are retained; point editing/Read remains available.

## Verification boundaries

Pure musical/model/encoding tests, real browser workflows and real neural inference are separate forms of evidence. Package browser coverage checks bytes/MIME/IDs in a fresh context, relinking, and playback APIs using valid WAV fixtures. No physical speakers, microphone or native Safari/Orion claim is made. Current command results and unresolved acceptance work are recorded in PROJECT_MEMORY.md.

## Studio 7 — current contract (2026-11-03)

The approved v7 model supersedes the historical v6-only constraint. Projects v2–v6 migrate; existing tracks, clips, sounds and binary references remain. Instrument tracks are dynamic. New score import/review retains originals and all parts, supports acoustic playback and optional local PDF/image recognition, and commits insertion as one undoable edit.

Project data now saves through a serialized IndexedDB worker, with metadata-only recovery lists and a small emergency delta journal. Corrupt canonical saves are quarantined before recovery. Piano-roll notes, ruler labels and automation bars render only the visible window; selection remains in the model. Tempo integration is compiled per edit; inactive distortion/saturation curves are reused. WAV encoding is cancellable in a worker with a device memory guard; OGG and windowed rendering from Site 38 remain available.

Track rails, launcher and mixer support additional channels through contained scrolling. Shared 12 px metadata and 44 px touch controls improve readability; mobile text/number inputs use 16 px to avoid focus zoom. Existing keyboards/dials, four workspaces, shortcuts and cyberpunk colors are retained. Score review provides local progress, cancel/retry, draft recovery, audio audition, editable notes/tempo/meter, bounded notation and corrected MusicXML export. Third-party parser diagnostics may retain their source language; Studio controls/notices are EN/ES.

See `docs/STUDIO_V7_DELIVERY.md` for actual checks and performance measurements, and `docs/SCORE_IMPORT.md` for OMR/model/instrument licensing, memory bounds and physical-device limits. Browser emulation and one printed fixture do not establish perfect recognition or testing on a physical iPhone/M3/Radeon system.

## Browser-injected errors and held notes (2026-11-03)

The global error channel includes native browser scripts as well as Studio code. Brave iOS uses a Firefox-derived `window.__firefox__` namespace for Playlist. Its [native long-press handler](https://github.com/brave/brave-core/blob/0591697dc55159979d7250e5f51c217d199472fb/ios/brave-ios/Sources/Brave/Frontend/Browser/Helpers/PlaylistTabHelper.swift#L243) invokes the callback named in the user's screenshot; the associated [injected Playlist script](https://github.com/brave/brave-core/blob/0591697dc55159979d7250e5f51c217d199472fb/ios/brave-ios/Sources/Brave/Frontend/UserContent/UserScripts/Scripts_Dynamic/Scripts/Paged/PlaylistScript.js) defines the long-press/document-load hooks. This identifies the long-press exception, but does not prove the origin of the separate opaque startup error.

`src/ui/page-errors.ts` classifies only those exact known callback signatures as browser errors. Same-origin application script locations take precedence. A bare `Script error.` with no source, coordinates or error object is unattributed; informative errors and unhandled rejections still reach the Studio error notice. Every global event retains a bounded local diagnostic record, exported only through the existing explicit compatibility-report action. The handler does not cancel the browser's default console reporting or replace its native bridge. This corrects attribution and user feedback; it does not repair Brave's internal Playlist implementation.

The shared keyboard cancels `contextmenu` on its playing surface and disables callouts/text selection on the surface and key labels. Labels pass pointer hits to their key. This covers Compose, Live, sampler and drum adapters, without blocking native menus in project text fields. Existing pointer-up/cancel/lost-capture/navigation cleanup remains responsible for releasing notes.

`tests/browser-errors.test.js` exercises a real cross-origin script failure, the reported native signature, genuine application errors and rejections, compatibility-report retention, and sustained/released notes on three keyboard adapters at 390×844. Chromium uses actual CDP touch events; Firefox and optional WebKit use pointer presses in a touch-capable viewport. Synthetic Playlist events test handling of the observed exception, not native Brave injection. Linux WebKit and mobile emulation do not substitute for physical iPhone/Brave verification.

The supplemental WebKit keyboard check covers Compose and Live. Its attempted sampler setup failed before playback with native IndexedDB `UnknownError: Error preparing Blob/File data to be stored in object store`, matching [Playwright #42795](https://github.com/microsoft/playwright/issues/42795); using a browser-created File did not resolve it in this environment. Sampler holds remain verified in Chromium/Firefox with actual WAV decoding, IndexedDB storage and audio playback. WebKit sampler/import coverage remains open; no application storage workaround or mocked success was added for this tooling limitation.
