# Projects and export

## Save and recover

The current format is **v6**, with v2–v5 import compatibility. Project provides cinematic/minimal/performance/hybrid-audio templates, project duplication, named snapshots, automatic recovery and JSON/Project Package import/export.

Autosave uses localStorage; pending edits flush when hiding/leaving the page. Quota/save failures are visible in all workspaces. Unreadable autosaves are preserved before recovery; preservation failure prevents silent overwrite.

Three independent lifecycles matter:

| Data | Storage | Useful backup |
| --- | --- | --- |
| Structure, clips and settings | Project JSON / localStorage | JSON or Package |
| Samples, regions and take audio | Browser IndexedDB | **Project Package** |
| Optional model weights/runtime | Browser cache or companion user data | Manage through the engine; excluded from Package |

Package includes deduplicated references with IDs, MIME types and an asset manifest, retaining drum samples, Prism Keys, regions and takes. Missing binaries can be relinked; JSON remains available for recovery. Package creation refuses missing binaries. Clearing site data can remove audio: JSON is not a sample backup.

## Output formats

| Format | Uses and options |
| --- | --- |
| WAV | Song/arrangement and loaded audio; 16-bit PCM or 32-bit float, 44.1/48/96 kHz, TPDF dither, normalization, dry/wet, tail and loop region |
| Stems ZIP | Selected tracks and manifest; isolated instruments and individual audio lanes |
| MIDI | Notes/expression and tempo/meter maps; ramps discretized at quarter-step intervals. No samples, audio or synth patches |
| JSON | Editable model and provenance, without audio blobs |
| Project Package | Project plus all available referenced binaries |
| Record Take | Deck-inclusive live performance, normally WebM/Opus |

**Export** repeats the linked format/destination; **Export As** chooses another. Project manages remembered destinations by format. Without File System Access, normal downloads are used; compatible browsers may request permission again.

## Duration, cancellation and sources

Export reports missing required sources; an unrelated take does not block a song WAV. The shared clock applies tempo/swing maps. Audio tails can extend duration without restarting the instrumental arrangement.

Stem queues show progress and support cancellation between renders. OfflineAudioContext DSP cannot be interrupted once rendering starts. Song WAV does not capture live scratching: use Record Take.

[Technical reliability](../RELIABILITY.md) · [Compatibility](Compatibility-and-licenses.md).
