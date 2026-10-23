import { createProject, createEmptyProject, migrateProject, activeClip, clipsForTrack, createClip, clipLengthSteps, meterSteps, setProjectMeter, makeNote, duplicateClip, deleteClip, varyClip, resizeClip, quantizeClip, automationValue, generateClip, generateBacking, encodeMidi, playbackEvents, History, TRACKS, TRACK_META, DRUM_NAMES, SCALES, KEYS, addArrangementScene, duplicateArrangementScene, moveArrangementScene, removeArrangementScene, distributeArrangementPatterns, isInScale } from './core.js';
import { AudioEngine, renderWav } from './audio.js';
window.__kvErrors = [];
function reportError(message) { window.__kvErrors.push(String(message)); const el = document.getElementById('toast'); if (el) {
    el.textContent = `ENGINE ERROR: ${String(message)}`;
    el.classList.add('show');
} }
window.addEventListener('error', e => reportError(e.message));
window.addEventListener('unhandledrejection', e => reportError(String(e.reason?.message || e.reason)));
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)], STORAGE = 'kiber-vengance-project-v4', LEGACY_V3 = 'kiber-vengance-project-v3', LEGACY = 'kiber-vengance-project-v2', VERSIONS = 'kiber-vengance-versions-v1', UI_STORAGE = 'kiber-vengance-ui-v1', LANGUAGE_STORAGE = 'kiber-vengance-language-v1';
let project = loadProject(), selectedTrack = 'lead', selectedNotes = new Set(), currentStep = -1, currentScene = -1, draggedScene = -1, recordArmed = false, metronome = false, saveTimer, animation = 0, clipboard = [], recording = new Map(), rollScroll = {}, activeView = 'forge', commandIndex = 0, pendingDeleteClipId = null, suppressSequencerClick = false;
let language = localStorage.getItem(LANGUAGE_STORAGE) === 'es' ? 'es' : 'en', tutorialStep = 0, helpMode = false;
const L = (en, es) => language === 'es' ? es : en;
const history = new History();
const engine = new AudioEngine((step, time, scene, info = {}) => { if (step === -2) {
    $('#audioState').textContent = `COUNT ${info.countIn}`;
    return;
} currentStep = step; currentScene = scene; if (step < 0)
    $('#audioState').textContent = 'STANDBY';
else
    $('#audioState').textContent = 'RUNNING'; requestAnimationFrame(() => { updatePlayheads(); updatePosition(); }); });
engine.project = project;
window.__kvDiagnostics = () => engine.diagnostics();
const presets = { lead: ['Razor Choir', 'Neon Talon', 'Solar Vengeance'], guitar: ['Chrome Strings', 'Voltage Chug', 'Glass Horizon'], bass: ['Foundry Pulse', 'Black Reactor', 'Grind Theory'], pad: ['Afterlight', 'Frozen Cathedral', 'Signal Ghost'], drums: ['Titan Frame', 'Riot Assembly', 'Chrome Bones'] };
const keyMap = 'asdfghjk', pitchNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
function loadProject() { for (const key of [STORAGE, LEGACY_V3, LEGACY])
    try {
        const value = localStorage.getItem(key);
        if (value)
            return migrateProject(JSON.parse(value));
    }
    catch { } return createProject(); }
function esc(v) { return String(v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function snapshot() { history.push(project); }
function changed(render = false) { project.modifiedAt = Date.now(); $('#saveState').textContent = L('SAVING…', 'GUARDANDO…'); clearTimeout(saveTimer); saveTimer = setTimeout(() => { localStorage.setItem(STORAGE, JSON.stringify(project)); $('#saveState').textContent = L('SAVED LOCALLY', 'GUARDADO LOCAL'); }, 350); engine.setProject(project); if (render)
    renderAll(); }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1900); }
