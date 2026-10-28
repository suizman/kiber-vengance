# Persistent project memory

This file is the operational memory for КИБЕР VENGANCE. It must be read alongside `kiber-vengance.md` before development continues. It records the product's actual state, established decisions, and user expectations; it does not replace the code or tests as the ultimate source of truth.

Keep this versioned memory focused on shared project decisions, verified behavior and known limitations. Personal details, credentials and machine-specific identity settings belong in local configuration, not in this document.

Last updated: 2026-10-28.

## Published reliability, AI and voice release (2026-10-28, Sites 32)

- User explicitly requested updated memory, agent instructions, product plan and UX review, separate feature/improvement commits, push to the existing repository and then ChatGPT Site deployment.
- Existing Site was re-read before release: its audience is public and its current live URL is `https://studio.suizman.org`; latest server version was 31. Preserve these settings. Older release notes naming only the generated Site domain are historical.
- Release documentation distinguishes shipped functionality from pending singing and listening acceptance. The full functional gate already passed with 54 unit tests / 43 browser workflows; the release build will be revalidated after source commits so the footer matches its source.
- Reviewable feature commits: `ae27bc9` portable packages/takes/relinking; `b73bb06` shared clock, mixer, MIDI/stems and WAV performance; `10cca18` autosave recovery; `6d0258c` honest automation/accessibility; `ff5775d` composer rhythm/octaves/Quality; `08f3da4` browser-local speech. `2dd35e2` updates the shared documentation and UX review.
- Release rebuild/typecheck/lint and all 54 unit tests passed again. Distribution identifies runtime source `08f3da4`; the 54-unit/43-browser full-suite evidence remains valid because runtime source is unchanged by commit separation and documentation.
- Remote `master` had advanced to `43a2483` (`a560fd9` focused editor/deck/state refactor plus its build). Normal merge `e31a2c2` preserves that work and all feature commits; no force-push or old Sites-history merge is used. Recovery/hide flushing now runs through typed ProjectSession, whose pending guard prevents overwriting an external storage fixture when no edit is pending. Shared deck capture retains custom drum sources through the typed DeckAudio contract.
- The merged runtime source revision is `e31a2c2`; its rebuild, lint/typecheck and 56 unit tests passed. The combined `npm run check:full` exited 0: 56 unit tests and 43 Chromium/Firefox workflows, no skips or failures. Log: `/private/tmp/kiber-merged-release-full.log`. Earlier `08f3da4` footer/54-unit evidence describes the pre-integration state.
- GitHub push succeeded through distribution commit `51b94c6`, a normal fast-forward of the existing remote including its focused refactor. The main workspace was clean at publication. The distribution footer is `e31a2c2`.
- The official Sites source helper synchronized the exact tracked tree in an isolated checkout and pushed source `bce68188ccd3a8771e4fd98b706ee2b5d2806170`. Saved Sites version **32** deployed with native terminal status **succeeded**. Deployment: `appgdep_6ae13d2ddf84819195d7a7eea45757b9`. Returned URL: `https://kiber-vengance.starrylemur35.chatgpt.site`. Existing public audience and custom-domain configuration were preserved.
- Memory, AGENTS, product plan and UX review were updated. Singing/majority musical preference/native-device limits remain explicit. A subsequent documentation-only commit records this completed publication; it does not change the verified runtime or require a second Site version.

## Reliability, composer quality mode and local speech (2026-10-28, local work)

- User requested the reliability/composer/browser-only voice plan. Preserve official identity, four workspaces and the actual v6 model with v2–v5 imports. AGENTS.md's obsolete v5 wording is corrected. The subsequent explicit release request authorizes feature-separated commits, GitHub push and publication of the existing ChatGPT Site; repository visibility, Site audience and domain must be preserved.
- `projectAssets()` inventories/deduplicates drum slots, sampler, regions and recorded takes. Packages now use a versioned asset manifest with IDs/MIME types and still read the legacy ZIP layout. ZIP entry checksums/bounds are checked. Fresh-context browser evidence checks restored bytes/types/IDs, including recorded takes, and relinks an intentionally removed source. Package creation refuses missing binaries. Composition audio preflight requires participating sources; unrelated missing takes/sampler sources do not block a WAV. Decoder/source errors must remain visible.
- `projectSeconds` integrates tempo jumps/ramps and swing for scheduler/offline note timings. MIDI emits tempo/meter maps and quarter-step ramp approximations. Persistent audio-lane output gains respond to Solo/Mute/faders during sustained regions and disconnect on stop/seek. Global source Solo/Mute, groups, automation/modulation and sidechain evaluation are shared; instrumental stems remove all audio lanes and audio lanes have selected individual stems. Audio-only tails extend transport/render duration without repeating the instrumental arrangement. Live per-track FX tails versus offline per-clip buses, random excitation/reverb, note-on pan/cutoff and rate-based warp remain documented differences; do not claim bit-identical mix parity.
- DevTools paused the formerly busy WAV renderer inside per-sample `getChannelData` calls. WAV encoding now obtains channel views once, with a stereo/clipping/two-read regression. Empty renders avoid idle FX graphs; meaningful render stages and a processing wait limit are visible. Native offline DSP cannot be forcibly interrupted. Corrected Scratch capture, repeated WAV destination writes and offline timing/master attenuation/isolation workflows pass focused Chromium checks.
- Unreadable autosaves are copied before fallback; failed preservation blocks overwrite of the original key. Pending edits flush on hidden/pagehide. Save warnings are mounted in the shell for every workspace, with quota/JSON-export coverage. Export-preference failures do not turn a successful file write into failure. IndexedDB asset writes await transaction completion. New automation lanes offer Read only; old Touch/Latch/Write metadata is retained without claiming recording behavior.
- Composer octave degrees are preserved before register/leap fitting; variation adds bounded deterministic timing/gate changes and harmonic preferences use four-step pulse windows. Optional Quality mode makes three sequential calls to the existing model and locally ranks/deduplicates proposals. Quick mode stays one call. Cancellation/errors keep prior proposals; shaping retains each quality proposal's plan and valid selection. Structural tests and protocol fixtures are not a blind musical-preference study; majority preference remains pending.
- Arrange → Audio & sampler → `VOICE · ES/EN` is an experimental local speech panel: Kokoro 82M in its own worker, explicit q8/FP32 download, English Heart/Michael and Spanish Dora/Alex, speed/text, audio audition/WAV and insertion at the lane/song locator captured when generation starts. Each insertion creates a new v6 region with speech-generation metadata and WAV asset, preserving Undo/Redo/reload/package portability. Melody/speech share an inference lock. Cancellation/free-memory terminate the worker; targeted cache deletion covers voice-only PWA duplicates while retaining shared runtime/music assets.
- The original `phonemizer@1.2.1` package proved English-only in a genuine Spanish browser run and was removed. Pinned `@echogarden/espeak-ng-emscripten@0.3.5` supplies multilingual phoneme data locally; English-only /r/ and /x/ rewrites are not applied to Spanish. Optional voice worker/phoneme data are excluded from initial PWA precache. Its guarded Node/embedded-WASM fallback build diagnostics are separate from actual successful browser inference.
- Real Chromium generated distinct English/Spanish WAVs in q8 (about 11.9/11.3 s in the first corrected run) and FP32 (23.3/13.2 s), with insertion, Undo/Redo and reload. Final q8 repeat also passed retained-worker offline Spanish inference. Samples live under `/private/tmp/kiber-voice-samples`; logs `/private/tmp/kiber-voice-real.log`, `/private/tmp/kiber-voice-fp32.log`, `/private/tmp/kiber-voice-final.log`. Times vary with concurrent workload. No perceptual winner, physical-speaker, native Safari/Orion or cold-offline speech-start claim is made. A first smoke mistakenly reused the prior preview; corrected evidence waits for a new URL and validates differing bytes.
- User listened to the replayed Spanish q8/Dora sample (“La noche se enciende. Nuestra voz cruza el horizonte”) and explicitly answered that it is intelligible and usable. This is one phrase/listener, not a blind q8/FP32 winner or general pronunciation certification.
- DiffSinger singing is explicitly research pending: official ONNX export documentation was reviewed, but no permitted ES/EN bank/vocoder pair, full browser inference, sung samples, alignment/pitch/memory measurement or intelligibility gate was completed. No singing button or external/local-server substitute was introduced. Do not describe this as a finished feasibility experiment. See `docs/LOCAL_VOICE.md` for the next experiment and primary sources.
- Local preview was started at localhost:4173. User reported using localhost:8080 and confirmed voice appeared after restarting/reloading that server. At implementation validation this was not yet a published Site release; the release record below tracks the later authorized publication.
- Validation closure: `npm run check:full` exited 0 with typecheck/build/lint, **54 unit tests and 43 browser workflows**, including compatible Firefox and current Chromium launchers. Log: `/private/tmp/kiber-verified-check-full.log`. Focused sustained-audio/voice/package/deck audits also passed (`/private/tmp/kiber-final-audio-ui.log`). The old WAV stall is resolved in these actual render/capture workflows, not just bypassed by extending a test timeout.
- Full-suite fixes include names matching visible note/shortcut text in the shared keyboard and MIDI storage fixtures waiting for autosave before injecting mappings; pagehide flushing must not be disabled to accommodate a fixture. Quality UI fixtures explicitly block Service Workers and use `?qa=1`: a PWA worker had bypassed route interception and accidentally run genuine CPU inference, causing the misleading timing failure. The corrected isolated three-call/cancellation test passed in 2.9 s.
- `scripts/prepare-composer-listening.mjs` produced six blinded old/new compiler WAVs across electro-rock/cinematic/synthwave under `/private/tmp/kiber-composer-listening`, with a separate key. Same authored plans/seed/synth and dry normalized rendering; these are not purported model outputs or a completed preference study.
- Documentation: `docs/RELIABILITY.md`, `docs/LOCAL_VOICE.md`, `docs/LOCAL_AI.md`, README, product/design documents and test prerequisites. Human musical/voice preference and DiffSinger singing acceptance remain open despite the functional suite passing.

