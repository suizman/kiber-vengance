# Audio mixing, region effects and expressive speech

## Levels and compatibility

The v6 project remains readable with additive `outputMix`, audio-lane `preGainDb`/`effects`, region `effects` and speech provenance. Imports without these fields default to unity final/deck/Cue gain, preview gain 0.7 and neutral effects. Existing `project.master`, its MIDI/performance events and `master.volume` automation retain their stored values and now explicitly describe **Program**. Older app versions ignore the new fields.

Signal path:

- Instruments: envelope → track input gain → existing musical FX/sends → track/group level → Program.
- Audio regions: region gain/fades → independent region FX → lane input gain → lane FX → lane pan → lane/group level → Program.
- Sampler: envelope/velocity → shared sampler level → Program. Changing its level also affects held voices.
- Program tone/compression → Program/deck blend; A/B levels and equal-power crossfade → final sum → final Master → safety compression → speakers and performance recording.
- Cue has its own level and separate destination, independent of the Master. Preview has its own level multiplied by final Master/mute and goes to speakers without entering recording or export.

Global Solo/Mute covers instrumental and audio lanes; group gain is applied once. Input gain now precedes effects, instead of being multiplied into the output fader. Consequently driven/compressed sounds can change when an old project's nonzero pre-gain was previously acting after effects. Moving safety compression after the deck sum also deliberately corrects the old deck bypass. Default clean audio regions retain a neutral path. Native dynamics processing is not a guaranteed true-peak brickwall limiter.

Common dB controls offer exact silence, unity reset, numeric editing, keyboard adjustment and Shift fine adjustment. Pointer capture handles cancel/blur/lost capture. A gesture records one history snapshot. Header Master opens a compact popover; Mix and Live expose the same persisted final/deck/Cue settings. Program remains accessible in Mix. Real stereo sample meters replace the old pan-derived instrument approximation; dBFS peaks are distinct from fader settings. Hidden views do not animate meters.

## Non-destructive audio effects

Audio Studio's shared Clip/Track effect editor applies filter, brightness, compression, saturation, distortion, chorus, delay and reverb in that fixed order. Individual on/off, whole-chain Original/Processed and reset preserve sources. Presets are Clean, Voice presence, Radio, Megaphone, Cyberpunk and Ambience. The same editor is used by audio lanes in Mix and by speech before insertion.

`AudioFx` is shared by live playback and OfflineAudioContext rendering. Each overlapping region has its own chain. Lane chains persist for sustained edits. Neutral chains allocate no oscillator/convolver/processor stages; enabled stages are created lazily and disposed after their tail. A deterministic stereo impulse is shared between the two paths. Stop/seek clears source/FX lifetimes; a normal region ending retains a 2.5-second tail. Offline exports retain the selected export-tail limit. Dry exports omit region/lane effects. Existing instrumental random excitation and live-track/offline-clip topology remain separate documented parity limits.

Generated voices preserve the original WAV. Inserting copies the selected treatment to the region; download offers original and processed WAV separately. Settings, bypass and routing travel in JSON/history/autosave/Project Package; weights never do.

## Desktop local voice engines

Desktop voice controls are loaded on demand. Kokoro is the lightweight WASM/CPU option. Its revision is pinned at `1939ad2a8e416c0acfeecc08a694d14ef25f2231`. One text line is one fragment; each fragment has independent speed and following silence. The existing 500-character/500-token safeguards and ES/EN phonemizer remain. This is pacing control, not native emotional instruction following.

The optional Chatterbox experiment uses the MIT ONNX tensor protocol, independently implemented without copying the differently licensed Quick Inference application:

