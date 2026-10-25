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

## Logo

`public/brand-options.svg` documents two viable geometric KV directions. **Signal (01)** is selected: square-cut paths, an open silhouette and a small magenta terminal accent. It is legible at small sizes, is easy to engrave or print in one color, and removes the overlapping waveform/glow decoration of the previous logo. `public/icon.svg` is the production favicon/PWA mark. Keep the name **КИБЕР VENGANCE** unchanged.

The selected mark uses a 64 × 64 view box. For an inline monochrome logo, reuse the path geometry and replace stroke colors with `currentColor`; no raster assets or downloaded fonts are required.

## Styling integration

Retain coordinate rules for `.sequencer`, `.note-block`, `.audio-region`, automation, mixer faders and the platter. Remove obsolete `.app`, `main`, `.topbar`, `.workspace`, `.modebar`, `.track-rail`, `.mobile-studio-nav`, `.studio-tabs` and transport-reparenting layout rules from the old stylesheet once shell migration is complete. The new shell owns those responsibilities.

Do not reintroduce per-panel font-size patches. New actions use the shared button scale. Forms, file-import controls, disclosures, dialogs, toasts and focus rings follow one family across all views.

## Validation boundaries

These files define the system and component states; visual acceptance requires screenshots and real workflow checks after integration. CSS alone does not establish audio behavior, focus management, responsive overflow safety or physical iOS validation.
