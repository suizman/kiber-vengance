# FluidR3 General MIDI assets

Data-only bank for local, on-demand playback. No executable sample scripts are included.

- 128 zero-based General MIDI programs, 47 standard percussion notes (35–81).
- 1,072 zones, 856 deduplicated mono MP3 samples, 21,319,599 encoded audio bytes.
- The root `manifest.json` contains program/drum metadata paths, byte counts, source URLs and SHA-256 hashes. All `path` values, including zone sample paths, are relative to this manifest's directory.
- Each program/drum JSON contains `zones`. A zone retains its original key range, pitch in cents, fine/coarse tuning, sample rate, loop positions and envelope description. `sample` contains the binary URL path, hash, size, MIME and encoding.
- Sources are fixed to `surikov/webaudiofontdata` commit `23ca907d4370a04fd89ca483a92915e4d6159ab9`. Source scripts were parsed as an allowlisted static AST; no scripts were evaluated or executed.
- MIT license and original FluidR3 README/COPYING are included in `licenses/`. The complete license mirror is pinned to MuseScore commit `3224f342d12f4af8ea782e929c49f5ce85f97da6` and contains the original Frank Wen release. The MS_General introductory history in that mirror is not a claim that this bank contains later MS_General samples.

## Playback contract

1. Request only the selected program's metadata and required sample zones. Verify metadata and binary hashes; retain persistent cache separately from projects and voice models. Exclude this bank from PWA installation precache.
2. Select a zone covering the MIDI pitch; where an instrument's natural range has no zone, use the nearest zone and transpose it to the requested pitch. Do not discard or clamp the note. For overlapping ranges, upstream's normal playback selects the last matching zone.
3. Playback rate is `2 ** ((100 * pitch - originalPitch + 100 * coarseTune + fineTune) / 1200)`.
4. Convert source loop samples to seconds using the zone's original `sampleRate`, not the decoded AudioBuffer's sample rate. Enable loops only when `loopStart > 0 && loopEnd > loopStart` and decoded bounds remain valid. A decoded buffer can be reused by live and offline AudioContexts.
5. `anchor` is retained source-analysis metadata. Upstream does not use it as playback delay. Use explicit `delay` when supplied, otherwise start at zero. Do not remove the original attack by applying anchor.
6. Preserve `ahdsr` when present; it may be a boolean or an array of `{duration, volume}`. Drums are one-shot. Handle note-off/release independently and disconnect ended nodes. This source has no velocity-layer metadata; velocity controls gain.
7. Cache decoded buffers by sample hash and pin them while active voices use them. Evict unused buffers by a byte-bounded LRU. The complete bank would be about 250.8 MiB decoded at 44.1 kHz; the largest single program is about 14.7 MiB and piano about 10.3 MiB, so never decode the whole bank on startup.

## Verification

A real Chromium OfflineAudioContext decoded all 856 MP3s: zero decode failures, zero silent samples, zero loops outside decoded bounds. Every source, metadata and binary hash was checked. These are decode/metadata checks, not a human-listening or physical-Safari certification. Detailed report is delivered separately at `verification.json` in the preparation workspace.

## Reproduce

Preparation workspace contains `download-fluidr3.py`, `prepare-fluidr3.mjs`, `fluid-source-lock.json` and `verify-fluidr3.mjs`. Downloader only retrieves 175 fixed source files and two fixed license files. Converter requires Node and Acorn 8.19.0; use:

```
python download-fluidr3.py
node prepare-fluidr3.mjs --root /tmp/kiber-score-assets --output /tmp/kiber-score-assets/prepared --acorn /absolute/path/to/acorn/dist/acorn.mjs
```

`SHA256SUMS` covers all delivered files except itself. Generated music test fixtures are separate CC0 files; they are not part of this audio bank.
