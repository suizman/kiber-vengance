# КИБЕР VENGANCE — neon studio

## Visual direction

A musical instrument with a clear workspace hierarchy and a visible cyberpunk pulse. The base is deep blue-black rather than neutral graphite. Cyan identifies primary actions, magenta marks recording and the live position, amber/lime/violet add selective warmth and energy, and every instrument retains its own color. The header carries a narrow spectrum line; navigation, track cards and musical surfaces use restrained gradients and glows. Spacing, alignment and typography still establish the hierarchy, so color does not compete with editing values.

The design is implemented by `src/ui/styles/tokens.css`, `shell.css` and `components.css`. Import in this order after retained instrument-coordinate geometry. The geometry stylesheet must be in a lower-priority CSS cascade layer; the studio system is deliberately unlayered. Components use the shared tokens rather than introducing per-screen palettes.

## Type and interaction scale

Body and action text: 14 px; prominent text and touch form values: 16 px; supporting labels: 12–13 px. Musical values use a system monospace and tabular numerals. Uppercase is limited to short category labels and the brand. Action buttons have a 44 px minimum target. The navigation and dense non-touch secondary indicators have separately documented geometry; the keyboard and piano roll preserve their instrument coordinates.

Cyan identifies primary actions and focus. Magenta identifies recording and the live position marker. The active destination combines a bright label, an outline and an inset accent; an instrument's color identifies its track, notes and mixer/launcher channel. Color does not replace disabled, error or recording state semantics. Text and outlines accompany state colors.

## Workspace

Four persistent destinations: Compose, Arrange, Live, Mix. The desktop rail is 88 px wide. On mobile, the same destinations become a four-button bottom bar; there is no second competing primary navigation. A context bar establishes the current task; subtabs contain views inside that task. Instrument tracks are a horizontal strip. Sound editing lives in a contextual inspector, a right-hand sheet on desktop and a full-width bottom sheet on mobile.

The header keeps project identity, save status and transport together. At smaller widths transport has its own row rather than clipping. Overflow is owned by the musical surface that needs it: piano roll, keyboard, arranger, launcher or mixer. The document itself remains vertically scrollable on mobile. Inspector visibility must be controlled by state with an explicit close action and focus restoration.

## Shared keyboards

Synth, Live and sampler use the same keyboard component and styles. Light keys are pale graphite, accidentals dark slate. A note-down state fills the key with the selected instrument accent. Note labels and computer-key hints use the same placement everywhere. Root-note indication is a small secondary dot. Drums use the same touch lifecycle and typography in a pad variant.

The component defines note geometry; CSS must not infer black keys using `nth-child`. The exact structure is `.instrument-keyboard > .keyboard-toolbar + .keyboard-scroll > .keyboard-surface > .keyboard-key`. A key receives `.natural`, `.accidental`, `.root` and `.active` according to musical state. Pointer ownership belongs to each musical key; horizontal browsing is available in the surrounding scroll surface.

The computer-keyboard performance map is chromatic and follows the visible QWERTY row `A W S E D F T G Y H U J K` for the current octave. Drum pads retain the simpler `A S D F G H J` map; octave controls move the chromatic range without changing the key assignments.

Active keys inherit the selected track color where one exists; independent keyboards such as Prism Keys use the cyan interaction color as a visible fallback.

## Header controls

The project title, language selector, and export actions share a 40 px control line on desktop. The local-save indicator sits below the title field, while a fixed action gap keeps the language selector visually and physically separate from export controls. The selector reserves space for its disclosure arrow at every supported interface scale.

## Live decks

Deck A and Deck B sit side by side on wide screens and stack on mobile. The equal-power crossfader precedes them and remains accessible while scrolling. Magenta and cyan distinguish the two platters without replacing labels or transport state. Each deck keeps its own waveform, track BPM, speed, filter, stutter and source actions. Cue output selection is explicit because headphones require a separate browser-supported audio device; unavailable controls explain the limitation. The Program/Deck control balances the combined decks with the composed song.

Both deck headers use the same title height and control grid: capture length and track BPM share the first row, with capture/import/microphone actions below. Labels must stay aligned across the two decks instead of wrapping independently.

## Logo

`public/brand-options.svg` documents two viable geometric KV directions. **Signal (01)** is selected: square-cut paths, an open silhouette and a small magenta terminal accent. It is legible at small sizes, is easy to engrave or print in one color, and removes the overlapping waveform/glow decoration of the previous logo. `public/icon.svg` is the production favicon/PWA mark. Keep the name **КИБЕР VENGANCE** unchanged.