## Contextual AI composer (2026-10-27, Sites release 30)

- Six requested improvements are integrated into the existing shared AI dialog: active-clip context; new/continue/answer/variation/same-motif-new-rhythm modes; phrase/loop/free structure; exact density, register, maximum leap, repetition and variation; up to three distinct proposals, looped A/B/C and selected-bar regeneration; named local recipes with search, favorites, rename, delete and Undo delete.
- `src/ai/composer.ts` captures at most 512 notes per active melodic clip, summarizes source pitch classes for the model, derives duration-weighted accompaniment hints and compiles bounded monophonic notes. Integer steps plus fractional offsets within v6’s ±0.49 range preserve scheduler and reload compatibility. Automatic-density variations preserve silent source bars; preview BPM changes retain proposals. The source motif transposes by octaves into the chosen register; original clips remain untouched.
- One inference supplies the plan for inexpensive deterministic alternatives. Shaping uses no additional inference. Exact duplicate alternatives are removed. Partial regeneration retains all unselected note events byte-for-byte and connects both protected boundaries within the leap constraint; impossible connections fail without discarding the previous proposal.
- Preview now uses the shared AudioEngine scheduler in an isolated project clone. A/B/C switches at loop boundaries using one AudioContext; stop/close/blur/hidden and cancellation during asynchronous startup release it. Selected sound/BPM, normal clip insertion, optional base-tempo application, Undo/Redo and autosave remain intact. No project schema or musical shortcut changed.
- `kv-ai-recipes-v1` stores up to 100 validated personal recipes separately from project JSON. It stores settings and an optional compatible sound, never source context notes or Apply BPM. Storage failures are visible, and an unreadable existing library is not overwritten. No recipe import/export or synchronization is claimed. Existing factory/catalog/Vault behavior remains available.
- The bilingual UI keeps advanced controls collapsed, exposes elapsed generation/token progress and nearby cancellation, focuses completed proposals and keeps the header reachable while scrolling. Models, initial opt-in download and existing CPU/GPU fallbacks are unchanged. See `docs/LOCAL_AI.md` for exact behavior and limitations.
- Final check validation: typecheck/build/lint and 44 unit tests passed; dedicated Chromium desktop/mobile flows passed, including A/B reusing one AudioContext, instant shaping, partial-bar preservation, recipe persistence/rename/favorites/delete undo, project Undo/Redo, storage failure, accessibility and no overflow. Preview-start cancellation passed. Eight focused Chromium workflows passed, including Spanish results at 320 px and explicit source-rhythm labeling, plus existing menu discovery, CPU fallback and factory/catalog/Vault regression coverage. A representative 2,048-note context with three 96-note candidates took 1.4 ms median / 2.1 ms p95 for the pure arrangement calculation on this host; this is not an inference-time benchmark. The final WebKit CPU retest with the compact grammar passed continuation (4.7 s), partial regeneration, preset sound/BPM export, preview, insertion, Undo/Redo, reload and offline inference (4.1 s). Log: /private/tmp/kiber-ai-composer-real-webkit-final.log. UI protocol fixtures are explicitly distinct from real-model evidence. The full-suite run passed its check stage and seven browser workflows but hit the pre-existing quick WAV export wait timeout; it was bounded at 300 seconds and ended with exit 124. No full-suite pass is claimed. Log: /private/tmp/kiber-ai-composer-full.log.
- A genuine Firefox CPU run exposed whitespace-heavy output exhausting the 80-token budget. CPU now uses the pinned structured-output processor’s supported regex constraint for the same integer tuple (maximum 36 characters), disallowing unnecessary formatting and numeric spellings. The context prompt was shortened to mode/form/source/accompaniment; hard controls remain enforced by the compiler. No model result is fabricated or replaced. The final Firefox CPU retest passed: genuine continuation (40.9 s), selected-bar regeneration with exact preservation elsewhere, selected preset sound/BPM in exported JSON, preview, insertion, Undo/Redo, reload and cached cold-offline Spanish inference (34.2 s). Log: /private/tmp/kiber-ai-composer-real-firefox-final.log.
- At the user’s explicit request, CPU reliability commit 9acf8bc and contextual-composer source commit a61784f were pushed to origin/master. Distribution commit e72a5cb contains the rebuilt footer a61784f; release typecheck/build/lint and all 44 unit tests passed again. Sites version 30 successfully deployed at https://kiber-vengance.starrylemur35.chatgpt.site from isolated Site source 18d7e2199bb72afb9fc87dd8bb3868694c06db6b. Existing Site audience and GitHub repository visibility were preserved. The native deployment returned succeeded. Physical audio output and native Safari/Orion are not claimed.

## Stable workspace subtabs (2026-10-26, Sites release 29)

- Compose and Mix have one view each and no secondary navigation action. Their previously rendered single tab was hidden with CSS, leaving a redundant Compose button in the DOM that could appear during navigation/style changes without performing a different action.
- The shell now renders subtabs only for multi-view workspaces (Arrange/Audio & sampler and Performance deck/Clip launcher). Explicit layout state replaces the single-child CSS selector. Stable keys preserve shared Guide/Commands/Undo/Redo/Help controls when the tab group mounts or disappears.
- Verified English/Spanish desktop/mobile navigation through all views, repeated returns to Compose, expanded/normal mode, retained Commands/Sound/AI handlers and no horizontal overflow. Typecheck/build/lint and 36 unit tests passed. The initial bounded full-suite run passed 12 Chromium workflows before its 60-second bound; a complete-suite result is recorded separately after release checks.
- Sites version 29 successfully deployed this fix at https://kiber-vengance.starrylemur35.chatgpt.site with footer source b91166e (GitHub distribution commit 498bff2, isolated Sites source 92f919b7fa6f6bd85b2a8ec5f07cb3c9e911a10a). Site audience and private GitHub visibility were preserved.
- Three targeted Chromium workflows passed, including accessibility, AI navigation and the new regression; the regression was also rerun with expanded mode. An independent WebKit desktop/mobile run passed repeated Arrange/Live/Mix returns and expanded-mode switching. Automated WebKit is not a physical Safari/Orion claim. The subtitle remains intentionally hidden in expanded editor mode; no subtitle behavior changed.
- The final check:full rerun passed its check stage but failed the pre-existing quick-export WAV write wait with a 30-second timeout; the overall run has a 180-second bound. No full-suite pass is claimed. Session output is in /private/tmp/kiber-compose-tabs-full-final.log.

## Sites release 28 (2026-10-26)

- Explicitly requested push and production deployment completed. Sites version 28 succeeded at https://kiber-vengance.starrylemur35.chatgpt.site with the existing Site audience preserved; GitHub repository visibility was not changed.
- The deployed footer identifies source revision 9b2d978; GitHub distribution commit d83323d contains its build. The Sites source helper synchronized an exact tracked-file copy through an isolated checkout, with Site source commit d79826309ff146b02a909ca88b50d59bf1d3e8b0. The main repository's rewritten history was not merged with the older Site repository history.
- Release validation: typecheck/build/lint and 36 unit tests passed. Real WebKit CPU inference passed after automatic asyncify removal (6.0 s and 5.8 s offline), including selected sound/base tempo in exported JSON, audition controls, insertion, Undo/Redo and reload. Native deployment returned succeeded. Existing full-suite WAV-export and physical-audio limitations remain documented.
- Earlier local-preview/no-deployment notes below describe historical states; local AI navigation, CPU/GPU inference and both preset catalogs are now deployed. The JSON is shipped at /presets/catalog-v1.json on the Site; the configured raw GitHub official-refresh URL still requires anonymous repository access.

## Static hosting artifact size (2026-10-26)

- Sites rejects individual static assets larger than 25 MiB; deployment 26 previously failed on Transformers' unused 26,861,777-byte asyncify WASM artifact. Deployment 27 excluded that file manually.
- The regular build now removes that optional variant automatically and checks all output assets against the hosting limit. CPU inference explicitly uses the standard ONNX WASM factory/binary in src/ai/cpu-worker.ts; GPU inference uses its separate WebLLM worker. Do not remove the standard WASM or switch factories without revisiting this packaging rule.

## History privacy cleanup (2026-10-26)

