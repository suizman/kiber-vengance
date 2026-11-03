# Studio v7 delivery

Status: implemented, verified and published as Studio 7.0.0 / Site version 39 on 2026-11-03.

## Accepted scope

- Dynamic instrument tracks and lossless migration from projects v2–v6.
- Typed module boundaries, consistent edit transactions, asynchronous persistence and responsive rendering.
- Consistent desktop/touch controls, bilingual feedback and the established cyberpunk identity/four workspaces.
- Local MusicXML/MXL, MIDI, Guitar Pro and ABC import, acoustic instrument playback, and editable local PDF/image recognition.
- Comprehensive functional, audio, accessibility, persistence and performance verification; updated EN/ES documentation; publication to the existing Site.

## Initial evidence

- GitHub source: `31826ed4d37357f41179d21552705dd23ff77ad2`.
- Type checking, existing lint, unit and companion tests passed; 52 Chromium/Firefox browser workflows passed.
- All six internal views at 390 and 1440 px had no document overflow, page errors or violations in the selected axe WCAG A/AA audit.
- Synthetic editor benchmark, Chromium with 4× CPU throttling, 390×844 viewport, localhost and no network throttling: 1,000 notes ready in 1,938 ms (4,046 DOM elements); 10,000 notes in 8,594 ms (22,046 elements, longest task 5,555 ms). These are lab measurements, not physical-phone or field Core Web Vitals evidence.
- Runtime model downloads and audio assets have independent lifecycles. Voice generation remains desktop-only.

## Implemented

- **Project v7:** dynamic ordered instrument tracks, per-clip General MIDI programs, fractional note timing and retained score-source assets. Migration accepts v2–v6 and preserves their five built-in instruments. Invalid future saves are quarantined before recovery rather than overwritten without a copy. Imported sections do not add notes to existing arrangement sections.
- **Editing:** viewport-based note/ruler/automation rendering, stable gesture surfaces, edge auto-scroll and group movement clamped without changing musical intervals. Touch targets, labels and additional-track management follow the shared design. Sampler titles fit 320 px screens, mobile project titles retain an editable width beside the Master controls, and hidden notifications cannot intercept navigation taps.
- **State:** delta-based undo history and one edit transaction per gesture; debounced asynchronous IndexedDB saves in a worker, version metadata separate from project bodies, and a small emergency journal for page exit. Stale save completions cannot acknowledge newer edits.
- **Boundaries and audio:** narrower typed feature contracts, explicit runtime bindings, typed audio nodes, compiled tempo maps, cached meter buffers and distortion curves. Acoustic sample loading is cancellable and memory-bounded; active voices and upcoming playback are pinned. The existing live keyboards, decks, clip/audio FX and desktop companion remain integrated. Some legacy controller types remain; this delivery does not claim every old `any` has been removed.
- **Scores:** local MusicXML/MXL, MIDI, Guitar Pro and ABC parsing in a worker; all-part review, split/merge/transpose, tempo/meter/note correction, audition, eight-bar notation excerpts, corrected MusicXML and one-step reversible insertion. Source, review and corrected XML are retained as project assets. See [the format and limitation guide](SCORE_IMPORT.md).
- **Acoustic instruments:** 128 General MIDI programs and a 47-key drum bank, delivered as integrity-checked data and 856 deduplicated samples. Only needed instruments load. Live playback and WAV/OGG export use the same sample and clip-FX path.
- **PDF/images:** local one-page rasterization and Partsong/homr-rs recognition, optional model download, crop/rotate/system controls, editable results, saved review drafts and resumable verified download chunks. Phones use CPU/WASM; desktop offers a WebGPU attempt with CPU fallback. No score/audio upload is performed.
- **Delivery compatibility:** the OGG worker/finalization fixes and windowed offline rendering from published Site 38 were reconciled with GitHub's older master and retained. WAV encoding also runs in a worker. Optional inference, parser and instrument assets do not download during initial startup. Regular OGG export remains available offline through the core PWA cache.
- **Documentation:** EN/ES guides, current model/architecture/UX contracts, pinned asset provenance and license notices, public corresponding-source archive and reproducible verification scripts.

## Verification