function download(data, name, type = 'application/octet-stream') { const blob = data instanceof Blob ? data : new Blob([data], { type }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function quickExportProject() { download(JSON.stringify(project, null, 2), `${safeName()}.kiber.json`, 'application/json'); toast(L('PROJECT EXPORTED', 'PROYECTO EXPORTADO')); }
function safeName() { return project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kiber-vengance'; }
function clip() { return activeClip(project, selectedTrack); }
function pitches() { if (selectedTrack === 'drums')
    return DRUM_NAMES.map((_, i) => DRUM_NAMES.length - 1 - i); const m = TRACK_META[selectedTrack], out = []; for (let p = m.high; p >= m.low; p--)
    out.push(p); return out; }
const staticCopy = [
    ['#boot p', 'LOADING COMPOSITION ENGINE', 'CARGANDO MOTOR DE COMPOSICIÓN'], ['.project-head label', 'PROJECT', 'PROYECTO'], ['.rail-label', 'INDEPENDENT CLIPS', 'CLIPS INDEPENDIENTES'], ['#newClipBtn', '＋ NEW CLIP', '＋ NUEVO CLIP'], ['[data-view="forge"]', 'FORGE', 'FORJA'], ['[data-view="arrange"]', 'ARRANGE', 'ARREGLO'], ['[data-view="perform"]', 'PERFORM', 'INTERPRETAR'], ['#tutorialBtn', 'GUIDE', 'GUÍA'], ['#focusBtn', 'FOCUS', 'FOCO'], ['#motionRack .eyebrow', 'MOTION ENGINE', 'MOTOR DE MOVIMIENTO'], ['#effectsRack .eyebrow', 'SIGNAL PROCESSING', 'PROCESADO DE SEÑAL'], ['#effectsRack strong', 'TRACK FX', 'EFECTOS DE PISTA'], ['#macroRack .eyebrow', 'VECTOR CONTROL', 'CONTROL VECTORIAL'], ['#macroRack strong', 'SCULPT THE IMPACT', 'MODELA EL IMPACTO'], ['#fxBypass', 'BYPASS', 'OMITIR'], ['.editor-head .eyebrow', 'ACTIVE CLIP', 'CLIP ACTIVO'], ['#duplicateBtn', 'DUPLICATE', 'DUPLICAR'], ['#mutateBtn', 'MUTATE', 'MUTAR'], ['#backingBtn', 'BACKING', 'BASE'], ['#quantizeBtn', 'QUANTIZE', 'CUANTIZAR'], ['#deleteNotesBtn', 'DELETE', 'BORRAR'], ['.automation-head .eyebrow', 'AUTOMATION', 'AUTOMATIZACIÓN'], ['.automation-head>span', 'CLICK / DRAG TO DRAW', 'CLIC / ARRASTRA PARA DIBUJAR'], ['#clearAutomationBtn', 'CLEAR LANE', 'LIMPIAR LÍNEA'], ['#arrangeDescription', 'Each section combines five independent clips. Edit, repeat and reorder the complete song.', 'Cada sección combina cinco clips independientes. Edita, repite y reordena la canción completa.'], ['#addSceneBtn', '＋ ADD SECTION', '＋ AÑADIR SECCIÓN'], ['#autoArrangeBtn', '⟳ AUTO SEQUENCE', '⟳ SECUENCIA AUTO'], ['#performDescription', 'Play with A–K, MIDI or the touch keyboard. Every vector remains active during playback.', 'Interpreta con A–K, MIDI o el teclado táctil. Todos los vectores permanecen activos durante la reproducción.'], ['#backingDialog .eyebrow', 'BACKING GENERATOR', 'GENERADOR DE BASES'], ['#backingDialog h2', 'BUILD A PLAYABLE FOUNDATION', 'CREA UNA BASE PARA TOCAR'], ['#backingDescription', 'Generate a structured bass, pad and drum arrangement while preserving your lead and guitar clips.', 'Genera un arreglo estructurado de bajo, pad y batería conservando tus clips de lead y guitarra.'], ['#backingWarning', 'The current arrangement will be replaced. You can undo this action.', 'El arreglo actual será reemplazado. Puedes deshacer esta acción.'], ['#generateBackingBtn', 'GENERATE BACKING', 'GENERAR BASE'], ['#projectMenu .eyebrow', 'PROJECT CORE', 'NÚCLEO DEL PROYECTO'], ['#projectMenu h2', 'VERSIONS & RECOVERY', 'VERSIONES Y RECUPERACIÓN'], ['#menuLanguageLabel', 'INTERFACE LANGUAGE', 'IDIOMA DE LA INTERFAZ'], ['#importProjectLabel', 'Import project JSON', 'Importar proyecto JSON'], ['#newBtn', 'New demo project', 'Nuevo proyecto de demostración'], ['#emptyBtn', 'New empty project', 'Nuevo proyecto vacío'], ['#duplicateProjectBtn', 'Duplicate current project', 'Duplicar proyecto actual'], ['#saveBtn', 'Create named snapshot', 'Crear instantánea con nombre'], ['#exportProjectBtn', 'Export project JSON', 'Exportar proyecto JSON'], ['#compatBtn', 'Compatibility report', 'Informe de compatibilidad'], ['.versions-head', 'LOCAL VERSIONS', 'VERSIONES LOCALES'], ['#exportDialog .eyebrow', 'COMMIT THE FULL SIGNAL', 'CONSOLIDA TODA LA SEÑAL'], ['#exportDialog h2', 'EXPORT SONG', 'EXPORTAR CANCIÓN'], ['#exportDialog>p', 'Render the complete arrangement, including repeated clips, automation, arpeggiators and effects.', 'Renderiza todo el arreglo, incluidos clips repetidos, automatización, arpegiadores y efectos.'], ['#wavBtn b', 'SONG WAV', 'CANCIÓN WAV'], ['#exportMidiBtn b', 'SONG MIDI', 'CANCIÓN MIDI'], ['#clipWavBtn b', 'CLIP WAV', 'CLIP WAV'], ['#clipMidiBtn b', 'CLIP MIDI', 'CLIP MIDI'], ['#helpDialog .eyebrow', 'FIELD MANUAL', 'MANUAL DE CAMPO'], ['#helpDialog h2', 'COMPOSITION CONTROLS', 'CONTROLES DE COMPOSICIÓN'], ['#helpDialog .note', 'Drag notes to move them and use the handle on their right edge to resize. Web MIDI records note-on/off, velocity, bend, pressure and timbre.', 'Arrastra las notas para moverlas y usa el tirador derecho para cambiar su duración. Web MIDI graba nota, velocidad, bend, presión y timbre.'], ['#aboutDialog p', 'A complete cinematic electro-rock composition engine built for pressure, motion and controlled impact.', 'Un motor completo de composición electro-rock cinematográfica creado para presión, movimiento e impacto controlado.'], ['#compatDialog .eyebrow', 'SYSTEM DIAGNOSTICS', 'DIAGNÓSTICO DEL SISTEMA'], ['#compatDialog h2', 'COMPATIBILITY REPORT', 'INFORME DE COMPATIBILIDAD'], ['#copyCompatBtn', 'COPY REPORT', 'COPIAR INFORME'], ['#commandDialog .command-head .eyebrow', 'RAPID EXECUTION', 'EJECUCIÓN RÁPIDA'], ['#commandDialog .command-head b', 'COMMAND PALETTE', 'PALETA DE COMANDOS'], ['.command-help', '↑↓ NAVIGATE · ENTER EXECUTE · ESC CLOSE', '↑↓ NAVEGAR · INTRO EJECUTAR · ESC CERRAR'], ['#contextHelpEyebrow', 'CONTEXT HELP', 'AYUDA CONTEXTUAL'], ['#manualBtn', 'KEYBOARD SHORTCUTS', 'ATAJOS DE TECLADO']
];
staticCopy.push(['#effectsRack strong', 'CLIP FX', 'EFECTOS DEL CLIP'], ['#motionRack .clip-scope', 'ACTIVE CLIP', 'CLIP ACTIVO'], ['#effectsRack .clip-scope', 'ACTIVE CLIP', 'CLIP ACTIVO'], ['#macroRack .clip-scope', 'ACTIVE CLIP', 'CLIP ACTIVO'], ['.backing-options label:nth-child(1)>span', 'STYLE', 'ESTILO'], ['.backing-options label:nth-child(2)>span', 'SECTIONS', 'SECCIONES'], ['.backing-options label:nth-child(3)>span', 'INTENSITY', 'INTENSIDAD'], ['#deleteClipDialog .eyebrow', 'DESTRUCTIVE EDIT', 'EDICIÓN DESTRUCTIVA'], ['#deleteClipDialog .delete-clip-warning', 'This removes the clip from the project. You can undo this action.', 'Esto elimina el clip del proyecto. Puedes deshacer la acción.'], ['#cancelDeleteClipBtn', 'CANCEL', 'CANCELAR'], ['#confirmDeleteClipBtn', 'DELETE CLIP', 'BORRAR CLIP']);
const leadingCopy = [['label:has(#barsSelect)', 'BARS', 'COMPASES'], ['label:has(#gridSelect)', 'SNAP', 'AJUSTE'], ['label:has(#zoomRange)', 'ZOOM', 'ZOOM'], ['label:has(#keySelect)', 'KEY', 'TONALIDAD'], ['label:has(#scaleSelect)', 'SCALE', 'ESCALA'], ['label:has(#noteLength)', 'LEN', 'DUR'], ['label:has(#noteVelocity)', 'VEL', 'VEL'], ['label:has(#arpMode)', 'MODE', 'MODO'], ['label:has(#arpOctaves)', 'OCT', 'OCT'], ['label:has(#arpRate)', 'RATE', 'RITMO'], ['label:has(#lfoTarget)', 'TARGET', 'DESTINO'], ['label:has(#lfoRate)', 'LFO RATE', 'RITMO LFO'], ['label:has(#lfoDepth)', 'DEPTH', 'PROFUNDIDAD']];
const shortcutCopy = [['Play / stop', 'Reproducir / parar'], ['Perform / record', 'Interpretar / grabar'], ['Select track', 'Seleccionar pista'], ['Command palette', 'Paleta de comandos'], ['Toggle Focus mode', 'Activar modo Foco'], ['Forge / Arrange / Perform', 'Forja / Arreglo / Interpretar'], ['New / duplicate clip', 'Nuevo / duplicar clip'], ['Solo / mute active track', 'Solo / silenciar pista activa'], ['Mutate / quantize', 'Mutar / cuantizar'], ['Undo / redo', 'Deshacer / rehacer'], ['Multi-select notes', 'Selección múltiple'], ['Select all notes', 'Seleccionar todas las notas'], ['Move selected notes', 'Mover notas seleccionadas'], ['Resize selected notes', 'Redimensionar notas'], ['Copy / paste notes', 'Copiar / pegar notas'], ['Delete selection', 'Borrar selección']];
const controlDescriptions = {
    aboutBtn: ['Brand & about', 'Marca e información', 'Open product information and version details.', 'Abre la información del producto y sus detalles.'], title: ['Project title', 'Título del proyecto', 'Rename the current project. Changes are saved locally.', 'Renombra el proyecto actual. Los cambios se guardan localmente.'], rewindBtn: ['Return to start', 'Volver al inicio', 'Stop playback and return the playhead to the beginning.', 'Detiene la reproducción y devuelve el cursor al inicio.'], playBtn: ['Play / stop', 'Reproducir / parar', 'Start or stop the active clip or full arrangement. Shortcut: Space.', 'Inicia o detiene el clip activo o el arreglo completo. Atajo: Espacio.'], recordBtn: ['Record arm', 'Armar grabación', 'Arm live recording from the computer keyboard, touch keys or MIDI.', 'Prepara la grabación en directo desde teclado, controles táctiles o MIDI.'], recordMode: ['Recording timing', 'Temporización de grabación', 'Choose quantized timing or preserve free microtiming.', 'Elige tiempo cuantizado o conserva el microtiming libre.'], tempo: ['Tempo', 'Tempo', 'Set song speed in beats per minute.', 'Ajusta la velocidad de la canción en pulsos por minuto.'], meterSelect: ['Time signature', 'Compás', 'Choose the rhythmic meter used by clips and bars.', 'Elige el compás rítmico utilizado por clips y barras.'], swing: ['Swing', 'Swing', 'Delay alternating subdivisions to add groove.', 'Retrasa subdivisiones alternas para añadir groove.'], countIn: ['Count-in', 'Cuenta atrás', 'Choose how many bars play before armed recording starts.', 'Elige cuántos compases suenan antes de iniciar la grabación.'], metroBtn: ['Metronome', 'Metrónomo', 'Toggle the accented timing click during playback.', 'Activa o desactiva el clic acentuado durante la reproducción.'], masterVolume: ['Master volume', 'Volumen maestro', 'Set the final output level for the complete mix.', 'Ajusta el nivel final de salida de toda la mezcla.'], languageSelect: ['Language', 'Idioma', 'Switch the complete interface between English and Spanish.', 'Cambia toda la interfaz entre inglés y español.'], exportBtn: ['Export', 'Exportar', 'Render the song or active clips to WAV or MIDI.', 'Renderiza la canción o los clips activos a WAV o MIDI.'], menuBtn: ['Project menu', 'Menú del proyecto', 'Create, import, export or restore project versions.', 'Crea, importa, exporta o restaura versiones del proyecto.'], tutorialBtn: ['Interactive guide', 'Guía interactiva', 'Start a guided tour through the complete composition workflow.', 'Inicia un recorrido guiado por todo el flujo de composición.'], focusBtn: ['Focus mode', 'Modo Foco', 'Hide secondary racks and dedicate more space to note editing.', 'Oculta paneles secundarios y dedica más espacio a editar notas.'], commandBtn: ['Command palette', 'Paleta de comandos', 'Search and execute any common action from the keyboard.', 'Busca y ejecuta acciones habituales desde el teclado.'], undoBtn: ['Undo', 'Deshacer', 'Restore the previous musical edit.', 'Restaura la edición musical anterior.'], redoBtn: ['Redo', 'Rehacer', 'Reapply the last undone edit.', 'Vuelve a aplicar la última edición deshecha.'], helpBtn: ['Context help', 'Ayuda contextual', 'Show a live explanation whenever a control is focused or touched.', 'Muestra una explicación cuando enfocas o tocas un control.'], preset: ['Sound preset', 'Preset de sonido', 'Load a designed starting sound for the selected track.', 'Carga un sonido inicial diseñado para la pista seleccionada.'], waveSelect: ['Main oscillator', 'Oscilador principal', 'Choose the waveform that defines the core timbre.', 'Elige la forma de onda que define el timbre principal.'], osc2WaveSelect: ['Second oscillator', 'Segundo oscilador', 'Choose an additional waveform or switch oscillator two off.', 'Elige una onda adicional o desactiva el segundo oscilador.'], filterSelect: ['Filter type', 'Tipo de filtro', 'Choose which frequencies the synthesizer filter removes.', 'Elige qué frecuencias elimina el filtro del sintetizador.'], arpEnabled: ['Arpeggiator', 'Arpegiador', 'Turn held notes into a rhythmic sequence.', 'Convierte las notas mantenidas en una secuencia rítmica.'], arpMode: ['Arpeggio direction', 'Dirección del arpegio', 'Choose the order in which held notes are played.', 'Elige el orden en el que se reproducen las notas.'], arpOctaves: ['Arpeggio octaves', 'Octavas del arpegio', 'Set the pitch range covered by the arpeggiator.', 'Ajusta el rango tonal recorrido por el arpegiador.'], arpRate: ['Arpeggio rate', 'Velocidad del arpegio', 'Choose the rhythmic subdivision for generated notes.', 'Elige la subdivisión rítmica de las notas generadas.'], lfoEnabled: ['LFO modulation', 'Modulación LFO', 'Enable cyclic movement for the selected target.', 'Activa movimiento cíclico sobre el destino seleccionado.'], lfoTarget: ['LFO target', 'Destino del LFO', 'Choose the sound parameter moved by the LFO.', 'Elige el parámetro de sonido que moverá el LFO.'], lfoRate: ['LFO rate', 'Velocidad del LFO', 'Set how quickly the modulation cycle repeats.', 'Ajusta la velocidad con que se repite la modulación.'], lfoDepth: ['LFO depth', 'Profundidad del LFO', 'Set the amount of cyclic modulation.', 'Ajusta la cantidad de modulación cíclica.'], fxBypass: ['Effects bypass', 'Omitir efectos', 'Disable or restore all effects on the selected track.', 'Desactiva o restaura todos los efectos de la pista.'], clipSelect: ['Active clip', 'Clip activo', 'Choose which independent pattern is edited for this track.', 'Elige qué patrón independiente se edita en esta pista.'], renameClipBtn: ['Rename clip', 'Renombrar clip', 'Give the active clip a descriptive name.', 'Asigna un nombre descriptivo al clip activo.'], duplicateBtn: ['Duplicate clip', 'Duplicar clip', 'Create an independent copy of the active clip.', 'Crea una copia independiente del clip activo.'], mutateBtn: ['Mutate clip', 'Mutar clip', 'Generate a controlled variation using the Tension macro.', 'Genera una variación controlada usando la macro Tensión.'], backingBtn: ['Backing generator', 'Generador de bases', 'Create a structured accompaniment for bass, pad and drums without changing guitar or lead clips.', 'Crea un acompañamiento estructurado de bajo, pad y batería sin cambiar los clips de guitarra ni lead.'], generateBackingBtn: ['Generate backing', 'Generar base', 'Replace the arrangement with the selected generated backing. The edit can be undone.', 'Reemplaza el arreglo por la base generada seleccionada. La edición se puede deshacer.'], barsSelect: ['Clip length', 'Duración del clip', 'Resize the active clip in musical bars.', 'Cambia la duración del clip activo en compases.'], gridSelect: ['Snap grid', 'Rejilla de ajuste', 'Choose the rhythmic resolution for placing and moving notes.', 'Elige la resolución rítmica para colocar y mover notas.'], zoomRange: ['Editor zoom', 'Zoom del editor', 'Change the horizontal width of sequencer steps.', 'Cambia el ancho horizontal de los pasos del secuenciador.'], keySelect: ['Song key', 'Tonalidad', 'Set the root note used by scale-aware generators.', 'Ajusta la nota raíz usada por los generadores musicales.'], scaleSelect: ['Musical scale', 'Escala musical', 'Constrain generated material to a harmonic scale.', 'Limita el material generado a una escala armónica.'], quantizeBtn: ['Quantize', 'Cuantizar', 'Align notes to the currently selected snap grid.', 'Alinea las notas con la rejilla seleccionada.'], automationParam: ['Automation lane', 'Línea de automatización', 'Choose which parameter is drawn below the piano roll.', 'Elige qué parámetro se dibuja bajo el piano roll.'], clearAutomationBtn: ['Clear automation', 'Limpiar automatización', 'Remove every point from the visible automation lane.', 'Elimina todos los puntos de la automatización visible.'], addSceneBtn: ['Add section', 'Añadir sección', 'Append a new song section using the active clips.', 'Añade una nueva sección usando los clips activos.'], autoArrangeBtn: ['Auto sequence', 'Secuencia automática', 'Distribute available clips across the complete song.', 'Distribuye los clips disponibles a lo largo de la canción.'],
    deleteClipBtn: ['Delete active clip', 'Borrar clip activo', 'Delete this clip safely. Arrangement sections are reassigned and the operation can be undone.', 'Borra este clip de forma segura. Las secciones del arreglo se reasignan y puedes deshacer la operación.'], confirmDeleteClipBtn: ['Confirm clip deletion', 'Confirmar borrado del clip', 'Permanently remove the selected clip from this project.', 'Elimina el clip seleccionado de este proyecto.'], sequencer: ['Piano roll', 'Piano roll', 'Click to add a note. Drag across empty space to select several notes; hold Shift to add them to the current selection.', 'Haz clic para añadir una nota. Arrastra sobre un espacio vacío para seleccionar varias; mantén Mayús para sumarlas a la selección actual.']
};
Object.assign(controlDescriptions, { arpEnabled: ['Clip arpeggiator', 'Arpegiador del clip', 'Turn held notes in the active clip into a rhythmic sequence.', 'Convierte las notas mantenidas del clip activo en una secuencia rítmica.'], lfoEnabled: ['Clip LFO', 'LFO del clip', 'Enable cyclic modulation for the active clip.', 'Activa la modulación cíclica del clip activo.'], fxBypass: ['Clip effects bypass', 'Omitir efectos del clip', 'Disable or restore effects on the active clip.', 'Desactiva o restaura los efectos del clip activo.'], clipSelect: ['Active clip and character', 'Clip y carácter activos', 'Choose the pattern together with its independent motion, effects and vector settings.', 'Elige el patrón junto con sus ajustes independientes de movimiento, efectos y vectores.'] });
function applyLanguage(render = false) { document.documentElement.lang = language; localStorage.setItem(LANGUAGE_STORAGE, language); $('#languageSelect').value = language; $('#menuLanguageSelect').value = language; for (const [selector, en, es] of staticCopy) {
    const el = $(selector);
    if (el)
        el.textContent = L(en, es);
} for (const [selector, en, es] of leadingCopy) {
    const el = $(selector), node = [...(el?.childNodes || [])].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (node)
        node.textContent = `${L(en, es)} `;
} $$('#helpDialog .help-grid span').forEach((el, i) => { const copy = shortcutCopy[i]; if (copy)
    el.textContent = L(copy[0], copy[1]); }); $('#arrangeView h1').textContent = L('ARRANGEMENT', 'ARREGLO'); $('#performView h1').textContent = L('PERFORMANCE DECK', 'MESA DE INTERPRETACIÓN'); $('.generators>span').textContent = L('GENERATE', 'GENERAR'); const styles = $$('#backingStyle option'); if (styles.length) {
    styles[0].textContent = L('CINEMATIC ARC', 'ARCO CINEMÁTICO');
    styles[1].textContent = L('DRIVING RIFF', 'RIFF MOTOR');
    styles[2].textContent = L('DARK PULSE', 'PULSO OSCURO');
} $('#commandSearch').placeholder = L('Search actions, views, tracks…', 'Buscar acciones, vistas, pistas…'); $('#commandSearch').ariaLabel = L('Search commands', 'Buscar comandos'); $('#commandDialog').ariaLabel = L('Command palette', 'Paleta de comandos'); $('#contextHelpClose').ariaLabel = L('Close help', 'Cerrar ayuda'); document.querySelector('meta[name="description"]')?.setAttribute('content', L('Kiber Vengance — cinematic electro-rock composition workstation.', 'Kiber Vengance — estación de composición electro-rock cinematográfica.')); if (render)
    renderAll(); if (pendingDeleteClipId)
    updateDeleteClipDialog(); installControlHelp(); if (helpMode)
    showHelpIntro(); }
function controlInfo(el) { const data = controlDescriptions[el.id]; if (data)
    return [L(data[0], data[1]), L(data[2], data[3])]; if (el.matches('.knob')) {
    const name = el.closest('.knob-control')?.querySelector('label')?.textContent || L('Sound parameter', 'Parámetro de sonido');
    return [name, L('Drag vertically for broad changes, horizontally for control, or use − / + on touch screens.', 'Arrastra en vertical para cambios amplios, en horizontal para controlar, o usa − / + en pantallas táctiles.')];
} if (el.matches('[data-fx]'))
    return [el.closest('.fx-unit')?.querySelector('span')?.textContent || 'FX', L('Set the intensity of this track effect.', 'Ajusta la intensidad de este efecto de pista.')]; if (el.matches('[data-macro]'))
    return [el.dataset.macro.toUpperCase(), L('Shape several musical and sound parameters at once.', 'Modifica varios parámetros musicales y sonoros a la vez.')]; if (el.matches('[data-solo]'))
    return [L('Solo track', 'Aislar pista'), L('Listen only to this instrument. Press again to restore the full mix.', 'Escucha únicamente este instrumento. Pulsa de nuevo para restaurar la mezcla completa.')]; if (el.matches('[data-mute]'))
    return [L('Mute track', 'Silenciar pista'), L('Silence or restore this instrument without changing its clips.', 'Silencia o restaura este instrumento sin modificar sus clips.')]; if (el.matches('.track-select'))
    return [L('Select track', 'Seleccionar pista'), L('Open this instrument track and its active clip for editing.', 'Abre esta pista de instrumento y su clip activo para editar.')]; if (el.matches('.note-block'))
    return [L('Sequencer note', 'Nota del secuenciador'), L('Drag to move. Use the right edge to resize and Shift to select several notes.', 'Arrastra para mover. Usa el borde derecho para redimensionar y Mayús para seleccionar varias notas.')]; if (el.matches('.key'))
    return [L('Performance key', 'Tecla de interpretación'), L('Play this note live; it is recorded when recording is armed.', 'Toca esta nota en directo; se graba cuando la grabación está armada.')]; if (el.matches('[data-generate]'))
    return [L('Musical generator', 'Generador musical'), L('Create scale-aware material for the active clip.', 'Crea material ajustado a la escala para el clip activo.')]; const name = (el.getAttribute('aria-label') || el.closest('label')?.textContent || el.textContent || el.id || L('Control', 'Control')).trim().replace(/\s+/g, ' ').slice(0, 48); if (el.tagName === 'SELECT')
    return [name, L('Choose one of the available values for this control.', 'Elige uno de los valores disponibles para este control.')]; if (el.type === 'range')
    return [name, L('Drag to adjust this value continuously.', 'Arrastra para ajustar este valor de forma continua.')]; if (el.type === 'number')
    return [name, L('Enter a precise numeric value.', 'Introduce un valor numérico preciso.')]; if (el.type === 'checkbox')
    return [name, L('Turn this option on or off.', 'Activa o desactiva esta opción.')]; return [name, L('Activate this control to perform its labeled action.', 'Activa este control para ejecutar la acción indicada.')]; }
function installControlHelp() { const controls = $$('button,input,select,canvas,[role="application"],.knob'); for (const el of controls) {
    const [title, body] = controlInfo(el);
    el.dataset.helpTitle = title;
    el.dataset.helpBody = body;
    el.setAttribute('aria-description', body);
    if (!el.title && el.tagName !== 'INPUT')
        el.title = body;
} }
function showHelpIntro() { $('#contextHelpTitle').textContent = L('Help mode active', 'Modo de ayuda activo'); $('#contextHelpBody').textContent = L('Focus, hover or tap any control to understand what it does.', 'Enfoca, pasa el cursor o toca cualquier control para saber qué hace.'); $('#contextHelp').hidden = false; }
function toggleHelp(force) { helpMode = force ?? !helpMode; document.body.classList.toggle('help-mode', helpMode); $('#helpBtn').setAttribute('aria-pressed', String(helpMode)); if (helpMode)
    showHelpIntro();
else
    $('#contextHelp').hidden = true; }
function showControlHelp(el) { if (!helpMode || !el?.dataset.helpBody)
    return; $('#contextHelpTitle').textContent = el.dataset.helpTitle; $('#contextHelpBody').textContent = el.dataset.helpBody; $('#contextHelp').hidden = false; }
const tutorialSteps = () => [
    { target: '.transport', view: 'forge', title: L('Own the transport', 'Controla el transporte'), body: L('Set tempo, meter, swing and count-in here. Play with Space and arm recording with R.', 'Ajusta aquí tempo, compás, swing y cuenta atrás. Reproduce con Espacio y arma la grabación con R.') },
    { target: '.track-rail', view: 'forge', title: L('Five independent instruments', 'Cinco instrumentos independientes'), body: L('Choose Lead, Guitar, Bass, Pad or Drums. Every track keeps its own clips, sound and effects.', 'Elige Lead, Guitarra, Bajo, Pad o Batería. Cada pista conserva sus propios clips, sonido y efectos.') },
    { target: '#synthRack', view: 'forge', title: L('Design the sound', 'Diseña el sonido'), body: L('Start from a preset, combine oscillators and shape each parameter. On touch screens, use the large − / + controls or drag a dial.', 'Parte de un preset, combina osciladores y modela cada parámetro. En pantalla táctil usa − / + o arrastra un dial.') },
    { target: '.piano-shell', view: 'forge', title: L('Compose in the piano roll', 'Compón en el piano roll'), body: L('Click to create notes, drag notes to move them, or drag across empty space to select several with a marquee. Shift adds to the selection.', 'Haz clic para crear notas, arrástralas para moverlas o arrastra sobre un espacio vacío para seleccionar varias con un marco. Mayús suma a la selección.') },
    { target: '#arrangeView .section-title', view: 'arrange', title: L('Build the complete song', 'Construye la canción completa'), body: L('Sections combine one clip per track. Repeat, duplicate and reorder them to create a full structure.', 'Las secciones combinan un clip por pista. Repítelas, duplícalas y ordénalas para crear una estructura completa.') },
    { target: '#performView .performance', view: 'perform', title: L('Perform live', 'Interpreta en directo'), body: L('Play from A to K, use MIDI or touch keys, and move macros while the composition is running.', 'Toca de A a K, usa MIDI o las teclas táctiles y mueve macros mientras suena la composición.') },
    { target: '.modebar', view: 'forge', title: L('Work at command speed', 'Trabaja a velocidad de comando'), body: L('Use Command to search actions, Focus to clear the workspace, ? for contextual help and Export when the song is ready.', 'Usa Comando para buscar acciones, Foco para despejar el espacio, ? para ayuda contextual y Exportar cuando la canción esté lista.') }
];
function showTutorialStep() { const steps = tutorialSteps(), step = steps[tutorialStep]; $$('.tutorial-target').forEach(el => el.classList.remove('tutorial-target')); activateView(step.view); setTimeout(() => { const target = $(step.target); target?.classList.add('tutorial-target'); target?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); }, 30); $('#tutorialStepLabel').textContent = L(`STEP ${tutorialStep + 1} / ${steps.length}`, `PASO ${tutorialStep + 1} / ${steps.length}`); $('#tutorialTitle').textContent = step.title; $('#tutorialBody').textContent = step.body; $('#tutorialBack').textContent = L('BACK', 'ATRÁS'); $('#tutorialBack').disabled = tutorialStep === 0; $('#tutorialNext').textContent = tutorialStep === steps.length - 1 ? L('FINISH', 'TERMINAR') : L('NEXT', 'SIGUIENTE'); $('#tutorialExit').textContent = L('EXIT', 'SALIR'); $('#tutorialProgress').style.setProperty('--tutorial-progress', `${(tutorialStep + 1) / steps.length * 100}%`); }
function startTutorial() { toggleHelp(false); tutorialStep = 0; document.body.classList.add('tutorial-active'); if (!$('#tutorialDialog').open)
    $('#tutorialDialog').show(); showTutorialStep(); }
function endTutorial() { document.body.classList.remove('tutorial-active'); $$('.tutorial-target').forEach(el => el.classList.remove('tutorial-target')); $('#tutorialDialog').close(); localStorage.setItem('kiber-vengance-tutorial-complete-v1', 'true'); }
function initLearning() { const changeLanguage = (value) => { language = value === 'es' ? 'es' : 'en'; applyLanguage(true); if ($('#tutorialDialog').open)
    showTutorialStep(); }; $('#languageSelect').onchange = () => changeLanguage($('#languageSelect').value); $('#menuLanguageSelect').onchange = () => changeLanguage($('#menuLanguageSelect').value); $('#tutorialBtn').onclick = startTutorial; $('#helpBtn').onclick = () => toggleHelp(); $('#contextHelpClose').onclick = () => toggleHelp(false); $('#manualBtn').onclick = () => open('#helpDialog'); $('#tutorialExit').onclick = endTutorial; $('#tutorialBack').onclick = () => { tutorialStep = Math.max(0, tutorialStep - 1); showTutorialStep(); }; $('#tutorialNext').onclick = () => { if (tutorialStep >= tutorialSteps().length - 1)
    endTutorial();
else {
    tutorialStep++;
    showTutorialStep();
} }; document.addEventListener('pointerover', e => showControlHelp(e.target.closest?.('[data-help-body]'))); document.addEventListener('focusin', e => showControlHelp(e.target.closest?.('[data-help-body]'))); document.addEventListener('pointerdown', e => showControlHelp(e.target.closest?.('[data-help-body]'))); }
function renderTracks() {
    const soloActive = TRACKS.some(id => project.tracks[id].solo);
    $('#tracks').innerHTML = TRACKS.map((id, i) => { const m = TRACK_META[id], t = project.tracks[id], c = activeClip(project, id); return `<div class="track ${id === selectedTrack ? 'active' : ''} ${t.solo ? 'soloed' : ''} ${soloActive && !t.solo ? 'solo-muted' : ''}" data-track="${id}" style="--track:${m.color}"><button class="track-select"><span class="track-head"><span><b class="track-name">${m.label}</b><small>${esc(c?.name || L('NO CLIP', 'SIN CLIP'))}</small></span><b>0${i + 1}</b></span><span class="track-foot"><span class="track-meter"><i style="width:${t.volume * 100}%"></i></span></span></button><span class="track-switches"><button class="solo ${t.solo ? 'on' : ''}" data-solo="${id}" aria-label="${L('Solo track', 'Aislar pista')} ${m.label}" aria-pressed="${t.solo}">S</button><button class="mute ${t.mute ? 'on' : ''}" data-mute="${id}" aria-label="${L('Mute track', 'Silenciar pista')} ${m.label}" aria-pressed="${t.mute}">M</button></span></div>`; }).join('');
    $$('.track').forEach(el => el.onclick = (e) => { const solo = e.target.closest('[data-solo]'), mute = e.target.closest('[data-mute]'); if (solo) {
        e.stopPropagation();
        snapshot();
        const id = solo.dataset.solo, was = project.tracks[id].solo;
        TRACKS.forEach(track => project.tracks[track].solo = false);
        project.tracks[id].solo = !was;
        if (!was)
            project.tracks[id].mute = false;
        changed(true);
        toast(was ? L('FULL MIX RESTORED', 'MEZCLA COMPLETA RESTAURADA') : L(`${TRACK_META[id].label} · SOLO`, `SOLO · ${TRACK_META[id].label}`));
        return;
    } if (mute) {
        e.stopPropagation();
        snapshot();
        project.tracks[mute.dataset.mute].mute = !project.tracks[mute.dataset.mute].mute;
        changed(true);
        return;
    } selectedTrack = el.dataset.track; selectedNotes.clear(); renderAll(); setDefaultScroll(); });
}
function renderInspector() {
    const meta = TRACK_META[selectedTrack], cfg = project.tracks[selectedTrack];
    document.documentElement.style.setProperty('--track', meta.color);
    $('#trackName').textContent = meta.label;
    $('#trackType').textContent = selectedTrack === 'drums' ? L('SYNTHETIC PERCUSSION', 'PERCUSIÓN SINTÉTICA') : selectedTrack === 'guitar' ? L('PLUCKED STRING MODEL', 'MODELO DE CUERDA PULSADA') : L('POLYPHONIC DUAL-OSC VOICE', 'VOZ POLIFÓNICA DE DOBLE OSCILADOR');
    $('#preset').innerHTML = presets[selectedTrack].map(p => `<option ${p === cfg.preset ? 'selected' : ''}>${p}</option>`).join('');
    $('#waveSelect').hidden = selectedTrack === 'drums';
    $('#osc2WaveSelect').hidden = selectedTrack === 'drums';
    $('#filterSelect').hidden = selectedTrack === 'drums';
    $('#waveSelect').value = cfg.wave || 'sawtooth';
    $('#osc2WaveSelect').value = cfg.osc2Wave || 'off';
    $('#filterSelect').value = cfg.filterType || 'lowpass';
    const defs = selectedTrack === 'drums' ? [['volume', L('LEVEL', 'NIVEL'), 0, 1, .01], ['pan', 'PAN', -1, 1, .01]] : [['volume', L('LEVEL', 'NIVEL'), 0, 1, .01], ['osc2Mix', L('OSC 2 MIX', 'MEZCLA OSC 2'), 0, 1, .01], ['cutoff', L('CUTOFF', 'CORTE'), 120, 10000, 1], ['resonance', L('RESO', 'RESO'), .1, 16, .1], ['attack', L('ATTACK', 'ATAQUE'), .005, 1, .005], ['decay', L('DECAY', 'CAÍDA'), .01, 2, .01], ['sustain', L('SUSTAIN', 'SOSTÉN'), .01, 1, .01], ['release', L('RELEASE', 'LIBERACIÓN'), .05, 3, .01], ['glide', L('GLIDE', 'DESLIZ.'), 0, .5, .005], ['pan', 'PAN', -1, 1, .01], ['unison', L('UNISON', 'UNÍSONO'), 1, 3, 1], ['detune', L('DETUNE', 'DESAFINE'), 0, 20, .5]], format = (key, v) => key === 'cutoff' ? `${Math.round(v)} Hz` : key === 'detune' ? `${v} ct` : key === 'unison' ? `${v}x` : key === 'pan' ? `${v > 0 ? '+' : ''}${Math.round(v * 100)}` : Math.round(v * 100);
    $('#synthControls').innerHTML = defs.map(([key, label, min, max, step]) => { const v = cfg[key], n = (v - min) / (max - min); return `<div class="knob-control"><button class="knob-nudge" data-direction="-1" aria-label="${L('Reduce', 'Reducir')} ${label}">−</button><div class="knob" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${v}" style="--n:${n};--v:${n * 75}%" title="${L('Drag up/down · Shift for fine adjustment', 'Arrastra arriba/abajo · Mayús para ajuste fino')}"></div><button class="knob-nudge" data-direction="1" aria-label="${L('Increase', 'Aumentar')} ${label}">+</button><input data-param="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" tabindex="-1"><label>${label}</label><output>${format(key, v)}</output></div>`; }).join('');
    $$('.knob-control').forEach(w => { const input = w.querySelector('input'), knob = w.querySelector('.knob'), min = +input.min, max = +input.max, range = max - min, step = +input.step || range / 100, setValue = (value) => { const snapped = Math.round((Math.max(min, Math.min(max, value)) - min) / step) * step + min; input.value = String(Math.max(min, Math.min(max, snapped))); input.dispatchEvent(new Event('input')); }; knob.onpointerdown = (e) => { if (e.button !== undefined && e.button !== 0)
        return; e.preventDefault(); snapshot(); knob.setPointerCapture?.(e.pointerId); knob.classList.add('adjusting'); const x = e.clientX, y = e.clientY, start = +input.value, sensitivity = e.pointerType === 'touch' ? 220 : 150; let moved = false; const move = (ev) => { const distance = (y - ev.clientY) + (ev.clientX - x) * .45, multiplier = ev.shiftKey ? .15 : 1; setValue(start + distance / sensitivity * range * multiplier); moved = moved || Math.abs(distance) > 1; }, up = (ev) => { knob.releasePointerCapture?.(ev.pointerId); knob.classList.remove('adjusting'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (moved)
        changed(); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); }; knob.onkeydown = (e) => { const direction = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0; if (!direction)
        return; e.preventDefault(); snapshot(); setValue(+input.value + direction * Math.max(step, range * (e.shiftKey ? .002 : .02))); changed(); }; w.querySelectorAll('.knob-nudge').forEach((button) => button.onclick = () => { snapshot(); setValue(+input.value + (+button.dataset.direction) * Math.max(step, range * .02)); changed(); }); input.oninput = () => { const v = +input.value, n = (v - min) / range; cfg[input.dataset.param] = v; knob.style.setProperty('--n', n); knob.style.setProperty('--v', `${n * 75}%`); knob.setAttribute('aria-valuenow', String(v)); knob.setAttribute('aria-valuetext', format(input.dataset.param, v)); w.querySelector('output').textContent = format(input.dataset.param, v); engine.setProject(project); }; });
    $('#preset').onchange = () => { snapshot(); cfg.preset = $('#preset').value; applyPreset(selectedTrack, cfg.preset); changed(true); };
    $('#waveSelect').onchange = () => { snapshot(); cfg.wave = $('#waveSelect').value; changed(); };
    $('#osc2WaveSelect').onchange = () => { snapshot(); cfg.osc2Wave = $('#osc2WaveSelect').value; changed(); };
    $('#filterSelect').onchange = () => { snapshot(); cfg.filterType = $('#filterSelect').value; changed(); };
}
function applyPreset(track, name) { const c = project.tracks[track], fx = activeClip(project, track).character.fx, bank = { lead: { 'Razor Choir': { wave: 'sawtooth', osc2Wave: 'square', osc2Mix: .2, cutoff: 4200, resonance: 4, attack: .015, decay: .11, sustain: .72, release: .22, unison: 2, detune: 7 }, 'Neon Talon': { wave: 'square', osc2Wave: 'sawtooth', osc2Mix: .12, cutoff: 5600, resonance: 2, attack: .008, decay: .06, sustain: .62, release: .12, unison: 2, detune: 9 }, 'Solar Vengeance': { wave: 'sawtooth', osc2Wave: 'triangle', osc2Mix: .32, cutoff: 7200, resonance: 7, attack: .025, decay: .18, sustain: .8, release: .48, unison: 3, detune: 12 } }, guitar: { 'Chrome Strings': { wave: 'triangle', osc2Wave: 'sawtooth', osc2Mix: .18, cutoff: 5200, resonance: 2.4, attack: .003, decay: .24, sustain: .18, release: .38, unison: 1, detune: 4, fx: { ...fx, distortion: .34, saturation: .3, chorus: .12 } }, 'Voltage Chug': { wave: 'sawtooth', osc2Wave: 'square', osc2Mix: .26, cutoff: 3600, resonance: 3.8, attack: .002, decay: .12, sustain: .1, release: .22, unison: 1, detune: 2, fx: { ...fx, distortion: .62, saturation: .48, chorus: .04, reverb: .08 } }, 'Glass Horizon': { wave: 'triangle', osc2Wave: 'sine', osc2Mix: .3, cutoff: 6800, resonance: 1.5, attack: .005, decay: .42, sustain: .24, release: .9, unison: 2, detune: 7, fx: { ...fx, distortion: .14, saturation: .18, chorus: .38, delay: .34, reverb: .42 } } }, bass: { 'Foundry Pulse': { wave: 'square', osc2Wave: 'sine', osc2Mix: .28, cutoff: 900, resonance: 6, attack: .008, decay: .08, sustain: .78, release: .14 }, 'Black Reactor': { wave: 'sawtooth', osc2Wave: 'square', osc2Mix: .18, cutoff: 560, resonance: 9, attack: .012, decay: .16, sustain: .68, release: .28 }, 'Grind Theory': { wave: 'square', osc2Wave: 'sawtooth', osc2Mix: .4, cutoff: 1450, resonance: 3, attack: .005, decay: .05, sustain: .9, release: .09 } }, pad: { 'Afterlight': { wave: 'triangle', osc2Wave: 'sawtooth', osc2Mix: .18, cutoff: 2400, attack: .45, decay: .65, sustain: .8, release: 1.8 }, 'Frozen Cathedral': { wave: 'sine', osc2Wave: 'triangle', osc2Mix: .45, cutoff: 1800, attack: .8, decay: 1.1, sustain: .72, release: 2.6 }, 'Signal Ghost': { wave: 'sawtooth', osc2Wave: 'sine', osc2Mix: .3, cutoff: 3300, attack: .25, decay: .5, sustain: .58, release: 2.2 } }, drums: { 'Titan Frame': { volume: .8, pan: 0, fx: { ...fx, distortion: .2, delay: .08, reverb: .16 } }, 'Riot Assembly': { volume: .88, pan: 0, fx: { ...fx, distortion: .48, delay: .04, reverb: .1 } }, 'Chrome Bones': { volume: .72, pan: -.05, fx: { ...fx, distortion: .12, delay: .2, reverb: .34 } } } }, patch = bank[track][name] || {}, { fx: fxPatch, ...instrument } = patch; Object.assign(c, instrument); if (fxPatch)
    Object.assign(fx, fxPatch); c.preset = name; }
function renderArp() { const { arp, lfo } = clip().character, $panel = $('.arp-rack'); $panel.classList.toggle('disabled', selectedTrack === 'drums'); $('#arpEnabled').checked = arp.enabled; $('#arpMode').value = arp.mode; $('#arpOctaves').value = arp.octaves; $('#arpRate').value = arp.rate; $('#lfoEnabled').checked = lfo.enabled; $('#lfoTarget').value = lfo.target; $('#lfoRate').value = lfo.rate; $('#lfoDepth').value = lfo.depth; $('#arpEnabled').onchange = () => { snapshot(); arp.enabled = $('#arpEnabled').checked; changed(); }; for (const [id, key, number] of [['#arpMode', 'mode'], ['#arpOctaves', 'octaves', true], ['#arpRate', 'rate', true]])
    $(id).onchange = () => { snapshot(); arp[key] = number ? +$(id).value : $(id).value; changed(); }; $('#lfoEnabled').onchange = () => { snapshot(); lfo.enabled = $('#lfoEnabled').checked; changed(); }; $('#lfoTarget').onchange = () => { snapshot(); lfo.target = $('#lfoTarget').value; changed(); }; for (const [id, key] of [['#lfoRate', 'rate'], ['#lfoDepth', 'depth']]) {
    $(id).onpointerdown = snapshot;
    $(id).oninput = () => { lfo[key] = +$(id).value; engine.setProject(project); };
    $(id).onchange = () => changed();
} }
function renderFx() { const fx = clip().character.fx, defs = [['saturation', L('SATURATION', 'SATURACIÓN')], ['distortion', L('DISTORTION', 'DISTORSIÓN')], ['chorus', 'CHORUS'], ['delay', L('DELAY', 'RETARDO')], ['reverb', 'REVERB'], ['tone', L('TONE / EQ', 'TONO / EQ')]]; $('#fxBypass').setAttribute('aria-pressed', fx.bypass); $('#fxBypass').classList.toggle('active', fx.bypass); $('#fxBypass').onclick = () => { snapshot(); fx.bypass = !fx.bypass; changed(); renderFx(); installControlHelp(); }; $('#fxControls').innerHTML = defs.map((entry) => { const [key, label] = entry; return `<label class="fx-unit"><span>${label}</span><input type="range" data-fx="${key}" min="0" max="1" step=".01" value="${fx[key]}"><output>${Math.round(fx[key] * 100)}</output></label>`; }).join(''); $$('#fxControls input').forEach(i => { i.onpointerdown = snapshot; i.oninput = () => { fx[i.dataset.fx] = +i.value; i.nextElementSibling.textContent = Math.round(i.value * 100); engine.setProject(project); }; i.onchange = () => changed(); }); }
function macroMarkup(container) { const macros = clip().character.macros, names = { energy: L('ENERGY', 'ENERGÍA'), darkness: L('DARKNESS', 'OSCURIDAD'), tension: L('TENSION', 'TENSIÓN'), aggression: L('AGGRESSION', 'AGRESIÓN'), space: L('SPACE', 'ESPACIO'), complexity: L('COMPLEXITY', 'COMPLEJIDAD') }; container.innerHTML = Object.entries(macros).map(([k, v]) => `<div class="macro"><label><span>${names[k] || k.toUpperCase()}</span><output>${Math.round(v * 100)}</output></label><input data-macro="${k}" type="range" min="0" max="1" step=".01" value="${v}"></div>`).join(''); container.querySelectorAll('input').forEach((i) => { i.onpointerdown = snapshot; i.oninput = () => { macros[i.dataset.macro] = +i.value; i.closest('.macro').querySelector('output').textContent = Math.round(i.value * 100); engine.setProject(project); updateOrb(); }; i.onchange = () => changed(); }); }
function renderClipControls() { const c = clip(), trackClips = clipsForTrack(project, selectedTrack); $('#clipSelect').innerHTML = trackClips.map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.name)} · ${x.bars} bars</option>`).join(''); $('#deleteClipBtn').disabled = trackClips.length <= 1; $('#barsSelect').value = c.bars; $('#gridSelect').value = project.editor.snap; $('#zoomRange').value = project.editor.zoom; $('#clipSelect').onchange = () => { project.activeClipIds[selectedTrack] = $('#clipSelect').value; selectedNotes.clear(); changed(true); setDefaultScroll(); }; $('#barsSelect').onchange = () => { snapshot(); resizeClip(c, +$('#barsSelect').value); selectedNotes.clear(); changed(true); }; $('#gridSelect').onchange = () => { project.editor.snap = +$('#gridSelect').value; changed(); renderPiano(); }; $('#zoomRange').oninput = () => { project.editor.zoom = +$('#zoomRange').value; renderPiano(); renderAutomation(); }; $('#zoomRange').onchange = () => changed(); $('#renameClipBtn').onclick = () => { const name = prompt(L('Clip name', 'Nombre del clip'), c.name); if (name?.trim()) {
    snapshot();
    c.name = name.trim();
    changed(true);
} }; $('#deleteClipBtn').onclick = () => requestClipDelete(c.id); }
function updateDeleteClipDialog() { const target = project.clips.find((c) => c.id === pendingDeleteClipId); if (!target)
    return; const replacement = clipsForTrack(project, target.track).find(c => c.id !== target.id), uses = project.arrangement.filter((s) => s.clipIds[target.track] === target.id).length; $('#deleteClipTitle').textContent = L(`DELETE “${target.name}”?`, `¿BORRAR “${target.name}”?`); $('#deleteClipDescription').textContent = L(`${uses ? `${uses} arrangement section${uses === 1 ? '' : 's'} use this clip. ` : 'This clip is not used by the arrangement. '}${uses && replacement ? `They will switch to “${replacement.name}”. ` : ''}At least one clip always remains on this track.`, `${uses ? `${uses} sección${uses === 1 ? '' : 'es'} del arreglo usa${uses === 1 ? '' : 'n'} este clip. ` : 'Este clip no se utiliza en el arreglo. '}${uses && replacement ? `Se cambiará${uses === 1 ? '' : 'n'} a “${replacement.name}”. ` : ''}Siempre se conserva al menos un clip en esta pista.`); }
function requestClipDelete(id) { const target = project.clips.find((c) => c.id === id); if (!target)
    return; if (clipsForTrack(project, target.track).length <= 1) {
    toast(L('KEEP AT LEAST ONE CLIP PER TRACK', 'DEBE QUEDAR UN CLIP POR PISTA'));
    return;
} pendingDeleteClipId = id; updateDeleteClipDialog(); $('#deleteClipDialog').showModal(); }
function renderHarmony() { $('#keySelect').innerHTML = KEYS.map(k => `<option ${k === project.key ? 'selected' : ''}>${k}</option>`).join(''); $('#scaleSelect').innerHTML = Object.keys(SCALES).map(s => `<option value="${s}" ${s === project.scale ? 'selected' : ''}>${s.replace(/([A-Z])/g, ' $1').toUpperCase()}</option>`).join(''); $('#keySelect').onchange = () => { snapshot(); project.key = $('#keySelect').value; changed(true); }; $('#scaleSelect').onchange = () => { snapshot(); project.scale = $('#scaleSelect').value; changed(true); }; $$('[data-generate]').forEach(b => { const type = b.dataset.generate; b.disabled = (selectedTrack === 'drums' && type !== 'drums') || (selectedTrack !== 'drums' && type === 'drums'); b.onclick = () => { snapshot(); generateClip(project, clip(), type, clip().character.macros.complexity); selectedNotes.clear(); changed(true); toast(`${type.toUpperCase()} GENERATED IN ${project.key} ${project.scale.toUpperCase()}`); }; }); $('#quantizeBtn').onclick = () => { snapshot(); quantizeClip(clip(), project.editor.snap); changed(true); toast('CLIP QUANTIZED'); }; }
function renderPiano() {
    const c = clip(), rows = pitches(), zoom = project.editor.zoom, rowH = 22, steps = clipLengthSteps(c), pane = $('#rollPane'), old = rollScroll[selectedTrack] || { left: pane?.scrollLeft || 0, top: pane?.scrollTop || 0 };
    $('#pianoLabelRows').innerHTML = rows.map(p => `<div class="pitch-label ${selectedTrack !== 'drums' && isInScale(p, project.key, project.scale) ? 'in-scale' : ''}">${selectedTrack === 'drums' ? (DRUM_NAMES[p] ?? 'DRUM') : (pitchNames[p % 12] ?? 'N') + Math.floor(p / 12 - 1)}</div>`).join('');
    $('#pianoLabelRows').style.height = `${rows.length * rowH}px`;
    const barSteps = c.stepsPerBar || meterSteps(project.meter), beatSteps = project.meter.unit === 8 ? 2 : 4;
    $('#rollRuler').innerHTML = `<div class="ruler-content" style="width:${steps * zoom}px">${Array.from({ length: steps }, (_, s) => `<span style="left:${s * zoom}px;width:${zoom}px">${s % barSteps === 0 ? `BAR ${s / barSteps + 1}` : s % beatSteps === 0 ? Math.floor(s / beatSteps) % project.meter.beats + 1 : ''}</span>`).join('')}</div>`;
    const seq = $('#sequencer');
    seq.style.width = `${steps * zoom}px`;
    seq.style.height = `${rows.length * rowH}px`;
    seq.style.setProperty('--step', `${zoom}px`);
    seq.style.setProperty('--beat', `${zoom * beatSteps}px`);
    seq.style.setProperty('--bar', `${zoom * barSteps}px`);
    seq.style.setProperty('--row', `${rowH}px`);
    seq.innerHTML = c.notes.map(n => { const row = selectedTrack === 'drums' ? DRUM_NAMES.length - 1 - n.pitch : TRACK_META[selectedTrack].high - n.pitch; if (row < 0 || row >= rows.length)
        return ''; return `<button class="note-block ${selectedNotes.has(n.id) ? 'selected' : ''}" data-note="${n.id}" style="left:${(n.step + (n.offset || 0)) * zoom + 1}px;top:${row * rowH + 2}px;width:${Math.max(5, n.length * zoom - 2)}px;height:${rowH - 4}px;--vel:${n.velocity}" title="${selectedTrack === 'drums' ? DRUM_NAMES[n.pitch] : pitchNames[n.pitch % 12]} · ${n.length.toFixed(3)} steps · offset ${(n.offset || 0).toFixed(3)} · velocity ${Math.round(n.velocity * 127)}"><span class="note-resize"></span></button>`; }).join('') + `<div class="roll-playhead" style="left:${Math.max(0, currentStep % steps) * zoom}px"></div>`;
    seq.onclick = (e) => { if (suppressSequencerClick) {
        suppressSequencerClick = false;
        return;
    } if (e.target !== seq)
        return; const rect = seq.getBoundingClientRect(), step = Math.max(0, Math.min(steps - project.editor.snap, Math.floor((e.clientX - rect.left) / zoom / project.editor.snap) * project.editor.snap)), row = Math.floor((e.clientY - rect.top) / rowH), pitch = rows[row]; if (pitch == null)
        return; snapshot(); const n = makeNote(step, pitch, selectedTrack === 'drums' ? 1 : Math.max(project.editor.snap, 1), e.shiftKey ? 1 : .8); c.notes.push(n); selectedNotes = e.shiftKey ? new Set([...selectedNotes, n.id]) : new Set([n.id]); changed(); engine.preview(selectedTrack, pitch, n.velocity); renderPiano(); renderSelection(); };
    bindMarqueeSelection(seq);
    $$('.note-block').forEach(el => bindNoteDrag(el, c, rows, zoom, rowH));
    pane.scrollLeft = Math.min(old.left, Math.max(0, steps * zoom - pane.clientWidth));
    pane.scrollTop = Math.min(old.top, Math.max(0, rows.length * rowH - pane.clientHeight));
    syncRollScroll();
    pane.onscroll = () => { rollScroll[selectedTrack] = { left: pane.scrollLeft, top: pane.scrollTop }; syncRollScroll(); };
    renderSelection();
}
function bindMarqueeSelection(seq) { seq.onpointerdown = (e) => { if (e.target !== seq || (e.button != null && e.button !== 0) || e.pointerType === 'touch')
    return; const rect = seq.getBoundingClientRect(), clamp = (value, max) => Math.max(0, Math.min(max, value)), startX = clamp(e.clientX - rect.left, seq.clientWidth), startY = clamp(e.clientY - rect.top, seq.clientHeight), base = e.shiftKey ? new Set(selectedNotes) : new Set(), box = document.createElement('div'); box.className = 'selection-marquee'; seq.append(box); let moved = false; const move = (ev) => { const x = clamp(ev.clientX - rect.left, seq.clientWidth), y = clamp(ev.clientY - rect.top, seq.clientHeight), left = Math.min(startX, x), top = Math.min(startY, y), right = Math.max(startX, x), bottom = Math.max(startY, y); if (!moved && Math.hypot(x - startX, y - startY) < 4)
    return; moved = true; ev.preventDefault(); Object.assign(box.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` }); const next = new Set(base); seq.querySelectorAll('.note-block').forEach((note) => { const noteRight = note.offsetLeft + note.offsetWidth, noteBottom = note.offsetTop + note.offsetHeight; if (note.offsetLeft <= right && noteRight >= left && note.offsetTop <= bottom && noteBottom >= top)
    next.add(note.dataset.note); }); selectedNotes = next; syncSelectedClasses(); renderSelection(); }, up = () => { box.remove(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (moved) {
    suppressSequencerClick = true;
    renderSelection();
} }; window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); }; }
function bindNoteDrag(el, c, rows, zoom, rowH) { el.onpointerdown = (e) => { e.stopPropagation(); const id = el.dataset.note; if (e.shiftKey) {
    selectedNotes.has(id) ? selectedNotes.delete(id) : selectedNotes.add(id);
}
else if (!selectedNotes.has(id))
    selectedNotes = new Set([id]); syncSelectedClasses(); renderSelection(); const originals = new Map(c.notes.filter((n) => selectedNotes.has(n.id)).map((n) => [n.id, { step: n.step, pitch: n.pitch, length: n.length }])), startX = e.clientX, startY = e.clientY, resizing = e.target.classList.contains('note-resize'), before = structuredClone(project); let moved = false; const move = (ev) => { const dx = Math.round((ev.clientX - startX) / zoom / project.editor.snap) * project.editor.snap, dy = Math.round((ev.clientY - startY) / rowH); if (!dx && !dy)
    return; if (!moved) {
    history.push(before);
    moved = true;
} for (const n of c.notes.filter((n) => selectedNotes.has(n.id))) {
    const o = originals.get(n.id);
    if (resizing)
        n.length = Math.max(project.editor.snap, Math.min(clipLengthSteps(c) - n.step, o.length + dx));
    else {
        n.step = Math.max(0, Math.min(clipLengthSteps(c) - o.length, o.step + dx));
        if (selectedTrack !== 'drums')
            n.pitch = Math.max(TRACK_META[selectedTrack].low, Math.min(TRACK_META[selectedTrack].high, o.pitch - dy));
    }
} renderPiano(); }; const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (moved)
    changed(); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); }; }