- At the user's explicit request, historical copies of the personal contact address were removed from tracked content and commit messages. Author, committer and tagger identity fields use the existing GitHub noreply identity; local Git configuration now uses it for future commits too. Do not copy identity addresses into shared memory.
- A private recovery bundle is kept outside the repository and must never be added or pushed. The rewritten branch replaces the prior remote history with an explicit force-with-lease check. Repository visibility remains private; this is not a site deployment.
- Rewriting preserved the current tracked file contents. Documentation commit references were updated to the rewritten IDs, and the distribution is rebuilt so the footer identifies the rewritten source revision. Old clones must not merge the original history back into the cleaned branch.
- Validation checked every local Git object after filtering, including unreachable objects, and found no remaining personal address. All reachable author/committer addresses use noreply. Typecheck/build/lint and all 36 unit tests passed; no product behavior changed.

## Preset source push and distribution (2026-10-26)

- At the user's explicit request, source commit 4f65d83 (Add musical controls and melody and sound preset catalogs) was pushed to origin/master using the repository's locally configured Git identity. The distribution was then rebuilt with 4f65d83 embedded in its footer; npm run check passed, including all 36 unit tests. Existing targeted/real-inference evidence and the failed full-suite WAV-export check below remain applicable.
- The catalog file is present in the pushed source, but anonymous raw GitHub requests still returned HTTP 404 after push, including a revision-qualified query. Pushing the file did not establish public access. The reason/hosting remains unresolved; no repository visibility change or site deployment was performed. Included presets and compatible user-supplied file/URL imports remain usable. Earlier notes that publication of the file alone would resolve the 404 are superseded by this observation.

## Musical controls and both preset types (2026-10-26, local only)

- User requested presets for both melody and sound. The shared AI dialog now offers style, explicit rhythm and preview BPM (50–220), nine original recipe presets and six native sounds with search/type filtering. Recipes set prompt/settings without generating fake notes or changing project data; sound staging is track-compatible and independent of model loading.
- Rhythm overrides the model's category before compilation; style/BPM enrich the local prompt. Preview uses the selected sound/BPM in an isolated AudioEngine clone, closed on stop/end/cancel. New clips copy the staged sound or source sound without changing existing clips/mixer/arrangement.
- Applying BPM to the project is explicitly unchecked by default. If selected, insertion updates project.tempo and the step-zero tempo-map event together, preserving later tempo events and supporting Undo/Redo. There is no clip-specific tempo field or schema change.
- Compatible native catalog/bank JSON can be imported from file or HTTPS URL (1 MB, 256 records, validation, 12-second timeout, cancel, CORS required). Catalogs remain session-only; explicit Save to Vault persists sounds. Native instrument imports strip mixer fields. Only the canonical URL can refresh the official list; external entries cannot replace included IDs.
- Official JSON is authored at public/presets/catalog-v1.json. Its configured raw GitHub URL returned HTTP 404 and requires publication of that file; no live-catalog or site publication is claimed. Included presets are bundled and work without the online endpoint. Directory links/domain-restricted external search cover official Vital, Surge XT and Serum 2 sources; their native patches remain incompatible with this engine and are not imported or redistributed. See docs/PRESET_CATALOG.md.
- Validation: typecheck/build/lint and 36 unit tests passed. Four targeted Chromium workflows passed on desktop/mobile, including imports with network fixtures, search, recipe controls, sound compatibility, Vault, accessibility, honest HTTP errors, unchanged clips and zero inference requests. Real WebKit CPU smoke passed in 5.1 s plus offline 4.2 s, including optional 128 BPM, preset-backed insertion, audition controls, Undo/Redo and reload. Audible hardware output remains unverified. `check:full` passed its check stage and four Chromium workflows, but quick audio exports timed out waiting for WAV writes; the run was bounded to 180 seconds and terminated before remaining workflows finished. No full-suite pass is claimed; see /private/tmp/kiber-presets-check-full.log for this session's output.
- An extended real WebKit CPU smoke also passed (5.9 s / offline 4.4 s) and inspected the exported project JSON: the new clip retained Scarlett Razor's cutoff/distortion and the step-zero tempo event was 128 BPM. The smoke explicitly expands the advanced export section before downloading JSON.

## Local AI navigation integration (2026-10-26, local only)

- Compose has an always-visible AI melody action in its context toolbar, independent of the collapsed generation tools. The existing generator action and Settings entry remain available.
- The Project menu has a direct Generate melody with local AI entry. Ctrl/Cmd+K can find the same action through English/Spanish labels and AI/IA, prompt, melody/melodia, CPU/GPU and model-name keywords. No musical shortcuts were reassigned.
- All entry points call the same bridge action and open the existing generator for the current selected track. Project/Settings/command dialogs close before it opens; Escape restores focus to the relevant visible launcher. Navigation alone does not load weights or change clips.
- Validation: typecheck/build/lint and 32 unit tests passed. Three targeted Chromium workflows passed, covering desktop/mobile menu access, Spanish labels, English/Spanish palette searches from Mix, modal/focus handoff, unchanged clip/note counts, zero inference/model requests and existing GPU-to-CPU fallback/cancellation.
- `check:full` was attempted with current Chromium and a matching Firefox launcher: the check stage and first two Chromium workflows passed, then the browser phase stopped progressing in quick audio exports and was interrupted. A full-suite pass is not claimed; this menu delivery is verified by its targeted workflows.

## Browser-compatible local AI (2026-10-26, local only)

- The user's Safari 16.6 lacks WebGPU; Orion 1.1.3 reported an opaque worker startup failure. Safari WebGPU starts at 26; current Firefox WebGPU availability depends on platform (Apple Silicon versus Intel is material). A page API alone is not proof that a model can run in a worker.
- Added Automatic/GPU/CPU engine selection, persisted separately from musical data. Automatic probes GPU inside its worker and falls back to genuine CPU inference when unavailable or GPU initialization fails. GPU-only mode retains an actionable error pointing to CPU mode.
- CPU uses pinned Transformers.js 4.3.1 + its structured-output processor, SmolLM2 135M Instruct ONNX q8 (~136 MB weights) and the standard ONNX WASM factory. Single-threaded WASM requires neither WebGPU nor SharedArrayBuffer/COOP/COEP. It uses RAM, has a separate download/cache from Qwen GPU artifacts, and works best with simple English prompts. The smaller model has weaker instruction-following than Qwen.
- CPU output is a bounded compact tuple of motif and musical categories, expanded and validated into the same musical plan. This reduces generation work; its title is derived from the prompt rather than falsely attributed to the model. Qwen CPU timed out in Firefox even after compacting output, motivating SmolLM2: real first generations passed in 6.5 s (WebKit) and 36.7 s (Firefox), including insertion/Undo/Redo/reload. WebKit's second, offline inference passed in 4.1 s.
- Worker boot caches only the application's own bundled runtime and runs it from a module Blob with its original import.meta.url base restored. Vite development modules retain their normal URLs and require the dev server. Worker cache, WASM/model cache, cancellation and GPU fallback stay independent of musical project data. WebKit's offline mode still rejects even a standalone cached Blob module worker (isolated probe verified this): cold offline startup is not claimed on WebKit; load while online, then infer offline with the worker retained.
- Delete download now uses targeted Cache API cleanup without requiring the failing GPU worker. Worker errors include backend and available script/line details. Optional CPU/GPU workers and ONNX assets remain excluded from initial PWA precache.
- Safari's native automation is disabled on this host; no system settings were changed. Automated Firefox/WebKit use matching Playwright 1.55.1 binaries supported on macOS 13. `FIREFOX_PLAYWRIGHT_MODULE` selects the matching Firefox test runtime; Chromium keeps the current launcher because the legacy launcher's flags stalled even a standalone AudioWorklet probe, while the current launcher completed that same probe.
- Final CPU smoke passed on both engines: Firefox 36.7 s English / 35.2 s cached cold-offline Spanish; WebKit 6.5 s English / 4.1 s offline Spanish with its worker loaded online. Both cover actual insertion, Undo/Redo, reload persistence and unload. Audition controls were exercised; physical audible output is not claimed. Typecheck/build/lint and 32 unit tests passed; targeted Chromium no-GPU/cancellation/automatic worker-to-CPU fallback checks passed. `check:full` was attempted with the legacy all-browser launcher and interrupted after repeated unrelated AudioWorklet timeouts; no complete-suite pass is claimed.

## Local prompt-to-melody experiment (2026-10-26)

