# Compatibility, privacy and licenses

[English](Compatibility-and-licenses.md) | [Español](ES-Compatibility-and-licenses.md)

## Connections and permissions

The static app processes music locally: no studio account is required and projects/prompts/audio are not sent to an inference service. Initial app loading, URL catalogs and explicit model downloads do contact their servers. This repository and its installers require an authorized GitHub account.

The PWA supports installation and offline use after initial loading. Optional models have separate caches and do not download during normal startup. Audio, projects and models can be removed independently when storage is cleared.

| Area | Practical limit |
| --- | --- |
| Web Audio | Requires an initial gesture; physical output/input needs separate testing |
| Web MIDI / microphone | Depends on APIs, permissions and hardware |
| MP3/OGG/WebM import | Depends on decodeAudioData codecs; unsupported files show an error |
| Linked export files | File System Access is not universal; normal downloads are the fallback |
| Separate Cue output | Requires output selection/routing and may be disabled |
| Local AI | Automatic probes GPU and can fall back to CPU; page GPU alone proves little |
| Safari/Orion | Automated WebKit does not certify physical browsers. Cold offline worker startup can fail; load before disconnecting |
| Speech and singing | Desktop features; acceleration depends on runtime/provider and actual hardware |
| Warp / FX / LUFS | Warp changes pitch, live/offline is not bit identical, LUFS-M is approximate |

**Compatibility report**, in Project, displays/copies capabilities, status and sample rate without telemetry. Chromium/Firefox tests, fixtures, real inference, listening and hardware measurements are separate evidence.

## Licensing

Software is **GPL-3.0-or-later**. Included compositions in `projects/`, including **The Arrival**, are excluded: **CC BY-NC-ND 4.0**, without automatic permission for remixes, stems, synchronization or commercial use. This does not claim rights to independently created user compositions or grant rights to the КИБЕР VENGANCE brand.

Models, banks and vocoders have independent terms. Kaiz includes a CC-BY-NC 4.0 vocoder and is not presented as cleared for commercial music. Review terms before downloading/importing. Native packages do not include model weights.

[Software license](../../LICENSE) · [Included compositions](../../projects/LICENSE.md) · [Companion third-party notices](../../companion/THIRD_PARTY.md).
