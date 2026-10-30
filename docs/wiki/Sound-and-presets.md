# Sound and presets

## Instruments and character

| Instrument | Controls and uses |
| --- | --- |
| Lead, bass and pad | Oscillators, waveforms, ADSR, filter/cutoff/resonance, unison, detune, glide and pan |
| Guitar | Synthetic plucked string: pick attack, harmonics and body resonance |
| Drums | Kick, snare, closed/open hats, tom, percussion and crash; synthesis or local samples |

**Sound** opens the shared inspector. Presets and instrument parameters belong **to each clip**. Switching clips restores its sound, arp, LFO, effects and six macros: energy, darkness, tension, aggression, space and complexity.

Sound processing includes distortion, saturation, chorus, delay, reverb and tone/EQ. Racks collapse; Focus hides secondary controls. Dials support dragging, Shift fine adjustment, keyboard and −/+ buttons. Channel level, pan and routing stay on the track when loading a preset.

## Preset Vault and catalogs

Vault supports search, tags, favorites, user sounds and JSON bank import/export. The bundled catalog adds melody recipes and native patches, including Scarlett Protocol / Scarlett Razor. Recipes prepare the generator; sounds work without loading AI.

Import JSON catalogs from disk or HTTPS URLs with CORS: up to **1 MB and 256 entries**. Imported catalogs last for the session; explicitly save sounds in Vault to keep them. AI recipes use a separate library.

**Vital, Surge XT and Serum** patches require those synthesizers. External discovery links do not convert patches or grant redistribution rights. Included presets work without access to the private repository.

## Drum samples and sampler

The seven **Impact Sample Slots** support trim, tuning, attack/release, reverse, transient detection and distributing slices across free pads. Samples participate in live playback and offline WAV. Use [Prism Keys](Arrangement-and-audio.md) to play a sample chromatically.

Blobs live in IndexedDB and travel in Project Package. MIDI exports notes, not synth patches.

[Technical catalog format](../PRESET_CATALOG.md). Live instrumental FX buses are shared per track: subsequent settings can color earlier effect tails.