- Local-only trial: Settings → Local AI or Compose's AI MELODY opens a bilingual, optional generator. No model weights or inference runtime are downloaded before an explicit load action. Model hosts are Hugging Face and GitHub; prompts are processed on-device, without a generation server.
- Pinned WebLLM 0.2.86 runs Qwen3 0.6B q4 in a dedicated worker. Uses f16 where supported, otherwise f32; advertised runtime GPU memory is about 1.4–2 GB. Model weights require an initial download of several hundred MB and are cached per browser/origin. WebGPU/adapter failure is visible; there is no silent cloud or fake-AI fallback.
- AI returns a bounded musical plan (motif scale degrees, rhythm, contour, articulation, energy/title). `src/ai/melody.ts` validates it and compiles monophonic, in-scale, range-limited notes for 1/2/4/8 bars in the chosen key/scale/current meter. A completed Qwen thinking envelope is stripped before strict JSON validation; malformed/truncated output fails visibly.
- Results include a note preview, measured inference time, Listen/Stop and Add as new clip. Applying preserves the source clip's instrument/character, leaves existing clips/arrangement intact and participates in autosave, Undo/Redo, JSON/MIDI/WAV. Prompt/model weights are not embedded in the v6 project.
- Cancel terminates worker downloads/inference, including adapter-check races. Free memory retains downloaded cache; Delete download removes only this model's artifacts. Closing during work cancels it; audition stops on close/blur/page hiding. Timeouts report failures. Context size is bounded to 2048 and output to 256 tokens.
- Real Chromium/WebGPU smoke passed: English inference 18.6 s, Spanish cached offline inference 18.7 s, actual result insertion, audition, Undo/Redo, reload and unload. This test used headless Chromium's explicit unsafe-WebGPU test flag; it is not evidence of default GPU support on all user browsers or audible hardware output.
- Validation: 31 unit tests plus typecheck/build/lint passed. Four targeted Chromium workflows passed: responsive/a11y, QWERTY, appearance persistence and AI opt-in/no-GPU/cancellation/Spanish mobile dialog. `check:full` reached E2E but its servers were denied listen permission in the sandbox. Full Firefox/Safari validation remains outstanding.
- WebLLM is an optional AI runtime dependency; Preact is already bundled. `skipLibCheck` skips upstream declarations with missing bundled/internal extension types; application source remains strictly checked. The optional ~6 MB worker is excluded from initial PWA precache and cached only when requested.

## Appearance settings (2026-10-26)

- Settings is available from the header gear and Project menu, including mobile. It offers instant, browser-persisted keyboard skins: Neon Circuit (default), Acid Terminal, Ember Drive, Scarlett Protocol and Studio Classic.
- Keyboard styling is shared by Compose, Live, Prism Keys and drum pads without changing key geometry, touch ownership, shortcuts or musical data. Dark skins use their own signal colour; Classic retains track-coloured held keys. Held notes remain immediate, visible even at zero glow.
- Personalization includes key glow, shortcut-label visibility, a cyan/violet/amber interaction accent and Reset appearance. A storage failure keeps session settings usable and displays an honest status. Appearance is independent of project JSON, exports and undo.
- The settings dialog is bilingual, supports Escape and native dialog focus management, and releases held notes when opened. Sampler QWERTY ignores open dialogs.
- The user approved publication of these appearance settings on 2026-10-26 after the local preview.
- Validation: typecheck/build/lint and 29 core tests pass. Five targeted Chromium workflows pass, including all five skins, held-note feedback in Compose/Live/Sampler, persistence/reload, reset, shortcut visibility, dialog input isolation, Spanish mobile settings and axe serious/critical checks. Desktop/mobile screenshots were reviewed. Full check:full reached E2E but its servers could not listen under the restricted sandbox; no full-suite or physical Safari pass is claimed.

## Footer source revision (2026-10-26)

- The footer's PROJECT identifier is the short Git source commit embedded by Vite, replacing the fixed v6 label. The project file schema remains v6.
- Source-only changes are committed before the release build; generated dist artifacts are committed separately so the footer identifies the source revision rather than an earlier feature. No runtime Git or network request is needed.
- Development and production resolve the last commit touching build inputs (src/public/scripts, HTML, Vite/TypeScript configuration and package manifests), rather than HEAD. Distribution-only and documentation commits cannot advance the local identifier past the published build.
- Builds without Git metadata can provide KV_BUILD_COMMIT (7–40 hex characters); otherwise the footer honestly shows unknown.
- Validation: Chromium verified the visible source hash in English and Spanish. Typecheck/build/lint and 29 core tests passed; check:full could not complete its browser phase because the restricted environment denied the test servers' listen calls.

## Shared control feedback (2026-10-26)

- `src/ui/styles/interactions.css` is the final shared interaction layer: cyan hover/focus, visible keyboard outlines, slider thumb glow, adjusting knob feedback and highlighted values. Hover is limited to fine pointers; disabled controls retain their disabled cursor and no glow; reduced-motion preference suppresses transitions.
- Musical keys have a distinct hover tint and immediate note-down fill. Track colour identifies held notes; Prism Keys uses cyan. Recording controls retain magenta semantics. Geometry does not move between interaction states.
- `src/ui/control-feedback.ts` paints native range progress from current min/max/value on input, focus, hover, control changes and DOM updates, without replacing native keyboard/touch behaviour.
- Typecheck/build/lint and 29 core tests pass. Chromium desktop/mobile accessibility, Prism Keys and physical QWERTY workflows pass. Full E2E remains limited by the missing default Chromium/Firefox binaries on this macOS host.

## Physical-key illumination (2026-10-26)

- Note-down illumination is immediate, including short taps. Compose and Live mirror QWERTY note states, update aria-pressed, and release held states when focus is lost. Sampler note routing uses chromatic offsets and the active octave rather than the old natural-note array.
- Externally played keys reveal themselves by scrolling only the keyboard's horizontal viewport. On mobile this makes C4 sampler QWERTY notes visible even when the initial viewport starts at C3.
- Sampler resolves its visual key by pitch when the caller supplies none, preserves highlighting while another source holds the same key, and updates its pressed state for QWERTY/MIDI as well as pointer input.
- Chromium checks passed for actual illuminated backgrounds and physical-key pressed/released states in Compose, Live and Prism Keys; `npm run check` passed with 29 core tests.

## Control row alignment (2026-10-26)

- Audio & Sampler controls use a consistent 20 px label/value row above a 44 px control area. Sliders, selects and numeric fields share the same vertical center; trim controls no longer sit lower than their neighbours.
- Sound Motion controls share the same row geometry, including switches. FX and Sound/Live macros reserve equal label heights so wrapped labels do not shift sliders.
- Visual geometry was checked in Chromium at 1366 px and 390 px. The broader control hover/illumination redesign is now implemented through the shared interaction layer described above.
- `check:full` passed typecheck/build/lint and 29 core tests, then failed at E2E because default browser binaries are missing on this host. The sampler illumination assertion now waits for the CSS transition to paint rather than reading the first unpainted frame.

## Sound rack reopening (2026-10-26)

- The Sound inspector preserves its independent rack states. A collapsed synth, Motion, FX, or macro rack now expands from either its `+` control or its visible heading, avoiding a small-target dead end on touch devices.
- Rack headings reserve a fixed 44 px button at the right. Collapsed racks size to their heading instead of clipping it to the legacy 42/46 px height; the cyan `+` stays fully visible and clickable.
- Validation: targeted Chromium desktop and touch-emulation workflows expand and collapse every Sound rack through both controls.

## Header control alignment (2026-10-26)

- The editable project title now shares the 40 px control baseline used by the language and export actions. Its saved-state label is positioned below the field without changing that alignment.
- Header actions use a real flex row with a deliberate 12 px gap. The language selector reserves room for its native arrow, preventing the `EN`/`ES` value from colliding with it.

## Clip duration and transport consistency (2026-10-26)

- Arrange loop limits apply only to song playback. Active clips loop independently over their current Bars length, including newly added bars.
- Refreshing clip controls after an edit does not seek the running transport. Explicit locator gestures still seek. The clip locator, bar/step readout and pause/resume use the same local position as the piano-roll cursor after each loop.
- Validation: typecheck/build/lint and all 29 unit tests passed. Targeted Chromium workflows cover live 2→4-bar expansion, 8-bar playback and wrap, reduction to one bar, Undo, and clip pause/resume. `npm run check:full` reached E2E but failed because its default Chromium/Firefox binaries are absent; targeted tests used the compatible installed Chromium 140. No full-suite pass is claimed on this macOS 13 host.

## Scratch header alignment (2026-10-26)

- Both Scratch Deck headers share an aligned title and control grid. Capture length and TRACK BPM occupy the first row; capture/import/microphone actions occupy the next row. The former Deck A eyebrow no longer adds unequal title height.
- Validation: `npm run check` passed (28 unit tests). Targeted Chromium 140 layout checks passed at 320/390/820/1366/1440/1920 px; full E2E was not run for this CSS correction. The current Playwright Chromium release cannot install on this macOS 13 host, so the targeted check used a compatible older Chromium.

## Product intent

- КИБЕР VENGANCE is a professional music-composition workstation for cinematic electro-rock, industrial, synthwave, darksynth, and hybrid cyberpunk styles.
- The official display spelling is exactly **КИБЕР VENGANCE**: `КИБЕР` uses Cyrillic characters and `VENGANCE` uses Latin characters. Technical filenames and legacy storage keys retain `kiber-vengance` for compatibility.
- It should feel like a complete creative instrument, not a dashboard or musical toy.
- The default language is English; Spanish is available and the preference persists.
- The interface prioritizes speed, clarity, an aggressive character, and practical desktop use while retaining a functional mobile experience.

## Implemented product

### Composition and structure

