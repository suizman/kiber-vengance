# Local voice — implementation and research status

Implementation and browser evidence, 2026-10-28. Actual publication status and the deployed version are recorded in PROJECT_MEMORY.md.

## Speech workflow

Arrange → Audio & sampler → **VOICE · ES/EN** opens Kokoro speech. Select language, voice, speed (0.6–1.5), q8 or FP32, then explicitly load/download. The current voice choices are English Heart/Michael and Spanish Dora/Alex. Enter up to 500 characters; overlong tokenized phrases fail visibly instead of being silently truncated. Listen or download WAV before choosing **Insert as audio region**.

Generation captures the selected audio lane and song locator/playhead when it starts. Insertion checks that the same project/lane still exists. New-lane insertion and each subsequent insertion create new region IDs; they never replace an earlier version. PCM is stored as WAV in IndexedDB. The v6 region retains model ID, text, language, voice, speed, precision, phonemes and creation time under additive `generation` metadata. Undo/Redo, autosave, reload and Project Package use the existing region/asset path. Moving through a song's final audio-only tail does not restart instrumental clips.

The independent worker uses the existing pinned Transformers.js/ONNX WASM runtime and Kokoro 82M. eSpeak's multilingual Emscripten distribution supplies Spanish and English IPA locally. Spanish /r/ and /x/ are not passed through English-specific replacements. The original `kokoro-js` wrapper's English normalizer/voice restrictions were not silently reused. The initial `phonemizer@1.2.1` experiment was removed after a real browser run proved that its packaged language data was English-only.

Model/runtime/voice/phoneme caches are separate from projects. Initial weights are approximately 90 MB q8 or 330 MB FP32, plus voices, phoneme data (~23 MB) and runtime. Free memory terminates the worker; Cancel terminates pending inference and retains the previous result; Delete downloads removes this feature's caches. Speech and melody share an inference lock, so a second heavy operation fails visibly while one is running. No text/audio is sent to an inference service. Downloads contact Hugging Face; the bundled phoneme/runtime assets come from the app's own origin.

Offline generation with a retained loaded worker is the intended path. Cold offline startup is browser-dependent and must be tested separately. Browser storage eviction can remove model downloads or musical assets independently. Package assets are a backup of generated audio, not of model weights. Physical audio, pronunciation preference and low-memory devices remain manual validation concerns.

## Real inference evidence

`scripts/test-local-voice.mjs` is opt-in and downloads real weights; normal browser tests use a clearly labeled worker protocol fixture for UI/state behavior.

The final q8 smoke also passed genuine retained-worker Spanish inference with the browser offline.

Real Chromium runs generated **different audio bytes** for English/Spanish in q8 and FP32, and passed insertion, Undo/Redo and reload. On this host, q8 took about 11.9 s English / 11.3 s Spanish; FP32 took about 23.3 s / 13.2 s. Samples are at `/private/tmp/kiber-voice-samples/{en,es}-{q8,fp32}.wav` for this session; they are not packaged product demos or committed recordings. The first attempted Spanish smoke accidentally read the prior preview; it was corrected to wait for a new audio URL, and a subsequent real failure revealed the English-only phonemizer before the multilingual fix.

The user auditioned the Spanish q8/Dora sample and confirmed that it is intelligible and usable. This is evidence for one phrase and listener; English, broader Spanish coverage and a blind precision comparison remain separate acceptance work.

Successful waveform generation does not certify intelligibility or superior quality. q8 is the smaller preview default; it has not won a blind listening comparison. Both precisions remain selectable for that comparison. No perceptual winner, majority listening preference or native Safari/Orion/physical-speaker result is claimed.

## Singing: research pending, no product control

The [official DiffSinger deployment guide](https://github.com/openvpi/DiffSinger/blob/main/docs/GettingStarted.md#deployment) exports variance/acoustic models and an NSF-HiFiGAN vocoder to ONNX. It does not provide proof that a complete voicebank, phoneme pipeline and vocoder run in ONNX Runtime Web with acceptable memory and alignment. The [official community vocoder page](https://openvpi.github.io/vocoders/) also carries separate distribution terms. An acoustic model license cannot be assumed to license every voicebank and vocoder.

No suitable ES/EN bank plus vocoder has been verified in this browser workflow. No real DiffSinger inference, sung samples, melisma/alignment score or browser-memory measurement was produced in this delivery. Consequently singing is not exposed in the UI and must not be described as implemented or as a completed feasibility experiment. No local plugin, server or external inference service was substituted.

The next experiment needs an explicitly permitted bank/vocoder with exact model revisions and input/output signatures. Test one short monophonic phrase with syllable-to-note mapping, a held syllable over multiple notes, silence and tempo changes; measure real browser load/peak memory, duration error and pitch error, and audition ES/EN intelligibility. Retain WAV/phoneme/score evidence. Publish only after that gate passes. The existing speech result (PCM/sample rate/generation metadata → persisted WAV region) supplies the intended insertion contract, but does not establish singing feasibility.

## Sources and third-party code

- [Kokoro JavaScript source](https://github.com/hexgrad/kokoro/tree/main/kokoro.js), [model/voice descriptions](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) and [ONNX conversion](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX): Kokoro model identity and style-vector/token interface; weights have Apache-2.0 terms.
- [eSpeak Emscripten package and source](https://github.com/echogarden-project/espeak-ng-emscripten), [underlying fork/build instructions](https://github.com/echogarden-project/espeak-ng/tree/fork): pinned package 0.3.5, GPL-3.0, bundled phoneme data; the project remains GPL-3.0-or-later. The dependency's COPYING/source/build information remain available there and in the installed package.
- [Transformers.js](https://github.com/huggingface/transformers.js): existing pinned local inference runtime.