function syncSelectedClasses() { $$('.note-block').forEach(n => n.classList.toggle('selected', selectedNotes.has(n.dataset.note))); }
function syncRollScroll() { const pane = $('#rollPane'), content = $('#rollRuler .ruler-content'); if (content)
    content.style.transform = `translateX(${-pane.scrollLeft}px)`; $('#pianoLabelRows').style.transform = `translateY(${-pane.scrollTop}px)`; $('#automationPane').scrollLeft = pane.scrollLeft; }
function setDefaultScroll() { setTimeout(() => { const pane = $('#rollPane'); if (!pane || selectedTrack === 'drums')
    return; const row = (TRACK_META[selectedTrack].high - TRACK_META[selectedTrack].base) * 22; pane.scrollTop = Math.max(0, row - pane.clientHeight / 2); rollScroll[selectedTrack] = { left: 0, top: pane.scrollTop }; syncRollScroll(); }, 0); }
function renderSelection() { const notes = clip().notes.filter(n => selectedNotes.has(n.id)); $('#selectionCount').textContent = language === 'es' ? `${notes.length} NOTA${notes.length === 1 ? '' : 'S'}` : `${notes.length} NOTE${notes.length === 1 ? '' : 'S'}`; $('#noteLength').disabled = !notes.length; $('#noteVelocity').disabled = !notes.length; $('#deleteNotesBtn').disabled = !notes.length; if (notes.length) {
    $('#noteLength').value = notes[0].length;
    $('#noteVelocity').value = notes.reduce((a, n) => a + n.velocity, 0) / notes.length;
} }
function editSelection(key, value) { const notes = clip().notes.filter(n => selectedNotes.has(n.id)); if (!notes.length)
    return; snapshot(); for (const n of notes)
    n[key] = key === 'velocity' ? Math.max(.01, Math.min(1, +value)) : Math.max(project.editor.snap, Math.min(clipLengthSteps(clip()) - n.step, +value)); changed(); renderPiano(); }