- Five tracks: lead, guitar, bass, pad, and drums.
- Independent clips per track, each 1, 2, 4, or 8 bars long; the former practical limitation of a 12×13 grid no longer exists.
- Multi-octave piano roll, seven-piece drum sequencer, zoom, and grid resolutions from 1/64 to 1/4.
- Note editing through creation, drag, resize, velocity, duration, deletion, copy/paste, undo/redo, and quantization.
- Multiple selection with `Shift`, `Ctrl/Cmd+A`, and a rectangular mouse marquee; `Shift` adds to the current selection.
- Section-based arrangement with five clips, repeats, names, duplication, deletion, reordering, and automatic distribution.
- Key, scales, chords, riffs, bass lines, beats, Mutation, and a backing generator with 2–6 sections.
- The backing generator creates bass, pad, and drums in cinematic, driving, or dark styles while preserving guitar and lead.
- The v6 arrangement supports multi-selection, copy/paste/duplicate/delete, generated one-bar fills, zoom, named markers, exact timeline cursor placement, loop/punch regions, and serializable tempo/meter maps.
- Launch is a dedicated five-track clip matrix. Launches are beat/bar quantized, can stop one track independently, accept MIDI notes 36–63, and can be captured as new arrangement sections.

### Sound and performance

- Native Web Audio with stable look-ahead scheduling, explicit voice management, and persistent buses.
- Two-oscillator polyphonic synthesis, ADSR, LP/HP/BP filters, unison, detune, glide, panorama, and presets.
- Guitar through a plucked-string model with pick attack, harmonics, and body resonance.
- Synthesized drums with kick, snare, closed/open hat, tom, percussion, and crash.
- Arpeggiator, LFO, cutoff/volume/pan automation, and saturation, distortion, chorus, delay, reverb, tone/EQ, compression, and limiter effects.
- Six macros: energy, darkness, tension, aggression, space, and complexity.
- The arpeggiator, LFO, effects, and macros belong to the clip rather than globally to the track. Every clip preserves and exports its own character.
- Visual keyboard and chromatic QWERTY `A W S E D F T G Y H U J K` for the current octave in Compose and Live, with drum pads retaining `A S D F G H J`; recording remains quantized or free, with metronome, count-in, swing, and 4/4, 3/4, and 6/8 time signatures.
- Shared active-key styling now falls back to cyan when no track color is inherited. This keeps the Prism Keys keyboard in Audio & Sampler visibly illuminated for mouse, touch, QWERTY and MIDI playback.
- Web MIDI supports note-on/off, velocity, pitch bend, channel/poly pressure, and CC74/timbre when supported by the browser.
- Perform includes a dedicated Scratch Deck. It renders the active mix into a temporary 1/2/4/8-bar buffer, accepts direct local audio import through the browser's Web Audio codecs, and receives edited Audio Studio regions through `Load Deck`. It provides sample-interpolated bidirectional touch/mouse/keyboard scratching, waveform feedback, crossfader, filter, sync, brake, spinback, and tempo-derived stutter through an `AudioWorklet`.
- Audio Studio provides arbitrary non-destructive audio lanes and regions. Local files, microphone recordings, and committed Scratch Deck buffers support position, length, source offset, gain, fades, pitch, source BPM, reverse metadata, and rate-based tempo warp in live playback and offline WAV.
- Audio Studio also contains **Prism Keys**, a persistent chromatic sampler with a large multicolor 25-key keyboard, strong per-note light feedback, waveform, root note, trim, tuning, level, low-pass filter, attack/release, 1–24 voice polyphony, reverse, and gate/one-shot/loop modes. It is playable by touch/mouse, the full chromatic QWERTY row `A W S E D F T G Y H U J K`, and velocity-sensitive MIDI when armed; `Z/X` or the visible octave buttons move QWERTY between C3–C4 and C4–C5. Record Take captures its live master output.
- The Automation Lab stores global lanes with curve points and write-mode metadata, audible LFO modulation routes, and persistent MIDI CC Learn mappings. Musical transforms include retrograde, inversion, double/half time, and deterministic humanization.

### Mixing and isolation

- Per-track Mute and exclusive Solo: enabling Solo makes only that instrument audible; switching Solo transfers the isolation, and pressing it again restores the full mix.
- `Shift+S` toggles Solo on the active track. Unmodified `S` remains a musical key.
- `Shift+M` toggles Mute on the active track.
- Mutation was reassigned to `Shift+V` to avoid colliding with Mute.
- Typing in fields or in the `Ctrl/Cmd+K` palette never triggers notes or mixing shortcuts.
- Mix is a dedicated five-channel console with stereo RMS/peak metering, peak hold, approximate momentary LUFS, dB faders, pre-gain, pan, pre/post delay/reverb sends, Solo/Mute, customizable track colors, master FX bypass, and loudness-matched in-memory A/B comparison. Faders act at the persistent bus, so sustained voices respond immediately. Mixer edits participate in project undo/autosave.
- v6 adds mixer-group assignments, group levels, kick-triggered sidechain ducking, target-LUFS and ceiling controls, and a mono compatibility check.

### Transport and performance capture

- The global song locator and active-clip locator select an exact musical start position. Playback begins from the selected scene/repeat/step rather than always returning to zero; the Arrange timeline also sets the global locator.
- The dedicated Pause control preserves the active clip or global song playhead. Resume schedules imported audio from the matching source offset instead of restarting or dropping a region that began before the cursor. Audio view uses song-mode playback so its lanes sound from the global transport.
- `Perform` records the audible master in real time, including live notes, macros, mixer changes, launcher actions, and Scratch Deck output. Audio is persisted locally in IndexedDB, while the v6 project stores take metadata and an editable, quantizable event log.
- Takes can be trimmed, renamed, replayed, exported, or deleted. Individual automation events expose editable time/value and deletion; replay applies those edited events over the exact captured audio.

### Presets and local samples

- Preset Vault provides search, tags, favorites, user presets, and JSON bank import/export alongside the factory bank.
- Each of the seven drum voices accepts a private local audio sample with trim, semitone tuning, attack, release, and reverse. Blobs remain in IndexedDB; missing assets are reported and fall back to the synthesized kit.
- Project Package exports an uncompressed ZIP containing the v6 JSON and available local sample and Audio Studio assets.
- Prism Keys stores its source blob in IndexedDB and includes it in Project Package; plain JSON preserves only the sampler settings and asset reference.

### Projects and export

- Local autosave with v2/v3/v4/v5-to-v6 migration, templates, duplication, named and automatic recovery snapshots, restoration, and JSON/package import/export.
- Autosave updates `localStorage`; it does not modify previously downloaded files.
- Stereo WAV at 44.1, 48, or 96 kHz and type 1 MIDI can export the full song or the active clips. WAV and MIDI respect the arrangement, repeats, arpeggiators, automation, expression, and independent character of every clip.
- The header separates `EXPORT` from `EXPORT AS`: Export repeats the last recipe into its linked file, while Export As opens the format/destination dialog. `Ctrl/Cmd+E` exports and `Ctrl/Cmd+Shift+E` opens Export As.
- In browsers with the File System Access API, Export asks for a destination when none is linked and subsequently updates it. Export As always asks for a new destination. Handles can be inspected or forgotten in Project Core and are stored locally in IndexedDB.
- WAV supports 16-bit PCM or 32-bit float, 44.1/48/96 kHz, optional TPDF dither and peak normalization, configurable FX tail, dry rendering, and loop-region export. The cancellable stems queue exports any selected master/tracks plus a manifest and reports progress.
- Browsers without that API retain the safe download fallback and may add a suffix when a filename already exists.

### UX, identity, and accessibility

- Professional cyberpunk visual remaster with a multicolor palette, an original К/V signal-core vector emblem, Cyrillic/Latin wordmark, technical typography, high contrast, and a music-studio hierarchy.
- The emblem uses an open mechanical hexagon, fused К/V geometry, and an audio-signal incision. Header, boot, about, Performance Deck, Scratch Deck, favicon, and PWA icon share the same mark. Motion is restrained and honors `prefers-reduced-motion`.
- Forge, Launch, Audio, Arrange, Mix, and Perform views; Focus mode; collapsible racks with persistent state; command palette; contextual help for each control; manual; and interactive tutorial.
- Compact workspace density, 80–120% interface scaling, responsive breakpoints, and track colors persist without changing musical data. Wide editors scroll locally and the page must not gain global horizontal overflow.
- Mobile knobs with −/+ buttons and large touch targets.
- Responsive layout without global horizontal scrolling; wide subsystems deliberately use local scrolling.
- Focus, hover, active, disabled, loading, and error states; automated auditing with axe-core.
- Decorative horizontal lines that looked like visual artifacts were removed.

## Agreed shortcuts

- `Space`: play/stop.
- `A S D F G H J K`: performance/recording.
- In armed Prism Keys: `A W S E D F T G Y H U J K` plays a chromatic octave and `Z/X` moves it down/up.
- `1`–`5`: select track.
- `Ctrl/Cmd+K`: command palette.
- `Shift+S`: Solo the active track.
- `Shift+M`: Mute the active track.
- `Shift+V`: Mutation on the active clip.
- `Shift+F`: Focus mode.
- `Shift+G/A/P`: Forge/Arrange/Perform.
- `Shift+L`: Clip Launcher.
- `Shift+X`: Mix Console.
- `Ctrl/Cmd+E`: repeat the last export into its current destination.
- `Ctrl/Cmd+Shift+E`: open Export As to choose format and destination.
- `Shift+N/D/Q`: new clip, duplicate, and quantize.
- `Ctrl/Cmd+A/C/V`: select all, copy, and paste notes.
- Arrow keys: move selection; `Alt+←/→`: resize; `Delete/Backspace`: delete.
- `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`: undo/redo.