- Multilingual LM/token embeddings/tokenizer: `onnx-community/chatterbox-multilingual-ONNX`, revision `452d3f434aa592098f1eedac9099f33642ab2da5`.
- Int4 decoder: `danyalmalik/Chatterbox-ONNX-WebGPU`, revision `54eb255c95ea64ea502f5efddb8a9869de30687f`.
- Multilingual default voice vector: `danyalmalik/Chatterbox-Multilingual-ONNX-WebGPU`, revision `b37cca40a5510b9525ca429a6f0af90f9557655e`.
- Approximately 568 MB model bytes, plus the pinned ONNX Runtime Web WASM/runtime (CPU: JSEP; WebGPU: JSPI or Asyncify according to worker support). The large optional WASM is fetched from the versioned jsDelivr package and cached after explicit model load, instead of exceeding Sites' per-asset limit or becoming an initial PWA download.

The public adapter declares supported language/fragment/intensity/instruction capabilities. The published selector exposes CPU only. The experimental WebGPU worker path loaded its graphs and produced tokens in Chromium software WebGPU after selecting the matching JSPI runtime, but did not complete a phrase within the 300-second test limit. It is not offered as a working product backend. Chatterbox offers restrained/natural/emphatic intensity, not named emotions or arbitrary instructions. Greedy decoding uses repetition penalty, bounded sentence generation and visible progress. Overlong phrases fail rather than silently inserting truncated audio. CPU can take minutes. Cancellation terminates the worker; model switching is explicit. Cache failures can leave an online model usable but do not establish offline availability. Model caches, stored music assets and project JSON remain separate lifecycles.

A genuine first test exposed a Transformers tokenizer mismatch: the JSON template's symbolic BOS/EOS/START_SPEECH strings became unknown tokens. The numeric template is now applied explicitly, checked against the reference tokenizer, rather than accepting near-silent model output as a pass. Kokoro's token files are loaded explicitly from its pinned revision as well.

Qwen3-TTS 1.7B CustomVoice supports natural-language style direction in its official Python workflow. Its official revision exposes safetensors assets, not a validated complete ORT Web pipeline for this app. No Python server, cloud inference or cosmetic instructions box substitutes for that missing browser validation. Free-form style direction and singing are not shipped by this change.

## Verification

The tests distinguish DSP/reference signals, browser protocol fixtures and genuine model runs. `tests/mixing-browser.test.js` checks neutral processing, effect changes/tails, persisted audio levels/effects across desktop and compact layouts, actual deck silence under final Master and exclusion of preview from the recorded mix. `scripts/test-local-voice.mjs` remains opt-in for real Kokoro.

`VOICE_MODEL_MIRROR` optionally supplies byte-for-byte downloaded model files for real tests; it never supplies generated outputs. Files retain `<model>/<revision>/<file>` layout. Browser inference still runs the real model. Audition samples and measured generation times are session artifacts, not product demos or a claim of superior pronunciation. Genuine CPU outputs for the same Spanish sentence at intensities 0.3/0.8 have different audio hashes and durations (2.48/2.28 seconds); the English sample is 1.56 seconds. These establish working generation and parameter influence, not human preference or a certified emotion.

Physical desktop Safari/Orion, speakers/headphones and microphone hardware need separate validation. CPU/WebGPU availability is not a promise of equal speed, low memory or cold-offline startup on every device. Successful PCM generation does not certify naturalness or emotional interpretation.

Primary references: [Kokoro voices](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md), [Chatterbox ONNX protocol](https://huggingface.co/onnx-community/chatterbox-multilingual-ONNX), [WebGPU decoder](https://huggingface.co/danyalmalik/Chatterbox-ONNX-WebGPU), [multilingual voice vector](https://huggingface.co/danyalmalik/Chatterbox-Multilingual-ONNX-WebGPU), [Qwen instructions](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice).


### Desktop memory policy

Chatterbox requires a desktop computer that does not report 4 GB RAM or less. A lower-memory computer can select Kokoro q8 while keeping its text. Large-file caching avoids unread cloned responses, runtime blob URLs are released, and cancellation terminates the worker. The policy does not establish available free memory or certify physical-device performance.