function deleteSelection() { if (!selectedNotes.size)
    return; snapshot(); clip().notes = clip().notes.filter(n => !selectedNotes.has(n.id)); selectedNotes.clear(); changed(); renderPiano(); renderSelection(); }
function renderAutomation() { const c = clip(), steps = clipLengthSteps(c), zoom = project.editor.zoom, param = project.editor.automationParam, lane = c.automation[param]; $('#automationParam').value = param; const el = $('#automationLane'); el.style.width = `${steps * zoom}px`; el.innerHTML = Array.from({ length: steps }, (_, s) => { const value = automationValue(c, param, s, .5), point = lane[s] != null; return `<i class="automation-step ${point ? 'point' : ''}" style="left:${s * zoom}px;width:${zoom}px;--value:${value}" data-step="${s}"></i>`; }).join('') + `<div class="automation-playhead" style="left:${Math.max(0, currentStep % steps) * zoom}px"></div>`; const draw = (e) => { const rect = el.getBoundingClientRect(), step = Math.max(0, Math.min(steps - 1, Math.round((e.clientX - rect.left) / zoom / project.editor.snap) * project.editor.snap)), value = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height)); lane[step] = value; renderAutomation(); engine.setProject(project); }; el.onpointerdown = (e) => { snapshot(); draw(e); const move = (ev) => draw(ev), up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); changed(); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); }; $('#automationPane').scrollLeft = $('#rollPane').scrollLeft; }
function renderKeyboard() { const base = TRACK_META[selectedTrack].base, offsets = selectedTrack === 'drums' ? [0, 1, 2, 3, 4, 5, 6] : [0, 2, 4, 5, 7, 9, 11, 12], markup = offsets.map((x, i) => `<button class="key" data-pitch="${base + x}" data-source="${keyMap[i] || i}">${keyMap[i]?.toUpperCase() || ''}</button>`).join(''); for (const id of ['#keyboard', '#performanceKeyboard']) {
    $(id).innerHTML = markup;
    $(id).querySelectorAll('.key').forEach((k) => { k.onpointerdown = () => startPerformance(k.dataset.source, +k.dataset.pitch, .85, k); k.onpointerup = () => endPerformance(k.dataset.source, k); k.onpointerleave = (e) => { if (e.buttons)
        endPerformance(k.dataset.source, k); }; });
} }
function startPerformance(source, pitch, velocity = .8, el = null, expression = {}, channel = null) { el?.classList.add('active'); engine.startLive(source, selectedTrack, pitch, velocity, expression, channel); if (recordArmed && engine.playing) {
    const free = project.editor.recordMode === 'free', raw = engine.recordPosition(selectedTrack, { quantized: false });
    if (raw == null)
        return;
    const c = clip(), unwrapped = Math.round(raw / project.editor.snap) * project.editor.snap, step = free ? (unwrapped % clipLengthSteps(c)) : engine.recordPosition(selectedTrack), offset = free ? raw - unwrapped : 0;
    snapshot();
    const n = makeNote(step ?? 0, pitch, free ? .05 : project.editor.snap, velocity, offset, expression);
    c.notes.push(n);
    recording.set(source, { note: n, startRaw: raw, start: step ?? 0, clipId: c.id, channel });
    selectedNotes = new Set([n.id]);
    renderPiano();
} }
function endPerformance(source, el = null) { el?.classList.remove('active'); engine.stopLive(source); const rec = recording.get(source); if (!rec)
    return; const c = project.clips.find((x) => x.id === rec.clipId); if (!c) {
    recording.delete(source);
    return;
} const free = project.editor.recordMode === 'free', end = engine.recordPosition(c.track, { quantized: !free }); if (end != null) {
    let length = end - (free ? rec.startRaw : rec.start);
    if (length <= 0)
        length += clipLengthSteps(c);
    rec.note.length = Math.max(free ? .01 : project.editor.snap, length);
    changed();
    renderPiano();
} recording.delete(source); }
function renderArrangement() {
    const options = (track, id) => clipsForTrack(project, track).map(c => `<option value="${c.id}" ${c.id === id ? 'selected' : ''}>${esc(c.name)} · ${c.bars}b</option>`).join(''), { durationSteps } = playbackEvents(project, { song: true }), seconds = durationSteps * 60 / project.tempo / 4;
    $('#songStats').textContent = language === 'es' ? `${project.arrangement.length} SECCIONES · ${Math.ceil(durationSteps / meterSteps(project.meter))} COMPASES · ${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}` : `${project.arrangement.length} SECTIONS · ${Math.ceil(durationSteps / meterSteps(project.meter))} BARS · ${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
    $('#arrangement').innerHTML = project.arrangement.map((s, i) => `<article class="scene ${currentScene === i && engine.playing ? 'playing' : ''}" data-scene="${i}" tabindex="0"><div class="scene-top"><span class="drag-handle" draggable="true">⠿</span><input data-scene-name aria-label="${L('Section', 'Sección')} ${i + 1}" value="${esc(s.name)}"><button data-action="remove" aria-label="${L('Remove section', 'Eliminar sección')} ${i + 1}" ${project.arrangement.length === 1 ? 'disabled' : ''}>×</button></div><div class="scene-clips">${TRACKS.map(t => `<label style="--track:${TRACK_META[t].color}"><span>${TRACK_META[t].label}</span><select data-scene-track="${t}">${options(t, s.clipIds[t])}</select></label>`).join('')}</div><div class="scene-bottom"><label class="scene-repeats"><span>${L('REPEATS', 'REPETICIONES')}</span><input data-repeats type="number" min="1" max="16" value="${s.repeats}"></label><div class="scene-actions"><button data-action="left" aria-label="${L('Move section left', 'Mover sección a la izquierda')}" ${i === 0 ? 'disabled' : ''}>←</button><button data-action="duplicate" aria-label="${L('Duplicate section', 'Duplicar sección')}">⧉</button><button data-action="right" aria-label="${L('Move section right', 'Mover sección a la derecha')}" ${i === project.arrangement.length - 1 ? 'disabled' : ''}>→</button></div><em>${String(i + 1).padStart(2, '0')}</em></div></article>`).join('');
    $$('.scene').forEach(card => { const i = +card.dataset.scene, s = project.arrangement[i]; card.querySelector('[data-scene-name]').onchange = (e) => { snapshot(); s.name = e.target.value.trim() || `SECTION ${i + 1}`; changed(); }; card.querySelector('[data-repeats]').onchange = (e) => { snapshot(); s.repeats = Math.max(1, Math.min(16, +e.target.value || 1)); changed(true); }; card.querySelectorAll('[data-scene-track]').forEach((sel) => sel.onchange = () => { snapshot(); s.clipIds[sel.dataset.sceneTrack] = sel.value; project.activeClipIds[sel.dataset.sceneTrack] = sel.value; changed(true); }); card.querySelectorAll('[data-action]').forEach((b) => b.onclick = () => { const a = b.dataset.action; if (a === 'remove' && project.arrangement.length > 1) {
        snapshot();
        removeArrangementScene(project, i);
        changed(true);
    } if (a === 'duplicate') {
        snapshot();
        duplicateArrangementScene(project, i);
        changed(true);
        focusScene(i + 1);
    } if (a === 'left') {
        snapshot();
        moveArrangementScene(project, i, i - 1);
        changed(true);
        focusScene(i - 1);
    } if (a === 'right') {
        snapshot();
        moveArrangementScene(project, i, i + 1);
        changed(true);
        focusScene(i + 1);
    } }); const h = card.querySelector('.drag-handle'); h.ondragstart = (e) => { draggedScene = i; e.dataTransfer.setData('text/plain', i); card.classList.add('dragging'); }; h.ondragend = () => { draggedScene = -1; card.classList.remove('dragging'); }; card.ondragover = (e) => { e.preventDefault(); card.classList.add('drop-target'); }; card.ondragleave = () => card.classList.remove('drop-target'); card.ondrop = (e) => { e.preventDefault(); snapshot(); moveArrangementScene(project, draggedScene, i); draggedScene = -1; changed(true); focusScene(i); }; });
}
function focusScene(i) { setTimeout(() => document.querySelector(`.scene[data-scene="${i}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }), 0); }
function updatePlayheads() { const c = clip(), steps = clipLengthSteps(c), local = currentStep < 0 ? 0 : currentStep % steps; const p = $('.roll-playhead'), a = $('.automation-playhead'); if (p)
    p.style.left = `${local * project.editor.zoom}px`; if (a)
    a.style.left = `${local * project.editor.zoom}px`; $$('.scene').forEach((s, i) => s.classList.toggle('playing', engine.playing && engine.songMode && i === currentScene)); }
function updatePosition() { if (currentStep < 0) {
    $('#positionReadout').textContent = 'BAR 1 · STEP 1';
    return;
} const bar = meterSteps(project.meter); $('#positionReadout').textContent = `BAR ${Math.floor(currentStep / bar) + 1} · STEP ${currentStep % bar + 1}`; }
function updateOrb() { const macros = clip().character.macros, o = $('#performanceOrb'); o.style.transform = `scale(${.9 + macros.energy * .12})`; o.style.filter = `saturate(${.7 + macros.tension}) brightness(${.8 + macros.space * .35})`; }
function readUiPrefs() { try {
    return { focus: false, collapsed: [], ...JSON.parse(localStorage.getItem(UI_STORAGE) || '{}') };
}
catch {
    return { focus: false, collapsed: [] };
} }
function writeUiPrefs() { localStorage.setItem(UI_STORAGE, JSON.stringify({ focus: document.body.classList.contains('focus-mode'), collapsed: $$('.collapsible-rack.collapsed').map(x => x.id) })); }
function setRackCollapsed(id, collapsed, persist = true) { const rack = $(`#${id}`), button = rack?.querySelector('.rack-toggle'), names = { synthRack: L('synthesizer', 'sintetizador'), motionRack: L('Motion Engine', 'motor de movimiento'), effectsRack: L('effects', 'efectos'), macroRack: 'macros' }; if (!rack)
    return; rack.classList.toggle('collapsed', collapsed); button?.setAttribute('aria-expanded', String(!collapsed)); button?.setAttribute('aria-label', `${collapsed ? L('Expand', 'Expandir') : L('Collapse', 'Plegar')} ${names[id] || L('panel', 'panel')}`); if (button)
    button.textContent = collapsed ? '+' : '−'; if (persist)
    writeUiPrefs(); }
function toggleFocus(force, silent = false) { const active = force ?? !document.body.classList.contains('focus-mode'); document.body.classList.toggle('focus-mode', active); $('#focusBtn').setAttribute('aria-pressed', String(active)); writeUiPrefs(); if (!silent)
    toast(active ? L('FOCUS MODE · EDITOR LOCKED', 'MODO FOCO · EDITOR BLOQUEADO') : L('FULL SIGNAL RACKS RESTORED', 'PANELES DE SEÑAL RESTAURADOS')); }
function selectTrack(track) { selectedTrack = track; selectedNotes.clear(); activateView('forge'); renderAll(); setDefaultScroll(); }
const commands = [
    { label: 'Play / stop transport', labelEs: 'Reproducir / detener transporte', group: 'TRANSPORT', groupEs: 'TRANSPORTE', shortcut: 'SPACE', icon: '▶', keywords: 'play stop transport reproducir parar', run: () => togglePlay() },
    { label: 'Arm / disarm recording', labelEs: 'Armar / desarmar grabación', group: 'TRANSPORT', groupEs: 'TRANSPORTE', shortcut: 'R', icon: '●', keywords: 'record arm grabar', run: () => $('#recordBtn').click() },
    { label: 'Toggle metronome', labelEs: 'Activar metrónomo', group: 'TRANSPORT', groupEs: 'TRANSPORTE', shortcut: '', icon: '⌁', keywords: 'metro click metrónomo', run: () => $('#metroBtn').click() },
    { label: 'Toggle Solo on active track', labelEs: 'Activar o quitar Solo en la pista activa', group: 'MIX', groupEs: 'MEZCLA', shortcut: 'SHIFT S', icon: 'S', keywords: 'solo isolate isolation aislar aislamiento restore mix mezcla instrument instrumento', run: () => $(`[data-solo="${selectedTrack}"]`)?.click() },
    { label: 'Toggle Mute on active track', labelEs: 'Silenciar o restaurar la pista activa', group: 'MIX', groupEs: 'MEZCLA', shortcut: 'SHIFT M', icon: 'M', keywords: 'mute silence silenciar restore restaurar mix mezcla instrument instrumento', run: () => $(`[data-mute="${selectedTrack}"]`)?.click() },
    { label: 'Open Forge', labelEs: 'Abrir Forja', group: 'VIEW', groupEs: 'VISTA', shortcut: 'SHIFT G', icon: 'F', keywords: 'forge forja editor piano', run: () => activateView('forge') },
    { label: 'Open Arrange', labelEs: 'Abrir Arreglo', group: 'VIEW', groupEs: 'VISTA', shortcut: 'SHIFT A', icon: 'A', keywords: 'arrange arreglo song scenes', run: () => activateView('arrange') },
    { label: 'Open Perform', labelEs: 'Abrir Interpretación', group: 'VIEW', groupEs: 'VISTA', shortcut: 'SHIFT P', icon: 'P', keywords: 'perform interpretar live macros', run: () => activateView('perform') },
    { label: 'Toggle Focus mode', labelEs: 'Activar modo Foco', group: 'VIEW', groupEs: 'VISTA', shortcut: 'SHIFT F', icon: '⌖', keywords: 'focus foco collapse fast editor', run: () => toggleFocus() },
    { label: 'New independent clip', labelEs: 'Nuevo clip independiente', group: 'CLIP', groupEs: 'CLIP', shortcut: 'SHIFT N', icon: '＋', keywords: 'new nuevo clip create', run: () => $('#newClipBtn').click() },
    { label: 'Duplicate active clip', labelEs: 'Duplicar clip activo', group: 'CLIP', groupEs: 'CLIP', shortcut: 'SHIFT D', icon: '⧉', keywords: 'duplicate duplicar copy clip', run: () => $('#duplicateBtn').click() },
    { label: 'Delete active clip', labelEs: 'Borrar clip activo', group: 'CLIP', groupEs: 'CLIP', shortcut: '', icon: '⌫', keywords: 'delete remove borrar eliminar clip', run: () => $('#deleteClipBtn').click() },
    { label: 'Mutate active clip', labelEs: 'Mutar clip activo', group: 'CLIP', groupEs: 'CLIP', shortcut: 'SHIFT V', icon: '⌁', keywords: 'mutate mutar variation clip', run: () => $('#mutateBtn').click() },
    { label: 'Quantize active clip', labelEs: 'Cuantizar clip activo', group: 'CLIP', groupEs: 'CLIP', shortcut: 'SHIFT Q', icon: '▦', keywords: 'quantize cuantizar snap notes', run: () => $('#quantizeBtn').click() },
    { label: 'Add arrangement section', labelEs: 'Añadir sección al arreglo', group: 'SONG', groupEs: 'CANCIÓN', shortcut: '', icon: '＋', keywords: 'section sección scene arrangement arreglo', run: () => { activateView('arrange'); $('#addSceneBtn').click(); } },
    { label: 'Export audio or MIDI', labelEs: 'Exportar audio o MIDI', group: 'PROJECT', groupEs: 'PROYECTO', shortcut: '', icon: '⇧', keywords: 'export exportar wav midi', run: () => open('#exportDialog') },
    { label: 'Quick export song WAV', labelEs: 'Exportación rápida de canción WAV', group: 'PROJECT', groupEs: 'PROYECTO', shortcut: '', icon: 'W', keywords: 'quick export wav render audio rápido canción', run: () => exportWav(true) },
    { label: 'Quick export song MIDI', labelEs: 'Exportación rápida de canción MIDI', group: 'PROJECT', groupEs: 'PROYECTO', shortcut: '', icon: 'M', keywords: 'quick export midi rápido canción', run: () => exportMidi(true) },
    { label: 'Quick export project JSON', labelEs: 'Exportación rápida del proyecto JSON', group: 'PROJECT', groupEs: 'PROYECTO', shortcut: '', icon: 'J', keywords: 'quick export project json backup rápido proyecto copia', run: quickExportProject },
    { label: 'Project, versions & recovery', labelEs: 'Proyecto, versiones y recuperación', group: 'PROJECT', groupEs: 'PROYECTO', shortcut: '', icon: '••', keywords: 'project proyecto save import snapshot', run: () => $('#menuBtn').click() },
    ...TRACKS.map((track, index) => ({ label: `Select ${TRACK_META[track].label}`, labelEs: `Seleccionar ${TRACK_META[track].label}`, group: 'TRACK', groupEs: 'PISTA', shortcut: String(index + 1), icon: String(index + 1), keywords: `track pista ${track} instrument instrumento`, run: () => selectTrack(track) }))
];
function matchingCommands(query) { const needle = query.trim().toLowerCase(); return commands.filter(command => !needle || `${command.label} ${command.labelEs} ${command.group} ${command.groupEs} ${command.keywords}`.toLowerCase().includes(needle)); }
function renderCommands(query = '') { const list = matchingCommands(query); commandIndex = Math.max(0, Math.min(commandIndex, list.length - 1)); $('#commandResults').innerHTML = list.length ? list.map((command, index) => `<button class="command-item ${index === commandIndex ? 'active' : ''}" data-command="${commands.indexOf(command)}" role="option" aria-selected="${index === commandIndex}"><span><i>${command.icon}</i><b>${esc(L(command.label, command.labelEs))}</b></span><kbd>${L(command.group, command.groupEs)}${command.shortcut ? ` · ${command.shortcut}` : ''}</kbd></button>`).join('') : `<div class="command-empty">${L('NO MATCHING SIGNAL', 'SIN RESULTADOS')}</div>`; $$('.command-item').forEach(item => { item.onmouseenter = () => { commandIndex = list.indexOf(commands[+item.dataset.command]); renderCommands($('#commandSearch').value); }; item.onclick = () => runCommand(commands[+item.dataset.command]); }); }
function runCommand(command) { if (!command)
    return; $('#commandDialog').close(); command.run(); }
function openCommands() { commandIndex = 0; $('#commandSearch').value = ''; renderCommands(); $('#commandDialog').showModal(); setTimeout(() => $('#commandSearch').focus(), 0); }
function initWorkflowUi() { const stored = localStorage.getItem(UI_STORAGE), prefs = readUiPrefs(), defaults = !stored && window.matchMedia('(max-width:760px)').matches ? ['motionRack', 'effectsRack', 'macroRack'] : []; for (const id of new Set([...defaults, ...prefs.collapsed]))
    setRackCollapsed(id, true, false); toggleFocus(prefs.focus, true); $('#commandBtn').onclick = openCommands; $('#focusBtn').onclick = () => toggleFocus(); $$('.rack-toggle').forEach(button => button.onclick = () => setRackCollapsed(button.dataset.rack, !$(`#${button.dataset.rack}`).classList.contains('collapsed'))); $('#commandSearch').oninput = () => { commandIndex = 0; renderCommands($('#commandSearch').value); }; $('#commandSearch').onkeydown = (event) => { const list = matchingCommands($('#commandSearch').value); if (event.key === 'ArrowDown') {
    event.preventDefault();
    commandIndex = Math.min(list.length - 1, commandIndex + 1);
    renderCommands($('#commandSearch').value);
} if (event.key === 'ArrowUp') {
    event.preventDefault();
    commandIndex = Math.max(0, commandIndex - 1);
    renderCommands($('#commandSearch').value);
} if (event.key === 'Enter') {
    event.preventDefault();
    runCommand(list[commandIndex]);
} }; }
function renderVersions() { const list = loadVersions(); $('#versionsList').innerHTML = list.length ? list.map((v, i) => `<div><span><b>${esc(v.label)}</b><small>${new Date(v.date).toLocaleString(language)}</small></span><button data-restore="${i}">${L('RESTORE', 'RESTAURAR')}</button><button data-delete-version="${i}">×</button></div>`).join('') : `<p>${L('No snapshots yet. Autosave remains active.', 'Todavía no hay instantáneas. El guardado automático sigue activo.')}</p>`; $$('[data-restore]').forEach((b) => b.onclick = () => { snapshot(); project = migrateProject(list[+b.dataset.restore].project); engine.project = project; selectedNotes.clear(); changed(true); $('#projectMenu').close(); toast(L('VERSION RESTORED', 'VERSIÓN RESTAURADA')); }); $$('[data-delete-version]').forEach((b) => b.onclick = () => { list.splice(+b.dataset.deleteVersion, 1); localStorage.setItem(VERSIONS, JSON.stringify(list)); renderVersions(); }); }
function loadVersions() { try {
    return JSON.parse(localStorage.getItem(VERSIONS) || '[]') || [];
}
catch {
    return [];
} }
function saveVersion() { const label = prompt(L('Snapshot name', 'Nombre de la instantánea'), `${project.title} · ${new Date().toLocaleTimeString(language)}`); if (!label)
    return; const list = loadVersions(); list.unshift({ id: crypto.randomUUID(), label, date: Date.now(), project: structuredClone(project) }); localStorage.setItem(VERSIONS, JSON.stringify(list.slice(0, 20))); renderVersions(); toast(L('VERSION SNAPSHOT CREATED', 'INSTANTÁNEA CREADA')); }
function renderAll() { renderTracks(); renderInspector(); renderArp(); renderFx(); macroMarkup($('#macros')); macroMarkup($('#performMacros')); renderClipControls(); renderHarmony(); renderPiano(); renderAutomation(); renderKeyboard(); renderArrangement(); $('#title').value = project.title; $('#tempo').value = project.tempo; $('#meterSelect').value = `${project.meter.beats}/${project.meter.unit}`; $('#recordMode').value = project.editor.recordMode || 'quantized'; $('#swing').value = Math.round(project.swing * 100); $('#masterVolume').value = project.master; $('#masterValue').textContent = Math.round(project.master * 100); updateOrb(); installControlHelp(); }
async function togglePlay() { if (engine.playing) {
    engine.stop();
    $('#playBtn').textContent = '▶';
    $('#playBtn').classList.remove('active');
}
else {
    engine.songMode = activeView === 'arrange';
    await engine.start(project, { countInBars: recordArmed ? +$('#countIn').value : 0 });
    $('#playBtn').textContent = '■';
    $('#playBtn').classList.add('active');
    $('#audioState').textContent = engine.countingIn ? 'COUNT IN' : 'RUNNING';
    animateMeter();
} }
function animateMeter() { cancelAnimationFrame(animation); const loop = () => { if (engine.playing) {
    engine.draw($('#meter'));
    animation = requestAnimationFrame(loop);
} }; loop(); }
async function exportWav(song) { const st = $('#renderStatus'), buttons = $$('#exportDialog button,.quick-export'); buttons.forEach(b => b.disabled = true); st.textContent = L(song ? 'RENDERING FULL ARRANGEMENT…' : 'RENDERING ACTIVE CLIPS…', song ? 'RENDERIZANDO ARREGLO COMPLETO…' : 'RENDERIZANDO CLIPS ACTIVOS…'); try {
    download(await renderWav(project, { song }), `${safeName()}${song ? '-song' : '-clips'}.wav`);
    st.textContent = L('WAV READY', 'WAV LISTO');
    toast(L('WAV EXPORTED', 'WAV EXPORTADO'));
}
catch (e) {
    st.textContent = `${L('RENDER FAILED', 'ERROR DE RENDER')}: ${e instanceof Error ? e.message : String(e)}`;
}
finally {
    buttons.forEach(b => b.disabled = false);
} }
function exportMidi(song) { download(encodeMidi(project, { song }), `${safeName()}${song ? '-song' : '-clips'}.mid`, 'audio/midi'); toast('MIDI EXPORTED'); }
$('#playBtn').onclick = togglePlay;
$('#rewindBtn').onclick = () => { engine.stop(); currentStep = -1; currentScene = -1; updatePlayheads(); $('#playBtn').textContent = '▶'; $('#playBtn').classList.remove('active'); };
$('#recordBtn').onclick = () => { recordArmed = !recordArmed; $('#recordBtn').classList.toggle('active', recordArmed); toast(recordArmed ? `RECORD ARMED · ${$('#countIn').value} BAR COUNT-IN` : 'RECORD SAFE'); };
$('#metroBtn').onclick = () => { metronome = !metronome; engine.metronome = metronome; $('#metroBtn').setAttribute('aria-pressed', metronome); };
$('#tempo').onchange = () => { snapshot(); project.tempo = Math.max(50, Math.min(220, +$('#tempo').value)); changed(); };
$('#meterSelect').onchange = () => { snapshot(); const [beats, unit] = $('#meterSelect').value.split('/').map(Number); setProjectMeter(project, beats, unit); selectedNotes.clear(); changed(true); };
$('#recordMode').onchange = () => { snapshot(); project.editor.recordMode = $('#recordMode').value; changed(); toast(project.editor.recordMode === 'free' ? 'FREE MICROTIMING RECORDING' : 'QUANTIZED RECORDING'); };
$('#swing').onchange = () => { snapshot(); project.swing = Math.max(0, Math.min(.6, +$('#swing').value / 100)); changed(); };
$('#title').onchange = () => { snapshot(); project.title = $('#title').value.trim() || 'Untitled Signal'; changed(); };
$('#masterVolume').onpointerdown = snapshot;
$('#masterVolume').oninput = () => { project.master = +$('#masterVolume').value; $('#masterValue').textContent = Math.round(project.master * 100); engine.setProject(project); };
$('#masterVolume').onchange = () => changed();
$('#undoBtn').onclick = () => { project = history.undo(project); engine.project = project; selectedNotes.clear(); changed(true); };
$('#redoBtn').onclick = () => { project = history.redo(project); engine.project = project; selectedNotes.clear(); changed(true); };
$('#newClipBtn').onclick = () => { snapshot(); const source = clip(), c = createClip(selectedTrack, `${TRACK_META[selectedTrack].label} ${clipsForTrack(project, selectedTrack).length + 1}`, 2, meterSteps(project.meter)); c.character = structuredClone(source.character); project.clips.push(c); project.activeClipIds[selectedTrack] = c.id; selectedNotes.clear(); changed(true); toast(L('INDEPENDENT CLIP + CHARACTER CREATED', 'CLIP Y CARÁCTER INDEPENDIENTES CREADOS')); };
$('#duplicateBtn').onclick = () => { snapshot(); duplicateClip(project, clip().id); selectedNotes.clear(); changed(true); };
$('#mutateBtn').onclick = () => { snapshot(); varyClip(project, clip(), clip().character.macros.tension); selectedNotes.clear(); changed(true); };
$('#noteLength').onchange = () => editSelection('length', $('#noteLength').value);
$('#noteVelocity').onpointerdown = () => { if (selectedNotes.size)
    snapshot(); };
$('#noteVelocity').oninput = () => { for (const n of clip().notes.filter(n => selectedNotes.has(n.id)))
    n.velocity = +$('#noteVelocity').value; renderPiano(); };
$('#noteVelocity').onchange = () => changed();
$('#deleteNotesBtn').onclick = deleteSelection;
$('#automationParam').onchange = () => { project.editor.automationParam = $('#automationParam').value; changed(); renderAutomation(); };
$('#clearAutomationBtn').onclick = () => { snapshot(); clip().automation[project.editor.automationParam] = {}; changed(); renderAutomation(); };
$('#addSceneBtn').onclick = () => { snapshot(); addArrangementScene(project); changed(true); focusScene(project.arrangement.length - 1); };
$('#autoArrangeBtn').onclick = () => { snapshot(); distributeArrangementPatterns(project); changed(true); toast('CLIPS DISTRIBUTED ACROSS SONG'); };
function activateView(view) { activeView = view; $$('[data-view]').forEach(x => x.classList.toggle('active', x.dataset.view === view)); $$('.view').forEach(v => v.classList.toggle('active', v.id === `${view}View`)); engine.songMode = view === 'arrange'; if (view === 'arrange')
    renderArrangement(); }
$$('[data-view]').forEach((b) => b.onclick = () => activateView(b.dataset.view));
function compatibility() { return { timestamp: new Date().toISOString(), userAgent: navigator.userAgent, audioContext: Boolean(window.AudioContext || window.webkitAudioContext), offlineAudio: Boolean(window.OfflineAudioContext), webMidi: Boolean(navigator.requestMIDIAccess), serviceWorker: Boolean(navigator.serviceWorker), secureContext: window.isSecureContext, platform: navigator.platform || 'unknown', sampleRate: engine.ctx?.sampleRate || 'not initialized', audioState: engine.ctx?.state || 'not initialized' }; }
function showCompatibility() { const data = compatibility(); $('#compatReport').innerHTML = Object.entries(data).map(([key, value]) => `<div><span>${esc(key)}</span><b class="${value === false ? 'bad' : 'good'}">${esc(value)}</b></div>`).join(''); open('#compatDialog'); return data; }
const open = (id) => $(id).showModal(), replaceProject = (next) => { snapshot(); project = next; engine.project = project; selectedNotes.clear(); changed(true); $('#projectMenu').close(); };
$('#menuBtn').onclick = () => { renderVersions(); open('#projectMenu'); };
$('#exportBtn').onclick = () => open('#exportDialog');
$('#helpBtn').onclick = () => open('#helpDialog');
$('#aboutBtn').onclick = () => open('#aboutDialog');
$$('[data-close]').forEach((b) => b.onclick = () => b.closest('dialog').close());
$('#newBtn').onclick = () => { if (confirm('Create a new demo project? Autosave will be replaced.'))
    replaceProject(createProject()); };
$('#emptyBtn').onclick = () => { if (confirm('Create an empty project? Autosave will be replaced.'))
    replaceProject(createEmptyProject()); };
$('#duplicateProjectBtn').onclick = () => { const copy = migrateProject(structuredClone(project)); copy.id = crypto.randomUUID(); copy.title = `${project.title} Copy`; replaceProject(copy); toast('PROJECT DUPLICATED'); };
$('#saveBtn').onclick = saveVersion;
$('#exportProjectBtn').onclick = () => download(JSON.stringify(project, null, 2), `${safeName()}.kiber.json`, 'application/json');
$('#compatBtn').onclick = () => { $('#projectMenu').close(); showCompatibility(); };
$('#copyCompatBtn').onclick = async () => { const text = JSON.stringify(compatibility(), null, 2); try {
    await navigator.clipboard.writeText(text);
    toast('COMPATIBILITY REPORT COPIED');
}
catch {
    download(text, 'kiber-vengance-compatibility.json', 'application/json');
} };
$('#importProject').onchange = async (e) => { try {
    snapshot();
    project = migrateProject(JSON.parse(await e.target.files[0].text()));
    engine.project = project;
    selectedNotes.clear();
    changed(true);
    $('#projectMenu').close();
    toast('PROJECT IMPORTED');
}
catch (err) {
    toast(`IMPORT ERROR: ${err instanceof Error ? err.message : String(err)}`);
} };
$('#wavBtn').onclick = () => exportWav(true);
$('#clipWavBtn').onclick = () => exportWav(false);
$('#exportMidiBtn').onclick = () => exportMidi(true);
$('#clipMidiBtn').onclick = () => exportMidi(false);
$('#quickWavBtn').onclick = () => exportWav(true);
$('#quickMidiBtn').onclick = () => exportMidi(true);
$('#quickProjectBtn').onclick = quickExportProject;
$('#backingBtn').onclick = () => open('#backingDialog');
$('#backingIntensity').oninput = () => $('#backingIntensityValue').textContent = Math.round(+$('#backingIntensity').value * 100);
$('#generateBackingBtn').onclick = () => { snapshot(); generateBacking(project, { sections: +$('#backingSections').value, intensity: +$('#backingIntensity').value, style: $('#backingStyle').value }); selectedNotes.clear(); changed(true); $('#backingDialog').close(); activateView('arrange'); toast(L('BACKING GENERATED · GUITAR READY', 'BASE GENERADA · GUITARRA LISTA')); };
$('#deleteClipDialog').onclose = () => pendingDeleteClipId = null;
$('#confirmDeleteClipBtn').onclick = () => { if (!pendingDeleteClipId)
    return; const target = project.clips.find((c) => c.id === pendingDeleteClipId); if (!target)
    return; const name = target.name; snapshot(); if (!deleteClip(project, pendingDeleteClipId)) {
    toast(L('KEEP AT LEAST ONE CLIP PER TRACK', 'DEBE QUEDAR UN CLIP POR PISTA'));
    return;
} pendingDeleteClipId = null; selectedNotes.clear(); $('#deleteClipDialog').close(); changed(true); toast(L(`“${name}” DELETED · ARRANGEMENT UPDATED`, `“${name}” BORRADO · ARREGLO ACTUALIZADO`)); };
document.addEventListener('keydown', e => { const target = e.target, typing = Boolean(target?.closest?.('textarea,[contenteditable="true"],input:not([type]),input[type="text"],input[type="search"],input[type="number"],input[type="email"],input[type="password"],input[type="url"],input[type="tel"]')), blocked = $$('dialog').some(dialog => dialog.open) || typing, key = e.code === 'KeyS' || e.key.toLowerCase() === 's' ? 'solo' : e.code === 'KeyM' || e.key.toLowerCase() === 'm' ? 'mute' : e.code === 'KeyV' || e.key.toLowerCase() === 'v' ? 'mutate' : null; if (!blocked && !e.ctrlKey && !e.metaKey && !e.altKey && e.shiftKey && key) {
    e.preventDefault();
    e.stopImmediatePropagation();
    (key === 'mutate' ? $('#mutateBtn') : $(`[data-${key}="${selectedTrack}"]`))?.click();
} }, { capture: true });
document.addEventListener('keydown', e => { const mod = e.ctrlKey || e.metaKey; if (mod && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openCommands();
    return;
} if ($('#commandDialog').open)
    return; if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName))
    return; if (e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    toggleFocus();
    return;
} if (e.shiftKey && e.key.toLowerCase() === 'g') {
    e.preventDefault();
    activateView('forge');
    return;
} if (e.shiftKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    activateView('arrange');
    return;
} if (e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    activateView('perform');
    return;
} if (e.shiftKey && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    $('#newClipBtn').click();
    return;
} if (e.shiftKey && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    $('#duplicateBtn').click();
    return;
} if (e.shiftKey && e.key.toLowerCase() === 'm') {
    e.preventDefault();
    $('#mutateBtn').click();
    return;
} if (e.shiftKey && e.key.toLowerCase() === 'q') {
    e.preventDefault();
    $('#quantizeBtn').click();
    return;
} if (e.key.toLowerCase() === 'r' && !mod) {
    e.preventDefault();
    $('#recordBtn').click();
    return;
} if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
    return;
} if (/^Digit[1-5]$/.test(e.code)) {
    selectedTrack = TRACKS[+e.code.at(-1) - 1] ?? 'lead';
    selectedNotes.clear();
    renderAll();
    setDefaultScroll();
    return;
} if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    project = e.shiftKey ? history.redo(project) : history.undo(project);
    engine.project = project;
    selectedNotes.clear();
    changed(true);
    return;
} if (mod && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    selectedNotes = new Set(clip().notes.map(n => n.id));
    syncSelectedClasses();
    renderSelection();
    return;
} if (mod && e.key.toLowerCase() === 'c') {
    clipboard = clip().notes.filter(n => selectedNotes.has(n.id)).map(n => structuredClone(n));
    toast(`${clipboard.length} NOTES COPIED`);
    return;
} if (mod && e.key.toLowerCase() === 'v' && clipboard.length) {
    e.preventDefault();
    snapshot();
    const min = Math.min(...clipboard.map(n => n.step)), offset = Math.min(clipLengthSteps(clip()) - 1, min + 4) - min, newNotes = clipboard.map(n => ({ ...n, id: crypto.randomUUID(), step: Math.min(clipLengthSteps(clip()) - n.length, n.step + offset) }));
    clip().notes.push(...newNotes);
    selectedNotes = new Set(newNotes.map(n => n.id));
    changed();
    renderPiano();
    return;
} if (['Delete', 'Backspace'].includes(e.key)) {
    e.preventDefault();
    deleteSelection();
    return;
} if (selectedNotes.size && e.key.startsWith('Arrow')) {
    e.preventDefault();
    snapshot();
    const delta = e.shiftKey ? 4 : project.editor.snap;
    for (const n of clip().notes.filter(n => selectedNotes.has(n.id))) {
        if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft'))
            n.length = Math.max(project.editor.snap, Math.min(clipLengthSteps(clip()) - n.step, n.length + (e.key === 'ArrowRight' ? delta : -delta)));
        else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft')
            n.step = Math.max(0, Math.min(clipLengthSteps(clip()) - n.length, n.step + (e.key === 'ArrowRight' ? delta : -delta)));
        else if (selectedTrack !== 'drums')
            n.pitch = Math.max(TRACK_META[selectedTrack].low, Math.min(TRACK_META[selectedTrack].high, n.pitch + (e.key === 'ArrowUp' ? 1 : -1)));
    }
    changed();
    renderPiano();
    return;
} const i = keyMap.indexOf(e.key.toLowerCase()); if (i >= 0 && !e.repeat && !recording.has(e.key.toLowerCase())) {
    const key = $$('#keyboard .key')[i];
    if (key)
        startPerformance(e.key.toLowerCase(), +key.dataset.pitch, .82, key);
} });
document.addEventListener('keyup', e => { const i = keyMap.indexOf(e.key.toLowerCase()); if (i >= 0)
    endPerformance(e.key.toLowerCase(), $$('#keyboard .key')[i]); });