- TypeScript, production build, ESLint and whole-source oxlint pass. **83 unit tests**, **64 Chromium/Firefox browser workflows**, and **17 companion tests** pass with no skips. Browser audio checks use the documented virtual audio device in this Linux environment.
- Structured fixtures cover voices, staves, concert pitch, ties, repeated tempo changes, tuplets, MIDI independent sequences, percussion, program changes between clips, more than 16 exported parts, undo/reload and binary assets. Browser workflows exercise the actual notation renderer, instrument samples, DSP and WAV/OGG codecs. Worker error-path fixtures remain distinct from real inference evidence.
- Real CPU optical recognition returned all 16 fixture notes in both Chromium and Firefox. Chromium additionally cancelled during the download, reused completed chunks, finished recognition and repeated it without model requests. See [Chromium evidence](omr-chromium-verification.json) and [Firefox evidence](omr-firefox-verification.json). This is one printed fixture, not an accuracy benchmark for arbitrary scores.
- All 856 instrument samples decoded; no silent/invalid samples or invalid loop ranges were found. See [bank verification](instrument-bank-verification.json).
- All six views were checked in EN/ES at 320, 390 and 1440 px (36 layouts), without document overflow or page errors; the review dialog also fits those widths. Offline reload, previously loaded structured-score import, cached-piano audition and first-use OGG encoding passed. Initial startup requested no optional parser, PDF, instrument or inference model assets. See [responsive/offline evidence](ux-v7-verification.json).
- EN/ES manual validation covers 28 pages, three READMEs and 218 local links/images.

## Measured performance

Three runs per version, the same 64-bar project, Chromium at 390×844 with 4× CPU throttling, fresh storage, localhost and no network throttling. This comparison uses GitHub source `31826ed` as its baseline.

| Metric | v6 median | v7 median |
| --- | ---: | ---: |
| 1,000 notes ready | 1,730.2 ms | 1,227.7 ms |
| 10,000 notes ready | 7,049.8 ms | 1,665.7 ms |
| Longest task, 10,000 notes | 4,480 ms | 494 ms |
| DOM elements, 10,000 notes | 21,999 | 2,013 |

The 10,000-note ready time fell about **76%**, with about **91% fewer DOM elements**. [Raw results](performance-v7.json) and `scripts/measure-large-project.mjs` make the comparison reproducible. The initial single-run baseline above is historical and is not mixed into these medians.

## Explicit limits

Physical iPhone/Safari, microphones/headphone routing, Apple M3 and Radeon GPU execution have not been tested in this cloud run. No human listening-quality verdict or universal recognition accuracy is claimed. Complex/handwritten scans and unsupported articulations require correction; proprietary notation projects should export MusicXML first. Memory budgets can reject a composition too large for the device, with an actionable message. These limits are also visible in the import guide and UI.

## Publication

- GitHub runtime source: `709e0e0`; documentation: `7f25734`; verified distribution: `820ae148a5bc1ef1f619517e9fdb31f9633ef28e`. Commits use the requested **suizman** authorship. The final distribution footer identifies `709e0e0`.
- After the full 83-unit/64-browser gate, the final mobile header and save-status localization changes passed `npm run check`, three focused accessibility/navigation browser workflows and all 36 responsive/offline checks again. Companion validation remains 17 passing tests.
- Synchronized all **2,484 GitHub-tracked files** byte-for-byte into the isolated Site checkout; updated/added 2,322 paths and deleted none. Retained Site-only files and the byte-identical `.openai/hosting.json`. Separate GitHub and Site histories remain separate.
- Site source: `5985fd8694d1d734f54c4dde04d5edf412a6a97b`. Saved **version 39**, ID `appgprj_6adbe6a2b5648191a5ae75b3ff523e5e~appgver_0d9839692d4c8191ab153303e944afb3`. Its 119,777,280-byte static archive contains 1,166 files, all below the hosting file-size limit.
- Native deployment `appgdep_6aea5b7a6d908191a267f85fca58e579` returned terminal **succeeded** at `2026-11-03T22:09:41Z`. Follow-up confirmed version 39, active status, public audience and [studio.suizman.org](https://studio.suizman.org). Generated hosting URL: https://kiber-vengance.baltar88.chatgpt.site. No DNS, domain, audience or tunnel configuration was changed.
- EN/ES wiki published at commit `cb771852304f996bc4210faebcb948d2cb0290dc`; anonymous retrieval of the Spanish score guide succeeded. The legacy publishing script's SSH route was unavailable in this environment, so the same validated pages were published through an isolated HTTPS clone, preserving other wiki files.
- A real Chromium session on the public custom domain verified footer `709e0e0`, the mobile title layout, a two-part MusicXML review, acoustic audition, insertion into seven total tracks and seven mixer channels. The reader manifest, worker and public source archive returned HTTP 200; there were no page errors or failed same-origin responses. See [production verification](production-v7-verification.json).

This publication record is a documentation-only follow-up and does not require rebuilding the deployed runtime.