## Current architecture

- `src/model.ts`: serializable v6 hybrid project contracts.
- `src/core.ts`: music/audio model, migrations, clips, regions, automation, transforms, arrangement, generators, playback, and MIDI.
- `src/audio.ts`: hybrid Web Audio engine, voices, regions, buses, modulation, routing, scheduling, and offline WAV rendering.
- `src/scratch-worklet.ts`: off-main-thread bidirectional scratch buffer processor with interpolation, stutter, and live position reporting.
- `src/app.ts`: interaction, UI rendering, persistence, accessibility, commands, and export.
- `dist/`: distributable static application/PWA.
- Preact is bundled locally; optional WebLLM inference runs in a worker with an explicit first model download. No inference server or remote project storage is used. TypeScript, ESLint, Playwright, Selenium/geckodriver, and axe-core are development tools.

## Licensing

- The application source, build/test tooling, configuration, and generated application code are GPL-3.0-or-later; the full text and scope are in `LICENSE`.
- Musical works and project files in `projects/`, currently including **The Arrival**, are excluded from the software licence and use CC BY-NC-ND 4.0 under `projects/LICENSE.md`.
- The CC licence permits attributed, non-commercial redistribution of an unmodified project. Commercial use, remixes, adaptations, stems, synchronization, and altered distribution require prior written permission from КИБЕР VENGANCE.
- The КИБЕР VENGANCE name, logo, and other trademarks are not licensed by either file. Music created independently by application users remains outside this policy.

## Current validation

- `npm run check:full` is the mandatory quality gate.
- The mandatory final state is a clean `npm run check:full`, including the v6 Audio Studio workflow and 1366×768 density check.
- Coverage includes migration, serialization, editing, generators, arrangement, a ten-minute scheduler run, Solo, buses, metronome, MIDI export, Firefox with audio/WAV, and Chromium responsive/a11y/PWA/Prism Keys behavior.
- Export/Export As, reusable file handles, fallback downloads, local/global seek, the five-channel mixer, performance capture, Scratch Deck, and the full Firefox WAV workflow are covered.

## Deliberate and honest limitations

- Projects live in the browser; there are no accounts, backend, cloud, or remote collaboration.
- Clearing browser data can remove autosave: exported JSON is the portable backup.
- Web MIDI depends on browser support and user permission.
- Safari/iOS requires physical verification on Apple hardware.
- The guitar is an expressive synthetic instrument, not a multisampled acoustic library.
- There are no VST/AU plugins or commercial samples.
- Reusable export destinations require File System Access support. Unsupported browsers download a new revision; supported browsers may ask to renew write permission after a restart or browser-data cleanup.
- Scratch buffers remain temporary unless committed through `Resample Deck`; recorded performance audio persists in IndexedDB and its event data is serialized in v6. Editing events changes event replay; it does not retroactively re-synthesize the already captured compressed audio.
- MediaRecorder container/codec support is browser-dependent. Performance capture is normally WebM/Opus in Chromium; deterministic composition, local samples, and stem exports use WAV.
- Direct Scratch Deck import supports WAV plus MP3, OGG, WebM, and other formats only when the current browser exposes the corresponding decoder through `decodeAudioData`; unsupported codecs produce a visible error.
- Sample and Audio Studio blobs are device-local and are not embedded in plain JSON. Project Package is required to move them; if an asset is missing, the serialized edit remains but cannot sound until the blob is restored.
- Audio warp currently uses native playback-rate conversion. Tempo and pitch therefore move together; independent pitch-preserving time stretch would require a separate granular/phase-vocoder worklet and is not claimed by the current UI.
- `OfflineAudioContext` cannot interrupt DSP already in progress. Export cancellation is observed before and after each render and between selected stems, and prevents subsequent file writes; an individual stem already rendering must finish first.

## User collaboration preferences

- Git commit identity is configured locally for this repository; do not duplicate its name or email in versioned memory.
- Implement autonomously and completely, avoiding partial deliveries.
- Third-party software may be used when it clearly improves the result.
- Fix real limitations instead of hiding them, and keep documentation honest.
- After implementing features, prioritize a fast UX, aggressive design, and professional quality.
- Keep the product bilingual, with English as the default language.
- Every new visible feature must work, include help where appropriate, and receive validation proportional to its risk.

## Rule for future sessions

Before modifying КИБЕР VENGANCE, read this file, `kiber-vengance.md`, `PRODUCT_PLAN.md`, and the current test state. If the code contradicts this memory, verify the behavior and update the documentation; do not perpetuate stale information.

## Sites mobile scrolling correction

- Mobile and tablet layouts through 820 px use document-level vertical scrolling, including at 80–120% UI scale. The app height follows its content; workspace clipping is horizontal only. The piano roll and horizontal control strips retain their own local scrolling.
- The Service Worker cache revision is v20-mobile-scroll.
- Validation: dedicated Chromium checks with touch gestures passed at 320/390/768/820 px and UI scales 0.8/1/1.2; the footer was reachable in each case. Desktop layout was checked at 1366 px with all three scales. Typecheck, build, lint and the unit-test command passed. The repository Firefox/Chromium E2E commands failed in this environment; no full-suite pass is claimed. Physical Safari/iOS validation remains outstanding.

## Composition-first usability update (2026-10-24)

- Clips is the default editing workspace; Sound reveals existing synth, motion, FX and macro racks. The four direct destinations are Clips, Sound, Arrange and Mix; Launcher, Audio Studio and Perform remain accessible through the main mode bar.
- Mobile through 820 px has a fixed transport and bottom navigation, 44 px primary controls, document scrolling and native device scale. Desktop retains the adjustable UI scale. Mobile scale selector is disabled with an explanation.
- A context strip identifies track, clip and bars and explains note recording versus audio takes. The piano roll has Draw, Select (tap to toggle notes) and Navigate (scroll without editing) tools. Music generation/harmony is disclosed on demand. New clip and Undo are directly available by the editor.
- Export presents complete project package, audio and MIDI first. Advanced rendering options, other formats and linked destinations remain available in disclosure panels.
- Autosave writes the current project before optional recovery snapshots. Failures display a persistent local-save warning; failed recovery snapshots do not block the project save. Duplication, generation and quantization offer Undo feedback.
- Validation: typecheck/build/lint/unit-test command passed. Dedicated real Chromium workflows passed at widths 390, 768 and 1366: create/duplicate/undo clips, draw/select/navigate, export disclosures, quota-failure feedback, transport visibility and absence of horizontal overflow. Existing full E2E suite still fails in this environment; Safari/iOS physical verification remains pending.

## Touch editing and usability completion (2026-10-24)

- Selection actions duplicate, quantize or delete only selected notes. Duplication selects the copies and refuses overflow with an instruction to extend the clip. Quantization uses the current snap grid.
- Undo feedback now covers clip creation/variation/deletion, note deletion, selection edits, backing generation and clearing automation. Toast timers no longer dismiss newer feedback early.
- Automation is collapsed until requested. Shared controls and dialogs have larger text and touch targets; mobile inputs use 16 px text to avoid focus zoom.
- Forge, Perform and Prism piano keys use `touch-action: manipulation` to suppress double-tap zoom while retaining browser pinch zoom. Forge/Perform track separate pointer IDs and release held voices on pointer cancellation, lost capture, blur and page hiding.
- Validation: `npm run check` passed. Dedicated Chromium workflows passed at 390/768/1366 px, including selected-note actions and Undo, automation disclosure, repeated touch taps without scale changes, blur voice release, all six views without horizontal document overflow, export and autosave-error feedback. `npm run check:full` could not complete: its configured Playwright browser and Firefox binary are absent. Physical iPhone/Safari validation remains outstanding.

## Mobile note release and position sliders

- Cancel pending live-note initialization when a finger is released before audio initialization finishes. Global pointer release/cancel also clears held keys.
- Mobile song/clip position ranges flex across the remaining width instead of retaining the native input width.
- Typecheck, build, lint and core tests passed; physical iPhone verification remains pending.

## Precision touch dials

- Dials support continuous captured pointer dragging: vertical movement spans the range in 300 px, horizontal movement is five times finer; Shift adds desktop precision. Other fingers cannot interrupt a dial gesture. Release, cancellation, lost capture and blur clean up the gesture. Plus/minus remain available.
- Dial and scratch surfaces own touch gestures; Perform buttons/ranges suppress double-tap zoom without disabling page pinch zoom. Physical iOS validation remains outstanding.

## Audio transport and Scratch Deck sources (2026-10-25)

