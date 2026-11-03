# Score import and local optical recognition — Studio 7

Compose → **Import score** opens a review workspace. Nothing is inserted into the song until **Insert all reviewed sections**. Original files, the reviewed musical data and corrected MusicXML are retained as separate project assets and included in Project Package. Plain JSON keeps references only.

## Supported inputs

| Input | Interpretation |
| --- | --- |
| MusicXML / XML / compressed MXL | All parts, staves and voices; ties, repeats, tempo and meter changes; concert pitch for transposing instruments |
| Standard MIDI 0 / 1 / 2 | Tracks split by channel/program; overlapping attacks and sustain; format 2 becomes independent sections |
| Guitar Pro 3–8 / GPX | AlphaTab-supported notation, converted to performed note events |
| ABC | Multiple tunes and voices, repetitions and fractional tuplet timing |
| PDF / PNG / JPEG | Optional local optical recognition, one reviewed page at a time |

For MuseScore, Sibelius, Finale, Dorico or Noteflight, export MusicXML first. Native proprietary project formats are not parsed. MIDI controller curves/device messages are retained in the original file but are not converted into Studio automation. SMPTE MIDI is placed against a 120 BPM clock to preserve absolute timing. Unsupported engraving, expressive articulations and handwriting can require corrections; this is not a facsimile engraver or guaranteed transcription service.

## Review and editing

Choose each section and part. Rename parts, assign a General MIDI instrument or a Studio synth, split staves into separate tracks, merge parts, transpose, add/delete notes, or edit pitch, timing, velocity, staff and voice. Times are quarter-note beats; fractional values are preserved. Review tempo and meter changes, use Undo/Redo, hear the selected part for up to 30 seconds, and view eight bars of notation at a time. Export corrected MusicXML per section. Rendering a short excerpt avoids engraving the entire score on the main thread.

Insertion is one undoable edit. Every part receives an independent track, clip and mixer channel. Matching part identity/name/instrument across successive pages reuses its track with a new section clip. Pre-existing sections keep their original track assignments. The five original instruments remain available for compatibility. **Add instrument** and **Edit track** support additional tracks, names, order and removal of added tracks.

Review drafts autosave on the device. **Resume saved review** restores the last completed review and its source. **Project sources** reopens previous imported material for another review/import; it does not silently overwrite edited arrangement clips. Closing while a page is being recognized cancels that page; completed recognized pages and completed download chunks remain available.

## Local reader

Partsong / homr-rs is the maintained successor used here instead of an unvalidated browser port of oemer. PDF.js rasterizes one page. The worker segments it, recognizes each staff and returns MusicXML. The user can rotate, crop and provide system ranges, then correct recognition errors before insertion. Pages become ordered sections. Unknown instruments default to piano; automatic grouping may merge two instruments and must be reviewed/split.

The three pinned models total **157,482,318 bytes (150.2 MiB)** and are downloaded only after the explicit reader action. Downloads are cached in resumable 4 MiB pieces and verified against SHA-256. Cancellation terminates the worker; each page starts a fresh worker/WASM heap. Phones use CPU/WASM, one inference job at a time; desktop WebGPU is an optional attempt with CPU fallback. Starting recognition frees idle melody/speech models without deleting their downloaded cache. An active generation task must finish or be cancelled first.

Scores and recordings are not uploaded. The only remote reader requests are GET requests to the pinned public model URLs in `public/omr/models.json`. **Remove reader cache** deletes only the OMR cache. It does not remove songs, originals or other models.

Limits: 32 MiB source files; 100,000 notes; 256 distinct parts; 262,144 sixteenth-note steps per section; images checked before decode at 24 MP and rasterized to a maximum 2,200-pixel edge. These bounds reduce memory pressure but cannot guarantee that every phone/browser will keep a recognition tab alive. Crop complex pages and review the result. Physical iPhone, Apple M3 and Radeon 7900 XTX validation has not been performed in this cloud run. CPU recognition is verified in Chromium and Firefox; desktop WebGPU speed/quality is not claimed.

## Instruments and portable assets

FluidR3 provides 128 General MIDI programs and percussion pitches 35–81. The data-only distribution has 856 deduplicated MP3 samples (about 22.3 MB overall); only needed instruments load. Original pitch, envelopes, tuning and loop points are preserved. Out-of-range percussion uses the closest supplied drum and raises a review notice. Instrument data and audio have integrity checks and a separate cache.

Decoded samples use a 64 MiB phone / 192 MiB desktop budget. Active voices and prepared song samples are pinned; unused decoded buffers are evicted. If a composition cannot fit, playback reports the limit instead of silently omitting parts. Assign a synth to some parts or split the song. Live and offline rendering use the same sample playback path and the clip's FX bus.

## Reproduction and licenses

- Parser versions are pinned in `package-lock.json`. AlphaTab: MPL-2.0; ABCJS: MIT; midi-file: MIT; PDF.js: Apache-2.0; fflate: MIT.
- FluidR3 original Frank Wen license and WebAudioFont conversion license: MIT. Notices ship with the bank. `docs/instrument-bank-sources.json` records source hashes; `scripts/score-assets/download-fluidr3.py --root .cache/score-assets` then `node scripts/score-assets/prepare-fluidr3.mjs --root .cache/score-assets --output public/soundfonts/fluidr3-gm-1` reproduces the data-only extraction. Source JavaScript is parsed as data, never evaluated.
- `node scripts/score-assets/verify-fluidr3.mjs` checks every hash, decodes all 856 samples and verifies loop ranges. `docs/instrument-bank-verification.json` records the result and key-range gaps handled by nearest-zone transposition.
- Partsong code is AGPL-3.0-only; homr weights are described as AGPL by its upstream FAQ, including dataset licensing uncertainties. The Studio remains GPL-3.0-or-later, with the optical-reader derivative under AGPL. See `public/omr/SOURCE.md`, LICENSE and LICENSE_FAQ. The public Site offers the exact application/modified-worker source at `/source/studio-source.zip`, upstream Partsong source, and pinned homr-rs source/build instructions.
- `node scripts/test-score-reader.mjs` performs real recognition, cancellation, cache resume and insertion. Set `OMR_BROWSER=firefox` for Firefox. An optional `OMR_MODEL_DIRECTORY` provides verified, byte-identical model files for reproducible network-independent tests; it does not replace inference with a mock. Model downloads require network on first use.

## Verification scope

Synthetic CC0 fixtures cover all structured formats, transposition, ties/repeats, tempo changes, tuplets, multi-staff scores, format 2 MIDI, more than 16 exported parts, reversible insertion and migration. Browser tests use the real instrument bank, notation renderer, IndexedDB, WAV and OGG encoders. Reader evidence is in `docs/omr-*-verification.json`. It establishes correctness for the supplied printed fixture, not a recognition-accuracy score across arbitrary music.