The selected mark uses a 64 × 64 view box. For an inline monochrome logo, reuse the path geometry and replace stroke colors with `currentColor`; no raster assets or downloaded fonts are required.

## Styling integration

Retain coordinate rules for `.sequencer`, `.note-block`, `.audio-region`, automation, mixer faders and the platter. Remove obsolete `.app`, `main`, `.topbar`, `.workspace`, `.modebar`, `.track-rail`, `.mobile-studio-nav`, `.studio-tabs` and transport-reparenting layout rules from the old stylesheet once shell migration is complete. The new shell owns those responsibilities.

Do not reintroduce per-panel font-size patches. New actions use the shared button scale. Forms, file-import controls, disclosures, dialogs, toasts and focus rings follow one family across all views.

## Validation boundaries

These files define the system and component states; visual acceptance requires screenshots and real workflow checks after integration. CSS alone does not establish audio behavior, focus management, responsive overflow safety or physical iOS validation.


## Sonido independiente por clip (2026-10-25)

El inspector Sound edita el preset y los parámetros del instrumento del clip activo: osciladores, filtro, ADSR, glide, unison y detune. Su indicación de ámbito es bilingüe. Volumen, panorama, mute/solo, pre-gain y routing siguen siendo de pista y no se alteran al cargar presets, incluidos los bancos antiguos. Clips nuevos, duplicados y generados conservan copias independientes del instrumento de origen.

El campo aditivo `clip.instrument` mantiene el formato v6 y migra los proyectos anteriores copiando su instrumento de pista a cada clip. Se conserva en historial, autoguardado, JSON y paquetes; reproducción, launcher, arreglo, captura del Scratch Deck y WAV/stems usan el instrumento de cada clip. Las voces sostenidas conservan los parámetros con los que nacieron. Los buses de efectos en directo siguen siendo compartidos por pista: no se reinician sus colas, aunque los nuevos efectos pueden modificar su color. MIDI no incorpora estos patches de síntesis; se requiere WAV o proyecto/paquete para conservar el sonido completo. Versiones antiguas de la aplicación no interpretan instrumentos distintos por clip.

MIDI Learn para cutoff actúa sobre el instrumento del clip activo; sus destinos de volumen y panorama permanecen en la pista. La automatización global de cutoff se evalúa sobre la voz sin sobrescribir los parámetros guardados del clip.

Cada tarjeta de sección de Arrange ofrece `LOAD TO COMPOSE` / `CARGAR EN COMPOSE` como acción primaria contextual. Activa simultáneamente los cinco clips asignados, cierra el inspector Sound y abre el editor Compose, conservando la pista seleccionada. La acción cambia el contexto de edición, no el contenido musical ni la mezcla.


## Local clip play/pause (2026-10-25)

The clip locator button toggles between `▶ CLIP` and `Ⅱ PAUSE` (`Ⅱ PAUSA` in Spanish). During clip playback it pauses through the shared transport, retaining the clip cursor; pressing it again resumes there. Its visible state, accessible label and help follow global play/pause/stop and language changes. While song playback is running it remains a clip-start action and switches to clip playback, preserving the previous behavior. Startup disables the local button until audio initialization completes to prevent duplicate starts. This controls the active-clip mix, not a solo of the selected track.

Clip playback uses the current Bars length independently of Arrange loop bounds. Changing Bars or refreshing the editor preserves the running transport; only an explicit locator gesture seeks. After every clip loop, the piano-roll cursor, locator, bar/step readout and pause/resume share the same local position. Shorter active clips continue looping independently alongside longer clips.

Each collapsed Sound rack keeps a visible `+` control and its heading is also an expand target. This gives touch users a reliable way to reopen synth, Motion, FX, and macro controls.

Sound rack headings reserve 44 px for the cyan expand/collapse button on the right. A collapsed rack fits its heading content rather than clipping it to a fixed height; the whole button must remain visible and reachable.

Touch editing: drag a note body to change time/pitch and its visible right edge to change duration. Select supports dragging as well as tap selection. Navigate is the explicit surface-scrolling tool. Touch resize targets are enlarged without covering the whole note body.

Mobile deck mixer: A/B crossfade, Program/Deck balance and Cue occupy separate rows; never assign both slider labels to the same grid row.