- Audio Studio now stays in song mode when the global Play control is pressed, fixing imported regions that were visible but silent.
- A dedicated Pause button stores the current clip/song cursor. Resuming inside a running audio region derives the correct source offset, remaining length and fade state.
- Every Audio Studio region has `Load Deck` / `Al plato`; its temporary scratch buffer applies source offset, region length, lane/region gain, fades, pitch/tempo rate and reverse.
- Perform adds direct local Scratch Deck import for browser-decodable WAV, MP3, OGG, WebM and related audio formats. The deck buffer remains temporary and non-destructive.
- Service Worker cache revision is `v25-audio-scratch-pause`.
- Validation: `npm run check:full` passed with 26 core tests and all 10 Chromium/Firefox functional workflows, including Audio Studio import/play/pause/resume and both Scratch Deck loading paths.

## Scratch input and controls

Microphone capture loads a temporary scratch buffer, stops playback after capture, releases microphone tracks and limits recording to 60 seconds. Stutter supports whole-note divisions 1/1–1/64. Motor speed (with pitch change), reverse and restart are available. UX_REVIEW.md records observed inconsistencies and proposed work, not completed global standardization.

## Consistency and waveform seeking

Scratch waveform supports touch/mouse seeking and keyboard arrows/Home/End without starting paused audio. Seeking clears stutter. Keep in project persists a scratch copy as an audio region. Shared control typography/targets/focus states and bilingual main action labels are applied. Audio additions and several creation operations now snapshot history. Tempo/meter use validated cancelable dialogs. See UX_REVIEW.md for implementation boundaries. Dedicated Chromium simulated-microphone, waveform seek and save workflow passed; check passed; physical Safari remains unverified.

## Studio interface refactor (2026-10-25)

The approved four-workspace interface is implemented using Vite, a Preact shell and shared keyboards/dials/dialogs. Ten feature controllers preserve the music workflows and project schema v6. Signal KV is the selected SVG identity. Common typography, focus/disabled states, inspector, bilingual catalog and pointer lifecycles replace the previous navigation/control patches. Hidden panels render on demand; inactive animations stop and waveform envelopes are cached. Native edit prompts are replaced by validated cancelable dialogs. See `docs/REFACTOR.md` for feature parity, implementation decisions, performance evidence and real-device limits. Earlier descriptions of Forge/Audio/Perform as top-level tabs describe the previous interface.

Final refactor validation: `node scripts/with-null-audio.mjs npm run check:full` passed, including 12/12 Chromium/Firefox workflows with no skips. Hardware input/output and physical Safari remain unverified. Initial DOM is 1,342 nodes versus the 1,790-node local baseline. Full evidence and limitations: `docs/REFACTOR.md`.

## Neon visual restoration (2026-10-25)

The studio keeps the four-workspace layout while restoring a stronger cyberpunk identity. Shared tokens now use a blue-black base and brighter cyan, magenta, amber, lime and violet accents. Navigation and track cards have clear active states; headers, the piano roll, keyboards, launcher, mixer and Scratch Deck use restrained gradients or glows. The changes are CSS-only and do not alter audio, touch behavior, project files or storage. See `docs/DESIGN.md` for color semantics.

## Scratch Deck module loading correction (2026-10-25)

Scratch Deck loads Vite-transformed source in development and a Vite-bundled, hashed processor URL in production. The former document-relative `./scratch-worklet.js` request returned the HTML fallback in development, producing Firefox's `expected expression, got '<'` error on import and mix capture. Development must avoid the classic worker wrapper because AudioWorklet has no `importScripts`. Firefox regression tests cover both actions from fresh pages against development and production servers. Project data and audio processing are unchanged.

Resumed validation after the interrupted session: `npm run check:full` passed on 2026-10-25 with 26 core tests and 14 Chromium/Firefox workflows, with no skips. Firefox independently initialized the deck through local WAV import and Capture Mix in development and production. The static build and offline cache include the hashed processor. Tests required execution outside the restricted process sandbox; this host used its existing audio service, without the optional PulseAudio null-sink wrapper. Physical sound output was not assessed.

## Dual live decks (2026-10-26)

Live has independent Deck A and Deck B AudioWorklets, waveforms, touch platters, import/capture/microphone sources, seek, filters, motor speeds, stutter and transport. A constant-power crossfader balances the two decks; the existing Program/Deck slider balances their combined output against the song. Each deck accepts an editable source BPM; Sync adjusts playback rate and pitch to the project BPM. Deck A remains the target of Audio Studio's Load Deck action for compatibility. Both temporary buffers can be kept in Audio Studio, and both decks enter Record Take's audible master. Cue can route one deck at a time to a user-selected separate output when `selectAudioOutput` and `setSinkId` are available; it is excluded from master capture. Cue is disabled when separate routing is unavailable. Buffers remain temporary until kept, and pitch-preserving stretch is not offered.

Validation: `node scripts/with-null-audio.mjs npm run check:full` passed outside the restricted process sandbox with 28 core tests and 21 Chromium/Firefox browser workflows. The new mobile workflow loads Deck B before A, verifies independent BPM/play states, waveform seek, actual crossfade gain values, a simulated separate Cue output, and axe serious/critical findings. A real headphone device, audible output latency and physical Safari/iOS remain unverified.


## Instrument presets per clip (2026-10-25)

Each clip now stores `instrument`: preset, oscillator waves/mix, filter, ADSR, glide, unison and detune. Sound edits and factory/user preset loading affect the active clip only. Level, pan, mute, solo, pre-gain, sends and routing remain on the track; loading a preset never overwrites them, including older user banks containing mixer fields. New clips and duplicates inherit independent instrument copies; generated backing clips and fills inherit their source instrument. Autosave, history, snapshots, JSON and packages retain the settings.

This is an additive v6 field. Loading v2–v6 projects without it copies the old track instrument into each clip, preserving the existing sound. Legacy track instrument fields remain readable for compatibility but no longer drive normalized clips. New files require this application revision to reproduce different instruments per clip; older builds ignore the field. Live keys, clip playback, launcher, arrangement, Scratch Capture Mix and offline WAV/stems resolve the sounding clip's instrument. Voices retain their instrument snapshot, including release, when the clip or preset changes. Global cutoff automation applies to the resolved voice without overwriting saved clip settings. MIDI Learn cutoff edits the active clip instrument; MIDI volume/pan mappings still target the track.

Live effects still use the existing persistent bus per track: switching presets does not rebuild it or clear delay/reverb buffers, but changes to clip effects can color an existing tail. Fully isolated live effect tails per clip are not implemented. MIDI exports notes/expression, not these custom synthesizer patches; use WAV or a project/package to preserve the sound.

Validation: `npm run check:full` passed with 28 core tests and 16 Chromium/Firefox workflows, without skips. New coverage verifies v2–v6 migration, independent copies, song/active-clip scheduling, cutoff automation, preset switching and history, new-clip inheritance, reload, saving/importing user banks without mixer changes, simulated MIDI CC cutoff isolation, real offline WAV segment comparisons and live held-voice envelope retention. Physical MIDI/audio hardware remains unverified.


## Local clip play/pause (2026-10-25)

The clip locator button toggles between `▶ CLIP` and `Ⅱ PAUSE` (`Ⅱ PAUSA` in Spanish). During clip playback it pauses through the shared transport, retaining the clip cursor; pressing it again resumes there. Its visible state, accessible label and help follow global play/pause/stop and language changes. While song playback is running it remains a clip-start action and switches to clip playback, preserving the previous behavior. Startup disables the local button until audio initialization completes to prevent duplicate starts. This controls the active-clip mix, not a solo of the selected track.

Validation: `npm run check:full` passed with 28 core tests and 18 Chromium/Firefox workflows, no skips. Both browsers verify local pause, stable paused cursor, resume from that cursor, synchronization with global transport and switching from song to clip playback.

## Load arrangement section into Compose (2026-10-25)

Every Arrange section exposes `LOAD TO COMPOSE` / `CARGAR EN COMPOSE`. It copies the section's five clip assignments into the active clip set, clears note selection, closes the Sound inspector and opens the Compose clip editor while preserving the selected track. It does not alter the section, notes or mixer. This is navigation/session state and participates in autosave like changing an individual Active Clip selector. Firefox and Chromium verify all five resulting selectors and the bilingual label.

Validation: `npm run check:full` passed with 28 core tests and 20 Chromium/Firefox workflows, without skips. The accessibility audit also covers the new action's visible and spoken labels.

## Touch note editing (2026-10-26)
Notes own touch gestures in Draw and Select, with pointer capture on the stable roll surface while note DOM is redrawn. Dragging the body changes time and pitch; the enlarged right edge changes duration. Select still toggles on a stationary tap. Navigate permits scrolling. A Chromium CDP touch regression checks movement, edge resizing and undo; physical iPhone remains unverified.

## Mobile deck slider layout (2026-10-26)
The A/B crossfader and Program/Deck blend now occupy distinct mobile grid rows, with Cue below them. The previous shared `grid-row: 2` overlapped both labels. Chromium layout checks passed at 320, 390, 430, 768, 820 and 1440 px with separate control rectangles and no page overflow; npm run check passed.

## Focused editor/deck/state refactor (2026-10-27)

