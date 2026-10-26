# Local AI composition

The generator is shared by Compose → AI melody, the Project menu, Settings and the bilingual command palette. It uses the existing optional CPU/GPU models and creates editable v6 clips. Model downloads remain explicit; prompts and musical context are processed on the device.

## A short workflow

1. Select the clip and track you want to work with, then open AI melody.
2. Choose **New idea**, **Continue this clip**, **Answer this clip**, **Vary this clip**, or **Same motif, new rhythm**. Source-based modes need a nonempty melodic clip. They work without a mandatory written prompt; an optional prompt refines the request.
3. Choose a style or recipe, key, scale, length and preview BPM. **Fit the active clips** is enabled initially and can be turned off.
4. Load a model explicitly and generate. One inference produces a motif/intent plan; the local music engine makes up to three distinct arrangements. A/B/C are arrangements of that plan, not three independent model calls.
5. Listen, switch proposals, shape the notes, or select bars to regenerate. Add the chosen result as a new clip. The source stays intact, and insertion supports Undo/Redo and autosave.

## Context and source modes

Opening the dialog snapshots the selected clip and the other active melodic clips. Bass and pad notes have the strongest harmonic weight; other melodic tracks provide lighter guidance. The engine ranks pitch classes by their duration within each bar, accounting for clip loops. These are note-derived harmonic hints, not claimed chord recognition from recorded audio. For continuation, accompaniment is read after the source clip's bar span.

The model receives a bounded summary of source pitches and accompaniment. The compiler also uses that context directly, so useful harmonic alignment does not depend entirely on the small model understanding the summary. Context includes at most 512 notes per active melodic clip. It does not inspect inactive clips, the whole arrangement, audio regions or external material.

Continue develops the end of the source motif into a new standalone phrase. Answer reflects its contour. Variation retains the source rhythm when density is automatic (the rhythm selector explicitly shows From source clip), while the rhythm mode reuses its pitch sequence on a new grid. A polyphonic clip contributes its upper line at each onset. Automatic-density variations preserve silent source bars. Register changes transpose the source motif by octaves before fitting the selected range. Source-based modes still obey the selected key, scale and leap bounds; they are not guaranteed literal copies.

## Musical shaping

**Phrase with ending** adds development/tension and favors a final tonic or accompaniment tone. **Loop** favors a return to the opening pitch class. **Free** leaves out the cadence rule. Motif repetition and variation are deterministic probabilities; they do not promise that exactly a given percentage of the final notes will repeat or change.

**Shape the composition** exposes:

- Density: automatic, or exactly 2, 4, 8 or 12 onsets per bar.
- Low, middle or high register within the target instrument's supported range.
- Maximum adjacent-note leap: 2, 5, 7 or 12 semitones.
- Repetition and variation, 0–100%. Pitch variation is disabled in the same-motif/new-rhythm mode.

Shaping recomputes the proposals immediately from the existing model plan. No inference or weight download is needed. Changing preview BPM also keeps the generated notes; it stops the current audition and uses the new BPM for the next listen. Hard scale, register and leap constraints take priority over harmonic preferences and cadence. A sufficiently restrictive setting can yield fewer than three distinct proposals; duplicates are not presented as different choices.

The compiler stores integer sequence steps plus fractional offsets within v6’s −0.49 to +0.49 range. This is essential: the sequencer schedules integer steps, so fractional rhythm positions must live in `offset`, not be stored as fractional `step` values.

## Comparing and keeping bars

The note preview shares a pitch range across A/B/C. Loop preview uses a single isolated instance of the application's AudioEngine, selected sound and BPM. Switching A/B/C queues the new notes for the next loop; it does not create another AudioContext or reload a model. Stop, close, blur and page hiding release the preview, including asynchronous startup. The musical project and its transport remain independent.

Bar buttons choose where the next model generation may change the current proposal. Unselected notes retain their exact IDs, pitches, durations, offsets, velocities and expression. A bounded path search connects the new notes to both protected boundaries within the leap limit. If the boundaries cannot be connected, the original proposal is retained and the UI explains that more bars must be selected. A protected note crossing into the selected region is also preserved; its starting bar must be selected before replacing it.

Changing shaping controls rebuilds the entire phrase and clears the bar selection. Partial edits are provisional until the result is added as a clip. Failed or cancelled regeneration keeps the previous proposals available. Invalid musical output does not unnecessarily unload a still-usable model.

## Personal recipes

**My recipes** stores named prompts, style/rhythm/BPM, key/scale/bars, composition options and an optional native sound in `kv-ai-recipes-v1`. Search, favorites, rename, delete and Undo delete are available. Storage is bounded to 100 validated recipes. Storage errors are visible and do not claim success; an unreadable existing library is not silently overwritten.

Recipes take their context from the project currently open. Source notes, project identifiers, model weights and the Apply BPM checkbox are not saved in recipes. A saved sound is staged only for a compatible target track. This library is independent of project JSON, project undo and the existing preset catalog. It is browser-local: clearing site storage removes it, and there is no recipe-library import/export or synchronization in this delivery. Existing sound/catalog imports remain unchanged.

## Performance and limits

CPU still uses SmolLM2 135M q8; GPU still uses Qwen3 0.6B. There are no new model dependencies, simultaneous inference engines or background model downloads. Context is bounded and avoids repeating controls already enforced by the compiler; inference runs in the worker, and three candidate arrangements reuse one plan. CPU generation uses an exact compact integer-tuple grammar (at most 36 output characters) so formatting, decimal or exponent runs cannot exhaust its token budget. The model still chooses every motif degree and category; this does not invent a fallback result. Generation shows elapsed time, CPU token progress and a nearby Cancel action. Results receive focus when ready, and the dialog header remains reachable while scrolling.

Small text models can misunderstand complex prompts, especially on CPU. The music engine offers constrained motifs and phrase structure, not a trained full-song composition model. No quality claim is based solely on compilation or a simulated worker. Real inference, browser integration and musical invariant checks are distinct validation layers. WebKit cold offline worker startup and physical Safari/Orion/audio hardware remain external limitations documented in the README.

Implementation: `src/ai/composer.ts`, `src/ai/recipes.ts`, `src/ui/ai-composition.tsx`, `src/ui/ai-recipes.tsx`, the shared `local-ai.tsx` dialog and the application bridge. No project schema or keyboard shortcut changed.


## Validation and publication (2026-10-27)

Typecheck, production build, lint and all 44 unit tests passed. Eight focused Chromium workflows cover desktop/mobile and Spanish at 320 px, context/shaping, looped A/B with one AudioContext, partial-bar preservation, saved recipes, Undo/Redo, storage failure, preview-start cancellation, menu/preset regressions and accessibility. Screenshots were reviewed.

Real CPU inference passed in WebKit (4.7 s initial / 4.1 s offline) and Firefox (40.9 s initial / 34.2 s cached cold-offline). Both exercised genuine continuation, partial regeneration, selected sound/BPM in exported JSON, insertion and persistence. Times are observations on this host, not guarantees. A separate pure-composer measurement with 2,048 context notes and three 96-note proposals measured 1.4 ms median / 2.1 ms p95.

`npm run check:full` passed its check stage and seven browser workflows but encountered the existing quick WAV export write-wait timeout. The run ended at its 300-second bound; a full-suite pass is not claimed. Source commits `9acf8bc` (CPU output reliability) and `a61784f` (contextual composer) and distribution commit `e72a5cb` were pushed to the existing repository. Sites version 30 was successfully deployed at https://kiber-vengance.starrylemur35.chatgpt.site. The footer identifies `a61784f`; Site audience and repository visibility were preserved.