async function initMidi() { if (!navigator.requestMIDIAccess)
    return; try {
    const access = await navigator.requestMIDIAccess({ sysex: false }), states = new Map(), state = (channel) => { if (!states.has(channel))
        states.set(channel, { bend: 0, timbre: .5, pressure: .8 }); return states.get(channel); }, updateHeld = (channel, key, value) => { engine.updateLiveChannel(channel, { [key]: value }); for (const rec of recording.values())
        if (rec.channel === channel)
            rec.note.expression[key] = value; }, bind = (input) => input.onmidimessage = ({ data }) => { const [status = 0, data1 = 0, data2 = 0] = Array.from(data || []), command = status & 0xf0, channel = status & 0x0f, s = state(channel), key = `midi-${channel}-${data1}`, pitch = selectedTrack === 'drums' ? ({ 36: 0, 38: 1, 42: 2, 46: 3, 45: 4, 39: 5, 49: 6 }[data1] ?? Math.max(0, Math.min(6, data1 % 7))) : data1; if (command === 0xe0) {
        s.bend = (((data2 << 7) | data1) - 8192) / 8192 * 2;
        updateHeld(channel, 'bend', s.bend);
        return;
    } if (command === 0xd0) {
        s.pressure = data1 / 127;
        updateHeld(channel, 'pressure', s.pressure);
        return;
    } if (command === 0xa0) {
        engine.updateLive(key, { pressure: data2 / 127 });
        const rec = recording.get(key);
        if (rec)
            rec.note.expression.pressure = data2 / 127;
        return;
    } if (command === 0xb0 && data1 === 74) {
        s.timbre = data2 / 127;
        updateHeld(channel, 'timbre', s.timbre);
        return;
    } if (command === 0x90 && data2)
        startPerformance(key, pitch, data2 / 127, null, { ...s, pressure: data2 / 127 }, channel); if (command === 0x80 || (command === 0x90 && !data2))
        endPerformance(key); };
    for (const input of access.inputs.values())
        bind(input);
    access.onstatechange = e => { if (e.port?.type === 'input' && e.port.state === 'connected')
        bind(e.port); };
}
catch {
    toast('MIDI ACCESS UNAVAILABLE');
} }
const query = new URLSearchParams(location.search);
initWorkflowUi();
initLearning();
renderAll();
applyLanguage();
if (query.get('view'))
    activateView(query.get('view'));
if (query.has('qa')) {
    $('#app').hidden = false;
    $('#boot').remove();
    setDefaultScroll();
}
else
    setTimeout(() => { const boot = $('#boot'); boot.style.opacity = 0; $('#app').hidden = false; setTimeout(() => boot.remove(), 450); setDefaultScroll(); }, 250);
initMidi();
if ('serviceWorker' in navigator && !query.has('qa'))
    navigator.serviceWorker.register('./sw.js').catch(() => { });