Scope is limited to piano-roll rendering/gestures, the dual decks and their mixer, persistence contracts, associated CSS, tests and these notes. The AI implementation, preset catalogs, keyboards and musical schema are unchanged.

- `ui/piano-roll.ts` owns keyed note DOM and cached grid geometry. `features/note-editor.ts` updates only selected note geometry, at most once per animation frame. Gesture completion refreshes metadata once and commits one typed edit transaction. Existing note and ruler nodes survive a drag.
- `audio/deck.ts` owns one typed processor per deck, with correlated load acknowledgements and explicit replacement of a pending load. AudioWorklet startup is shared through a single initialization promise. Compatibility getters in AudioEngine delegate to these processors instead of maintaining a second state copy.
- `features/deck-controller.ts` renders and binds the same control surface for A and B, including capture/import/microphone, seek, transport, stutter, filters, motor and Keep in project. `dual-deck.ts` owns only layout, crossfade and Cue. Existing DOM IDs and Audio Studio's Deck A entry point remain compatible.
- `state/contracts.ts` defines narrow editor/deck interfaces independent of RuntimeContext. The app's project and history are typed as Project; `state/project-session.ts` owns checkpoint/edit commit and debounced persistence/recovery. The legacy RuntimeContext facade remains for untouched features, and AudioEngine's unrelated legacy internals are not claimed to be fully typed.
- Piano/deck geometry and component styling now live in `styles/piano.css` and `styles/decks.css`. Legacy declarations that were unconditionally overridden were removed; shared generic control vocabulary and keyboard/appearance styles remain in their existing owners.

A local Chromium CDP comparison against release 9298a7a, with a 256-note clip and the same five touch moves, observed 1,028 inserted and 1,028 removed sequencer children before versus zero after; ruler child mutations fell from eight to zero. This measures DOM work, not audible latency or field load speed. The measurement and responsive checks are in docs/refactor-metrics.json.

Validation keeps the deck accessibility audit scoped to its controls. Five pre-existing `label-content-name-mismatch` findings on the Live keyboard were independently reproduced against the original compiled release; the keyboard was left untouched as requested. Test screenshot paths now use the platform temporary directory rather than /private/tmp, including AI test artifacts only. Physical iPhone, microphone/headphone hardware and audible latency remain unverified.

Final gate: `node scripts/with-null-audio.mjs npm run check:full` passed outside the restricted process sandbox: 46 unit tests and 37 Chromium/Firefox browser flows, no skips. The portable Vite-based unit-test loader was checked separately after replacing Node's experimental TS stripping. The final mixer labels/sliders were also checked at 390 and 1440 px. This is functional and structural verification; the baseline keyboard accessibility findings and physical-device limits above still apply.

## Volume, non-destructive audio FX and local interpretation (2026-10-28)

- User authorized the complete volume/FX/voice plan, with clip and track processing, quality prioritized, browser-only inference and delivery of verified capabilities if free-form instructions are not feasible. No DNS changes are authorized or needed. Keep edits limited to this work; commit as suizman.
- Additive v6 outputMix separates retained legacy Program (`project.master` and its automation/MIDI events) from a final Master that includes both decks. Independent A/B levels, Cue, preview and global output mute persist. Common logarithmic controls cover instruments/audio/sampler/groups/output, numeric/reset/Shift fine adjustment and pointer cancellation. Audio lanes join Mix. Actual stereo sample meters replace the old pan-derived approximation. Pre-gain moves before instrumental/audio processing; sampler level affects held voices.
- Shared AudioFx provides lazy neutral/default graphs, per-region overlap isolation, lane processing, independent on/off, Original/Processed, deterministic reverb and 2.5s live tails. Stop/seek disposes graphs; export uses the same DSP and selected tail/dry settings. Audio Studio has Clip/Track treatment tabs. Original files and IDs remain untouched; voice insertion copies treatment and supports original/processed WAV downloads.
- Kokoro revision is pinned. Per-line speech fragments support speed and following pauses. Explicit tokenizer JSON/config loading avoids a real library loading failure. Genuine q8 ES/EN generation passed (~19.7s English / 13.0s Spanish under concurrent workload), retained-worker offline Spanish inference, insertion, Undo/Redo and reload. A two-fragment Spanish run with speeds 0.8/1.2 generated genuine audio (~13.1s) and passed retained-worker offline inference; its adapted one-language harness then incorrectly expected two inserted regions. That harness assertion is separate from the successful fragment inference.
- Chatterbox is independently implemented from its MIT ONNX tensor interface with pinned LM/embedding, quantized decoder and multilingual voice vector revisions. First real outputs were near-silent: Transformers interpreted symbolic template tokens as unknown IDs. Explicit numeric template IDs, compared with the reference tokenizer, fixed actual ES/EN inference (46,080 / 42,240 samples with nontrivial signal energy). No source from the differently licensed Quick Inference app was copied. Download is optional (~568 MB plus runtime); CPU is slow, progress/cancel/cache cleanup remain visible. The model registry declares intensity but no arbitrary instruction capability.
- Qwen3-TTS 1.7B CustomVoice has instructions in the official Python workflow, but the official pinned assets do not establish a complete browser integration. No instructions box, local Python server or remote inference substitutes for that gate. Singing and broad naturalness preference remain unverified. Model weights are separate from music assets and are not included in Project Package.
- Validation/release completion is recorded below after the final gate. See `docs/AUDIO_MIX_AND_VOICE.md` for routing, defaults, exact model revisions and compatibility limits. Physical iPhone/Safari, hardware audio and human preference remain separate acceptance work.
- Final functional gate: `npm run check:full` passed **57 unit tests and 48 Chromium/Firefox workflows**, no failures/skips. After removing the unverified GPU selector and strengthening the bypass assertion, `npm run check` passed again and all **5 focused mixing/voice browser workflows** passed. Distribution footer identifies source `35ef1d8`. Checks include genuine DSP/export signals, audio-clock-based final Master/Cue/preview routing, persisted silence before the first live voice, clip/track effects and original-asset preservation. Initial failures in adapted test selectors/range expectations and an asynchronous deck-status assertion were corrected; no failing workflow is hidden or skipped.
- Real Chatterbox CPU audition files for identical Spanish text at intensities 0.3/0.8 differ in bytes and duration (2.48/2.28s), with nontrivial RMS; English is 1.56s. Evidence hashes are in `docs/audio-voice-evidence.json`; session WAVs `/tmp/kv-expressive-{es,es-emphatic,en}.wav` remain for listening. These are genuine inference, not a human preference result. WebGPU required the correct JSPI/Asyncify factory rather than JSEP; its software-adapter trial loaded the graphs and generated tokens but timed out before a complete phrase at 300 seconds. **Only CPU is exposed in the published selector.** GPU completion/hardware performance and Qwen free-form direction remain pending.
- Reviewable source commits: `06574c8` unified levels/audio FX; `2ea7999` local expressive/paced speech; `fa0b0ba` persisted-level startup; `35ef1d8` verified CPU-only selector. All use the requested suizman authorship. Publication status is appended after the native deployment completes.
- Publication completed: GitHub runtime/build delivery pushed through `ad4815f`; isolated Sites source `c537ad4fad9833866d3a7cb0744fcabd078e1770` saved as **version 33** and deployed with native terminal **succeeded** on 2026-10-28T01:20:47Z. Deployment `appgdep_6ae14ddbc59c81919da516ec67df7602`; existing public audience and `https://studio.suizman.org` configuration preserved. Runtime footer `35ef1d8`. No Cloudflare/DNS operation was performed.
- Automatic review rejected the first broad Site cleanup proposal. The completed safer synchronization updated only release-added/modified paths, retained all existing Site-only files (13 older generated asset hashes), preserved `.openai/hosting.json` byte-for-byte, and verified that every current GitHub tracked file matched the Site checkout before packaging/push. No Site file deletion was performed. That resolved the rejection without an additional permission request. A documentation-only GitHub follow-up records this native publication and does not require rebuilding or redeploying the identical runtime.


## Mobile Chatterbox restart protection (2026-10-28)

A user reported that loading Chatterbox on mobile restarted the page. Its approximately 570 MB of downloaded weights require additional runtime/session memory; an OS/browser out-of-memory kill cannot reliably be caught in JavaScript. The exact failure on the user's physical device has not been measured.

Chatterbox is now unavailable on detected phones/tablets (including iPad desktop user agents) and devices reporting 4 GB RAM or less. The dialog explains this before any download and offers **Use Kokoro q8**, preserving text/language and prior generated audio. The service and worker enforce the same admission policy; shrinking a desktop window alone does not block it. This is a conservative compatibility policy, not a measurement or guarantee of free memory. Desktop Chatterbox remains experimental; no mobile Chatterbox inference capability is claimed.

Large Chatterbox model/runtime downloads no longer await Cache.put on a cloned response while leaving its twin unread. They stream directly into Cache Storage, then read the stored response once. Cache failure triggers a new online request rather than retaining a fallback copy in memory. Download progress reports received MB; runtime blob URLs are revoked after session initialization, and changing engines terminates the previous voice worker. Music assets, DNS and project schema are untouched. Physical iPhone/Safari and peak-memory measurements remain unverified.

Validation and publication results are appended after the release gate.
