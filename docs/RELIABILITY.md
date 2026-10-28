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

Empty renders return a silent WAV without starting unused feedback/convolution graphs. UI states distinguish preparing, processing and encoding, and offline processing has a 45-second wait limit. Cancellation/timeouts can stop waiting and prevent a file write; the browser cannot terminate native offline DSP that is already running. No internal/native DSP interruption is claimed.

## Recovery

Unreadable autosaves are copied to a timestamped `-unreadable-` localStorage key before trying a legacy project or demo. If the copy cannot be stored, the original stays untouched and autosave is blocked; JSON export is still available. Pending saves flush on `visibilitychange`/`pagehide`. Storage failures are shown in a warning shared across all workspaces. Failure to store export preferences cannot undo a successful file write. Asset writes await IndexedDB transaction completion.

Touch/Latch/Write are absent from the new-lane mode selector because recording those modes is not implemented. Existing serialized writeMode values are retained; point editing/Read remains available.

## Verification boundaries

Pure musical/model/encoding tests, real browser workflows and real neural inference are separate forms of evidence. Package browser coverage checks bytes/MIME/IDs in a fresh context, relinking, and playback APIs using valid WAV fixtures. No physical speakers, microphone or native Safari/Orion claim is made. Current command results and unresolved acceptance work are recorded in PROJECT_MEMORY.md.
