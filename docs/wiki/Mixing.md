# Mixing

[English](Mixing.md) | [Español](ES-Mixing.md)

## Channels and buses

Mix combines instrumental tracks and audio lanes. Set pre-gain, dB fader, pan, color, Solo/Mute, groups and pre/post sends. **Solo is exclusive**; disabling it restores the mix. Changes affect sustained voices/regions and exported renders.

Stereo meters show RMS/peak, peak hold and dBFS signal level. Fader dB is a gain setting, not a measured signal level. Shared controls provide exact silence, unity reset, numeric entry and fine adjustment.

Routing includes groups and kick-triggered sidechain ducking. **Master FX** bypasses processing; **Mono** checks compatibility. Target LUFS and ceiling assist finishing, with approximate momentary LUFS and loudness-matched A/B comparison.

## Program, decks, Master and Cue

- **Program** controls the composition and its audio tracks.
- A/B levels and crossfader control the decks; Program/Deck sets their balance with the composition.
- **Master** controls the final sum sent to speakers and Record Take.
- **Preview** has its own level; it is audible but excluded from recording/export.
- **Cue** has a separate level/destination when browser routing supports it.

Header Master, Mix and Live share persisted values. Region/lane effects are non-destructive and support Original/Processed and the corresponding dry/wet workflows.

## Result limitations

The limiter provides dynamic protection, not guaranteed true-peak brickwall limiting. LUFS-M is approximate. Live buses and offline rendering are not bit identical: track/clip tails, random excitation, reverberation and some note-on parameters can differ.

Instrument stems isolate instruments; audio lanes have individual stems. Capture deck-inclusive live output with Record Take.

[Export](Projects-and-export.md) · [Technical DSP/evidence](../AUDIO_MIX_AND_VOICE.md).
