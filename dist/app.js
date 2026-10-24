import { createProject, createEmptyProject, migrateProject, activeClip, clipsForTrack, createClip, clipLengthSteps, meterSteps, setProjectMeter, makeNote, duplicateClip, deleteClip, varyClip, resizeClip, quantizeClip, automationValue, generateClip, generateBacking, encodeMidi, playbackEvents, History, TRACKS, TRACK_META, DRUM_NAMES, SCALES, KEYS, addArrangementScene, duplicateArrangementScene, moveArrangementScene, removeArrangementScene, distributeArrangementPatterns, isInScale, createPerformanceTake, quantizePerformanceTake, captureLauncherScenes, duplicateArrangementSelection, removeArrangementSelection, gainToDb, createAudioLane, createAudioRegion, createAutomationLane, detectTransientSlices, transformNotes, cryptoId, samplerDefaults } from './core.js';
import { AudioEngine, renderWav } from './audio.js';
window.__kvErrors = [];
function reportError(message) { window.__kvErrors.push(String(message)); const el = document.getElementById('toast'); if (el) {
    el.textContent = `ENGINE ERROR: ${String(message)}`;
    el.classList.add('show');
} }
window.addEventListener('error', e => reportError(e.message));
window.addEventListener('unhandledrejection', e => reportError(String(e.reason?.message || e.reason)));
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)], STORAGE = 'kiber-vengance-project-v6', LEGACY_V5 = 'kiber-vengance-project-v5', LEGACY_V4 = 'kiber-vengance-project-v4', LEGACY_V3 = 'kiber-vengance-project-v3', LEGACY = 'kiber-vengance-project-v2', VERSIONS = 'kiber-vengance-versions-v1', UI_STORAGE = 'kiber-vengance-ui-v1', LANGUAGE_STORAGE = 'kiber-vengance-language-v1';
let project = loadProject(), selectedTrack = 'lead', selectedNotes = new Set(), currentStep = -1, currentScene = -1, transportPosition = 0, globalStartStep = 0, draggedScene = -1, recordArmed = false, metronome = false, saveTimer, animation = 0, clipboard = [], recording = new Map(), rollScroll = {}, activeView = 'forge', commandIndex = 0, pendingDeleteClipId = null, suppressSequencerClick = false, scratchBuffer = null, scratchAnimation = 0, scratchAngle = 0, scratchLastFrame = performance.now(), scratchStuttering = false, performanceTake = null, performanceStarted = 0, performanceTimer = null, mixerReference = null, mixerComparing = false, activePerformanceTakeId = null, performanceEvents = null, exportController = null, launcherCapturing = false, launcherSnapshots = [], selectedScenes = new Set(), sceneClipboard = [], mixerPeaks = {}, lastRecovery = 0;
const clipStartSteps = new Map();
let samplerArmed = false, loadedSamplerAssetId = null, samplerQwertyBase = 60;
const samplerHeld = new Map();
let toastTimer;
let editorTool = 'draw';
let soundPanel = false;
let language = localStorage.getItem(LANGUAGE_STORAGE) === 'es' ? 'es' : 'en', tutorialStep = 0, helpMode = false;
const L = (en, es) => language === 'es' ? es : en;
const history = new History();
const engine = new AudioEngine((step, time, scene, info = {}) => { if (step === -2) {
    $('#audioState').textContent = `COUNT ${info.countIn}`;
    return;
} currentStep = step; currentScene = scene; if (step >= 0)
    transportPosition = Number(info.position ?? step); if (step < 0)
    $('#audioState').textContent = 'STANDBY';
else
    $('#audioState').textContent = 'RUNNING'; requestAnimationFrame(() => { updatePlayheads(); updatePosition(); syncLocatorsFromPlayback(); }); });
engine.project = project;
window.__kvDiagnostics = () => engine.diagnostics();
engine.onScratchGesture = (target, value) => recordPerformanceEvent('scratch', target, value);
const presets = { lead: ['Razor Choir', 'Neon Talon', 'Solar Vengeance'], guitar: ['Chrome Strings', 'Voltage Chug', 'Glass Horizon'], bass: ['Foundry Pulse', 'Black Reactor', 'Grind Theory'], pad: ['Afterlight', 'Frozen Cathedral', 'Signal Ghost'], drums: ['Titan Frame', 'Riot Assembly', 'Chrome Bones'] };
const keyMap = 'asdfghjk', pitchNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'], samplerQwertyPitches = [60, 62, 64, 65, 67, 69, 71, 72], samplerQwertyMap = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12 };
function loadProject() { for (const key of [STORAGE, LEGACY_V5, LEGACY_V4, LEGACY_V3, LEGACY])
    try {
        const value = localStorage.getItem(key);
        if (value)
            return migrateProject(JSON.parse(value));
    }
    catch { } return createProject(); }
function esc(v) { return String(v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function snapshot() { history.push(project); }
function changed(render = false) {
    project.modifiedAt = Date.now();
    $('#saveState').textContent = L('Saving…', 'Guardando…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            localStorage.setItem(STORAGE, JSON.stringify(project));
            $('#saveState').textContent = L('Saved on this device', 'Guardado en este dispositivo');
            $('#saveWarning')?.setAttribute('hidden', '');
        }
        catch {
            $('#saveState').textContent = L('Not saved', 'Sin guardar');
            const warning = $('#saveWarning');
            if (warning) {
                warning.hidden = false;
                warning.textContent = L('Could not save locally. Export a project package to keep your changes.', 'No se pudo guardar localmente. Exporta un proyecto completo para conservar los cambios.');
            }
            return;
        }
        if (Date.now() - lastRecovery > 60000) {
            try {
                const list = loadVersions();
                list.unshift({ id: cryptoId(), label: `AUTO RECOVERY · ${project.title}`, date: Date.now(), project: structuredClone(project) });
                localStorage.setItem(VERSIONS, JSON.stringify(list.slice(0, 20)));
                lastRecovery = Date.now();
            }
            catch {
                toast(L('Project saved; recovery snapshot unavailable.', 'Proyecto guardado; copia de recuperación no disponible.'));
            }
        }
    }, 350);
    engine.setProject(project);
    if (project.sampler?.assetId !== loadedSamplerAssetId)
        void loadSamplerAsset();
    if (render)
        renderAll();
    syncStudioUi();
}
function toast(message, undo = false) { clearTimeout(toastTimer); const el = $('#toast'); el.textContent = message; if (undo) {
    const button = document.createElement('button');
    button.textContent = L('Undo', 'Deshacer');
    button.onclick = () => { $('#undoBtn').click(); el.classList.remove('show'); };
    el.append(button);
} el.classList.add('show'); toastTimer = setTimeout(() => el.classList.remove('show'), undo ? 6000 : 2500); }
function download(data, name, type = 'application/octet-stream') { const blob = data instanceof Blob ? data : new Blob([data], { type }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
const quickHandles = new Map(), QUICK_HANDLE_DB = 'kiber-vengance-file-handles-v1', LAST_EXPORT = 'kiber-vengance-last-export-v1';
function quickHandleDb() { return new Promise((resolve, reject) => { const request = indexedDB.open(QUICK_HANDLE_DB, 1); request.onupgradeneeded = () => request.result.createObjectStore('handles'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
const ASSET_DB = 'kiber-vengance-assets-v1';
function assetDb() { return new Promise((resolve, reject) => { const request = indexedDB.open(ASSET_DB, 1); request.onupgradeneeded = () => { request.result.createObjectStore('assets'); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function putAsset(id, blob) { const db = await assetDb(); await new Promise((resolve, reject) => { const request = db.transaction('assets', 'readwrite').objectStore('assets').put(blob, id); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); }
async function getAsset(id) { const db = await assetDb(); return new Promise((resolve, reject) => { const request = db.transaction('assets', 'readonly').objectStore('assets').get(id); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); }); }
async function deleteAsset(id) { const db = await assetDb(); await new Promise((resolve, reject) => { const request = db.transaction('assets', 'readwrite').objectStore('assets').delete(id); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); }
function renderExportTargets() { const target = $('#exportTargets'); if (!target)
    return; const labels = { wav: 'Song WAV', midi: 'Song MIDI', project: 'Project JSON', 'clip-wav': 'Clip WAV', 'clip-midi': 'Clip MIDI', stems: 'Stems ZIP', bundle: 'Project package', performance: 'Performance take' }, kinds = Object.keys(labels); target.innerHTML = kinds.map(kind => { const handle = quickHandles.get(kind); return `<div><span><b>${labels[kind]}</b><small>${handle ? esc(handle.name || L('Linked file', 'Archivo vinculado')) : L('No destination', 'Sin destino')}</small></span>${handle ? `<button data-forget-target="${kind}">${L('FORGET', 'OLVIDAR')}</button>` : ''}</div>`; }).join(''); $$('[data-forget-target]').forEach(button => button.onclick = () => forgetExportTarget(button.dataset.forgetTarget)); }
function showQuickHandle(_kind, _handle) { renderExportTargets(); $('#exportBtn').classList.toggle('bound', quickHandles.size > 0); }
async function loadQuickHandles() { if (!('indexedDB' in window))
    return; try {
    const db = await quickHandleDb(), transaction = db.transaction('handles', 'readonly'), store = transaction.objectStore('handles');
    for (const kind of ['wav', 'midi', 'project', 'clip-wav', 'clip-midi', 'stems', 'bundle', 'performance']) {
        const request = store.get(kind);
        request.onsuccess = () => { if (request.result) {
            quickHandles.set(kind, request.result);
            showQuickHandle(kind, request.result);
        } };
    }
}
catch { } }
async function rememberQuickHandle(kind, handle) { quickHandles.set(kind, handle); showQuickHandle(kind, handle); if (!('indexedDB' in window))
    return; try {
    const db = await quickHandleDb(), transaction = db.transaction('handles', 'readwrite');
    transaction.objectStore('handles').put(handle, kind);
}
catch { } }
async function forgetExportTarget(kind) { quickHandles.delete(kind); try {
    const db = await quickHandleDb(), transaction = db.transaction('handles', 'readwrite');
    transaction.objectStore('handles').delete(kind);
}
catch { } renderExportTargets(); $('#exportBtn').classList.toggle('bound', quickHandles.size > 0); }
async function prepareQuickExport(kind, name, type, extension, description, forcePicker = false) { if (!window.showSaveFilePicker)
    return { handle: null, fallback: true, cancelled: false, name, type }; try {
    let handle = !forcePicker ? quickHandles.get(kind) : null;
    if (handle) {
        let permission = await handle.queryPermission?.({ mode: 'readwrite' }) || 'prompt';
        if (permission !== 'granted')
            permission = await handle.requestPermission?.({ mode: 'readwrite' }) || 'denied';
        if (permission !== 'granted')
            handle = null;
    }
    if (!handle) {
        handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description, accept: { [type]: [extension] } }], excludeAcceptAllOption: false });
        await rememberQuickHandle(kind, handle);
    }
    return { handle, fallback: false, cancelled: false, name: handle.name || name, type };
}
catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
        return { handle: null, fallback: false, cancelled: true, name, type };
    throw error;
} }
async function writeQuickExport(target, data) { if (target.cancelled)
    return false; if (target.fallback) {
    download(data, target.name, target.type);
    return true;
} const writable = await target.handle.createWritable(); await writable.write(data instanceof Blob ? data : new Blob([data], { type: target.type })); await writable.close(); return true; }
async function quickExportProject(forcePicker = false) { await performExport('project', forcePicker); }
function safeName() { return project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kiber-vengance'; }
function clip() { return activeClip(project, selectedTrack); }
function pitches() { if (selectedTrack === 'drums')
    return DRUM_NAMES.map((_, i) => DRUM_NAMES.length - 1 - i); const m = TRACK_META[selectedTrack], out = []; for (let p = m.high; p >= m.low; p--)
    out.push(p); return out; }
const staticCopy = [
    ['#boot p', 'LOADING COMPOSITION ENGINE', 'CARGANDO MOTOR DE COMPOSICIÓN'], ['.project-head label', 'PROJECT', 'PROYECTO'], ['.rail-label', 'INDEPENDENT CLIPS', 'CLIPS INDEPENDIENTES'], ['#newClipBtn', '＋ NEW CLIP', '＋ NUEVO CLIP'], ['[data-view="forge"]', 'FORGE', 'FORJA'], ['[data-view="arrange"]', 'ARRANGE', 'ARREGLO'], ['[data-view="perform"]', 'PERFORM', 'INTERPRETAR'], ['#tutorialBtn', 'GUIDE', 'GUÍA'], ['#focusBtn', 'FOCUS', 'FOCO'], ['#motionRack .eyebrow', 'MOTION ENGINE', 'MOTOR DE MOVIMIENTO'], ['#effectsRack .eyebrow', 'SIGNAL PROCESSING', 'PROCESADO DE SEÑAL'], ['#effectsRack strong', 'TRACK FX', 'EFECTOS DE PISTA'], ['#macroRack .eyebrow', 'VECTOR CONTROL', 'CONTROL VECTORIAL'], ['#macroRack strong', 'SCULPT THE IMPACT', 'MODELA EL IMPACTO'], ['#fxBypass', 'BYPASS', 'OMITIR'], ['.editor-head .eyebrow', 'ACTIVE CLIP', 'CLIP ACTIVO'], ['#duplicateBtn', 'DUPLICATE', 'DUPLICAR'], ['#mutateBtn', 'MUTATE', 'MUTAR'], ['#backingBtn', 'BACKING', 'BASE'], ['#quantizeBtn', 'QUANTIZE', 'CUANTIZAR'], ['#deleteNotesBtn', 'DELETE', 'BORRAR'], ['.automation-head .eyebrow', 'AUTOMATION', 'AUTOMATIZACIÓN'], ['.automation-head>span', 'CLICK / DRAG TO DRAW', 'CLIC / ARRASTRA PARA DIBUJAR'], ['#clearAutomationBtn', 'CLEAR LANE', 'LIMPIAR LÍNEA'], ['#arrangeDescription', 'Each section combines five independent clips. Edit, repeat and reorder the complete song.', 'Cada sección combina cinco clips independientes. Edita, repite y reordena la canción completa.'], ['#addSceneBtn', '＋ ADD SECTION', '＋ AÑADIR SECCIÓN'], ['#autoArrangeBtn', '⟳ AUTO SEQUENCE', '⟳ SECUENCIA AUTO'], ['#performDescription', 'Play the instruments, capture the active mix, and cut it into the performance with the Scratch Deck.', 'Toca los instrumentos, captura la mezcla activa y córtala en directo con el plato de scratch.'], ['#backingDialog .eyebrow', 'BACKING GENERATOR', 'GENERADOR DE BASES'], ['#backingDialog h2', 'BUILD A PLAYABLE FOUNDATION', 'CREA UNA BASE PARA TOCAR'], ['#backingDescription', 'Generate a structured bass, pad and drum arrangement while preserving your lead and guitar clips.', 'Genera un arreglo estructurado de bajo, pad y batería conservando tus clips de lead y guitarra.'], ['#backingWarning', 'The current arrangement will be replaced. You can undo this action.', 'El arreglo actual será reemplazado. Puedes deshacer esta acción.'], ['#generateBackingBtn', 'GENERATE BACKING', 'GENERAR BASE'], ['#projectMenu .eyebrow', 'PROJECT CORE', 'NÚCLEO DEL PROYECTO'], ['#projectMenu h2', 'VERSIONS & RECOVERY', 'VERSIONES Y RECUPERACIÓN'], ['#menuLanguageLabel', 'INTERFACE LANGUAGE', 'IDIOMA DE LA INTERFAZ'], ['#importProjectLabel', 'Import project JSON', 'Importar proyecto JSON'], ['#newBtn', 'New demo project', 'Nuevo proyecto de demostración'], ['#emptyBtn', 'New empty project', 'Nuevo proyecto vacío'], ['#duplicateProjectBtn', 'Duplicate current project', 'Duplicar proyecto actual'], ['#saveBtn', 'Create named snapshot', 'Crear instantánea con nombre'], ['#exportProjectBtn', 'Export project JSON', 'Exportar proyecto JSON'], ['#compatBtn', 'Compatibility report', 'Informe de compatibilidad'], ['.versions-head', 'LOCAL VERSIONS', 'VERSIONES LOCALES'], ['#exportDialog .eyebrow', 'COMMIT THE FULL SIGNAL', 'CONSOLIDA TODA LA SEÑAL'], ['#exportDialog h2', 'EXPORT SONG', 'EXPORTAR CANCIÓN'], ['#exportDialog>p', 'Render the complete arrangement, including repeated clips, automation, arpeggiators and effects.', 'Renderiza todo el arreglo, incluidos clips repetidos, automatización, arpegiadores y efectos.'], ['#wavBtn b', 'SONG WAV', 'CANCIÓN WAV'], ['#exportMidiBtn b', 'SONG MIDI', 'CANCIÓN MIDI'], ['#clipWavBtn b', 'CLIP WAV', 'CLIP WAV'], ['#clipMidiBtn b', 'CLIP MIDI', 'CLIP MIDI'], ['#helpDialog .eyebrow', 'FIELD MANUAL', 'MANUAL DE CAMPO'], ['#helpDialog h2', 'COMPOSITION CONTROLS', 'CONTROLES DE COMPOSICIÓN'], ['#helpDialog .note', 'Drag notes to move them and use the handle on their right edge to resize. Web MIDI records note-on/off, velocity, bend, pressure and timbre.', 'Arrastra las notas para moverlas y usa el tirador derecho para cambiar su duración. Web MIDI graba nota, velocidad, bend, presión y timbre.'], ['#aboutDialog p', 'A complete cinematic electro-rock composition engine built for pressure, motion and controlled impact.', 'Un motor completo de composición electro-rock cinematográfica creado para presión, movimiento e impacto controlado.'], ['#compatDialog .eyebrow', 'SYSTEM DIAGNOSTICS', 'DIAGNÓSTICO DEL SISTEMA'], ['#compatDialog h2', 'COMPATIBILITY REPORT', 'INFORME DE COMPATIBILIDAD'], ['#copyCompatBtn', 'COPY REPORT', 'COPIAR INFORME'], ['#commandDialog .command-head .eyebrow', 'RAPID EXECUTION', 'EJECUCIÓN RÁPIDA'], ['#commandDialog .command-head b', 'COMMAND PALETTE', 'PALETA DE COMANDOS'], ['.command-help', '↑↓ NAVIGATE · ENTER EXECUTE · ESC CLOSE', '↑↓ NAVEGAR · INTRO EJECUTAR · ESC CERRAR'], ['#contextHelpEyebrow', 'CONTEXT HELP', 'AYUDA CONTEXTUAL'], ['#manualBtn', 'KEYBOARD SHORTCUTS', 'ATAJOS DE TECLADO']
];
staticCopy.push(['#effectsRack strong', 'CLIP FX', 'EFECTOS DEL CLIP'], ['#motionRack .clip-scope', 'ACTIVE CLIP', 'CLIP ACTIVO'], ['#effectsRack .clip-scope', 'ACTIVE CLIP', 'CLIP ACTIVO'], ['#macroRack .clip-scope', 'ACTIVE CLIP', 'CLIP ACTIVO'], ['.backing-options label:nth-child(1)>span', 'STYLE', 'ESTILO'], ['.backing-options label:nth-child(2)>span', 'SECTIONS', 'SECCIONES'], ['.backing-options label:nth-child(3)>span', 'INTENSITY', 'INTENSIDAD'], ['#deleteClipDialog .eyebrow', 'DESTRUCTIVE EDIT', 'EDICIÓN DESTRUCTIVA'], ['#deleteClipDialog .delete-clip-warning', 'This removes the clip from the project. You can undo this action.', 'Esto elimina el clip del proyecto. Puedes deshacer la acción.'], ['#cancelDeleteClipBtn', 'CANCEL', 'CANCELAR'], ['#confirmDeleteClipBtn', 'DELETE CLIP', 'BORRAR CLIP']);
staticCopy.push(['#scratchTitle', 'SCRATCH DECK', 'PLATO DE SCRATCH'], ['#scratchCaptureBtn', 'CAPTURE MIX', 'CAPTURAR MEZCLA'], ['#scratchBrakeBtn', 'BRAKE', 'FRENAR'], ['#scratchSpinBtn', '↶ SPINBACK', '↶ RETROCESO'], ['#scratchStutterBtn', 'STUTTER', 'REPETIR'], ['.scratch-hint', 'Drag the vinyl in either direction. Release for motor return; wheel or ← → for precise cuts.', 'Arrastra el vinilo en ambas direcciones. Suelta para recuperar el motor; usa la rueda o ← → para cortes precisos.']);
staticCopy.push(['[data-view="mix"]', 'MIX', 'MEZCLA'], ['#exportAsBtn', 'EXPORT AS', 'EXPORTAR COMO'], ['#globalStartBtn', '▶ SONG', '▶ CANCIÓN'], ['#clipStartBtn', '▶ CLIP', '▶ CLIP'], ['#arrangeDescription', 'Each section combines five independent clips. Click the timeline to set the global start; edit, repeat and reorder the complete song.', 'Cada sección combina cinco clips independientes. Pulsa la línea temporal para fijar el inicio global; edita, repite y reordena la canción.'], ['#exportDialog h2', 'EXPORT / EXPORT AS', 'EXPORTAR / EXPORTAR COMO'], ['#exportDialog>p', 'Export reuses the linked file. Export As always asks for a new destination.', 'Exportar reutiliza el archivo vinculado. Exportar como siempre solicita un destino nuevo.'], ['.export-targets-head', 'EXPORT DESTINATIONS', 'DESTINOS DE EXPORTACIÓN'], ['#forgetTargetsBtn', 'Forget all destinations', 'Olvidar todos los destinos'], ['#mixCaptureBtn', 'CAPTURE A', 'CAPTURAR A'], ['#mixCompareBtn', 'COMPARE B', 'COMPARAR B'], ['#performanceRecordBtn', '● RECORD TAKE', '● GRABAR TOMA'], ['#performanceSaveBtn', 'SAVE TAKE AS', 'GUARDAR TOMA COMO']);
staticCopy.push(['[data-view="launch"]', 'LAUNCH', 'LANZAR'], ['#launchView h1', 'CLIP LAUNCHER', 'LANZADOR DE CLIPS'], ['#launchView .launcher-head p', 'Queue clips without stopping the signal, stop individual tracks, and capture the live sequence into Arrange.', 'Pon clips en cola sin detener la señal, para pistas individuales y captura la secuencia en directo en Arreglo.'], ['#launcherCaptureBtn', '● CAPTURE', '● CAPTURAR'], ['#launcherCommitBtn', 'COMMIT TO ARRANGE', 'ENVIAR AL ARREGLO'], ['#arrangeSelectAllBtn', 'SELECT ALL', 'SELECCIONAR TODO'], ['#arrangeDuplicateBtn', 'DUPLICATE', 'DUPLICAR'], ['#arrangeCopyBtn', 'COPY', 'COPIAR'], ['#arrangePasteBtn', 'PASTE', 'PEGAR'], ['#arrangeDeleteBtn', 'DELETE', 'BORRAR'], ['#arrangeFillBtn', '＋ FILL', '＋ FILL'], ['#arrangeMarkerBtn', '＋ MARKER', '＋ MARCADOR'], ['#masterBypassBtn', 'MASTER FX', 'FX MASTER'], ['#presetLibraryBtn', 'Preset library', 'Biblioteca de presets'], ['#sampleLibraryBtn', 'Local drum samples', 'Samples de batería locales'], ['#compactModeBtn', 'Compact workspace', 'Espacio compacto'], ['#presetDialog h2', 'PRESET VAULT', 'CÁMARA DE PRESETS'], ['#sampleDialog h2', 'IMPACT SAMPLE SLOTS', 'RANURAS DE SAMPLES IMPACT'], ['#saveUserPresetBtn', '＋ SAVE CURRENT', '＋ GUARDAR ACTUAL'], ['#exportPresetBankBtn', 'EXPORT BANK', 'EXPORTAR BANCO'], ['#takeQuantizeBtn', 'QUANTIZE EVENTS', 'CUANTIZAR EVENTOS'], ['#cancelExportBtn', 'CANCEL', 'CANCELAR']);
const leadingCopy = [['label:has(#barsSelect)', 'BARS', 'COMPASES'], ['label:has(#gridSelect)', 'SNAP', 'AJUSTE'], ['label:has(#zoomRange)', 'ZOOM', 'ZOOM'], ['label:has(#keySelect)', 'KEY', 'TONALIDAD'], ['label:has(#scaleSelect)', 'SCALE', 'ESCALA'], ['label:has(#noteLength)', 'LEN', 'DUR'], ['label:has(#noteVelocity)', 'VEL', 'VEL'], ['label:has(#arpMode)', 'MODE', 'MODO'], ['label:has(#arpOctaves)', 'OCT', 'OCT'], ['label:has(#arpRate)', 'RATE', 'RITMO'], ['label:has(#lfoTarget)', 'TARGET', 'DESTINO'], ['label:has(#lfoRate)', 'LFO RATE', 'RITMO LFO'], ['label:has(#lfoDepth)', 'DEPTH', 'PROFUNDIDAD']];
const shortcutCopy = [['Play / stop from locator', 'Reproducir / parar desde el localizador'], ['Perform / record', 'Interpretar / grabar'], ['Select track', 'Seleccionar pista'], ['Command palette', 'Paleta de comandos'], ['Export to current destination', 'Exportar al destino actual'], ['Open Export As', 'Abrir Exportar como'], ['Toggle Focus mode', 'Activar modo Foco'], ['Forge / Launch / Arrange / Mix / Perform', 'Forja / Lanzar / Arreglo / Mezcla / Interpretar'], ['New / duplicate clip', 'Nuevo / duplicar clip'], ['Solo / mute active track', 'Solo / silenciar pista activa'], ['Mutate / quantize', 'Mutar / cuantizar'], ['Undo / redo', 'Deshacer / rehacer'], ['Multi-select notes', 'Selección múltiple'], ['Select all notes', 'Seleccionar todas las notas'], ['Move selected notes', 'Mover notas seleccionadas'], ['Resize selected notes', 'Redimensionar notas'], ['Copy / paste notes', 'Copiar / pegar notas'], ['Delete selection', 'Borrar selección']];
const controlDescriptions = {
    aboutBtn: ['Brand & about', 'Marca e información', 'Open product information and version details.', 'Abre la información del producto y sus detalles.'], title: ['Project title', 'Título del proyecto', 'Rename the current project. Changes are saved locally.', 'Renombra el proyecto actual. Los cambios se guardan localmente.'], rewindBtn: ['Return to start', 'Volver al inicio', 'Stop playback and return the playhead to the beginning.', 'Detiene la reproducción y devuelve el cursor al inicio.'], playBtn: ['Play / stop', 'Reproducir / parar', 'Start or stop the active clip or full arrangement. Shortcut: Space.', 'Inicia o detiene el clip activo o el arreglo completo. Atajo: Espacio.'], recordBtn: ['Record arm', 'Armar grabación', 'Arm live recording from the computer keyboard, touch keys or MIDI.', 'Prepara la grabación en directo desde teclado, controles táctiles o MIDI.'], recordMode: ['Recording timing', 'Temporización de grabación', 'Choose quantized timing or preserve free microtiming.', 'Elige tiempo cuantizado o conserva el microtiming libre.'], tempo: ['Tempo', 'Tempo', 'Set song speed in beats per minute.', 'Ajusta la velocidad de la canción en pulsos por minuto.'], meterSelect: ['Time signature', 'Compás', 'Choose the rhythmic meter used by clips and bars.', 'Elige el compás rítmico utilizado por clips y barras.'], swing: ['Swing', 'Swing', 'Delay alternating subdivisions to add groove.', 'Retrasa subdivisiones alternas para añadir groove.'], countIn: ['Count-in', 'Cuenta atrás', 'Choose how many bars play before armed recording starts.', 'Elige cuántos compases suenan antes de iniciar la grabación.'], metroBtn: ['Metronome', 'Metrónomo', 'Toggle the accented timing click during playback.', 'Activa o desactiva el clic acentuado durante la reproducción.'], masterVolume: ['Master volume', 'Volumen maestro', 'Set the final output level for the complete mix.', 'Ajusta el nivel final de salida de toda la mezcla.'], languageSelect: ['Language', 'Idioma', 'Switch the complete interface between English and Spanish.', 'Cambia toda la interfaz entre inglés y español.'], exportBtn: ['Export', 'Exportar', 'Render the song or active clips to WAV or MIDI.', 'Renderiza la canción o los clips activos a WAV o MIDI.'], menuBtn: ['Project menu', 'Menú del proyecto', 'Create, import, export or restore project versions.', 'Crea, importa, exporta o restaura versiones del proyecto.'], tutorialBtn: ['Interactive guide', 'Guía interactiva', 'Start a guided tour through the complete composition workflow.', 'Inicia un recorrido guiado por todo el flujo de composición.'], focusBtn: ['Focus mode', 'Modo Foco', 'Hide secondary racks and dedicate more space to note editing.', 'Oculta paneles secundarios y dedica más espacio a editar notas.'], commandBtn: ['Command palette', 'Paleta de comandos', 'Search and execute any common action from the keyboard.', 'Busca y ejecuta acciones habituales desde el teclado.'], undoBtn: ['Undo', 'Deshacer', 'Restore the previous musical edit.', 'Restaura la edición musical anterior.'], redoBtn: ['Redo', 'Rehacer', 'Reapply the last undone edit.', 'Vuelve a aplicar la última edición deshecha.'], helpBtn: ['Context help', 'Ayuda contextual', 'Show a live explanation whenever a control is focused or touched.', 'Muestra una explicación cuando enfocas o tocas un control.'], preset: ['Sound preset', 'Preset de sonido', 'Load a designed starting sound for the selected track.', 'Carga un sonido inicial diseñado para la pista seleccionada.'], waveSelect: ['Main oscillator', 'Oscilador principal', 'Choose the waveform that defines the core timbre.', 'Elige la forma de onda que define el timbre principal.'], osc2WaveSelect: ['Second oscillator', 'Segundo oscilador', 'Choose an additional waveform or switch oscillator two off.', 'Elige una onda adicional o desactiva el segundo oscilador.'], filterSelect: ['Filter type', 'Tipo de filtro', 'Choose which frequencies the synthesizer filter removes.', 'Elige qué frecuencias elimina el filtro del sintetizador.'], arpEnabled: ['Arpeggiator', 'Arpegiador', 'Turn held notes into a rhythmic sequence.', 'Convierte las notas mantenidas en una secuencia rítmica.'], arpMode: ['Arpeggio direction', 'Dirección del arpegio', 'Choose the order in which held notes are played.', 'Elige el orden en el que se reproducen las notas.'], arpOctaves: ['Arpeggio octaves', 'Octavas del arpegio', 'Set the pitch range covered by the arpeggiator.', 'Ajusta el rango tonal recorrido por el arpegiador.'], arpRate: ['Arpeggio rate', 'Velocidad del arpegio', 'Choose the rhythmic subdivision for generated notes.', 'Elige la subdivisión rítmica de las notas generadas.'], lfoEnabled: ['LFO modulation', 'Modulación LFO', 'Enable cyclic movement for the selected target.', 'Activa movimiento cíclico sobre el destino seleccionado.'], lfoTarget: ['LFO target', 'Destino del LFO', 'Choose the sound parameter moved by the LFO.', 'Elige el parámetro de sonido que moverá el LFO.'], lfoRate: ['LFO rate', 'Velocidad del LFO', 'Set how quickly the modulation cycle repeats.', 'Ajusta la velocidad con que se repite la modulación.'], lfoDepth: ['LFO depth', 'Profundidad del LFO', 'Set the amount of cyclic modulation.', 'Ajusta la cantidad de modulación cíclica.'], fxBypass: ['Effects bypass', 'Omitir efectos', 'Disable or restore all effects on the selected track.', 'Desactiva o restaura todos los efectos de la pista.'], clipSelect: ['Active clip', 'Clip activo', 'Choose which independent pattern is edited for this track.', 'Elige qué patrón independiente se edita en esta pista.'], renameClipBtn: ['Rename clip', 'Renombrar clip', 'Give the active clip a descriptive name.', 'Asigna un nombre descriptivo al clip activo.'], duplicateBtn: ['Duplicate clip', 'Duplicar clip', 'Create an independent copy of the active clip.', 'Crea una copia independiente del clip activo.'], mutateBtn: ['Mutate clip', 'Mutar clip', 'Generate a controlled variation using the Tension macro.', 'Genera una variación controlada usando la macro Tensión.'], backingBtn: ['Backing generator', 'Generador de bases', 'Create a structured accompaniment for bass, pad and drums without changing guitar or lead clips.', 'Crea un acompañamiento estructurado de bajo, pad y batería sin cambiar los clips de guitarra ni lead.'], generateBackingBtn: ['Generate backing', 'Generar base', 'Replace the arrangement with the selected generated backing. The edit can be undone.', 'Reemplaza el arreglo por la base generada seleccionada. La edición se puede deshacer.'], barsSelect: ['Clip length', 'Duración del clip', 'Resize the active clip in musical bars.', 'Cambia la duración del clip activo en compases.'], gridSelect: ['Snap grid', 'Rejilla de ajuste', 'Choose the rhythmic resolution for placing and moving notes.', 'Elige la resolución rítmica para colocar y mover notas.'], zoomRange: ['Editor zoom', 'Zoom del editor', 'Change the horizontal width of sequencer steps.', 'Cambia el ancho horizontal de los pasos del secuenciador.'], keySelect: ['Song key', 'Tonalidad', 'Set the root note used by scale-aware generators.', 'Ajusta la nota raíz usada por los generadores musicales.'], scaleSelect: ['Musical scale', 'Escala musical', 'Constrain generated material to a harmonic scale.', 'Limita el material generado a una escala armónica.'], quantizeBtn: ['Quantize', 'Cuantizar', 'Align notes to the currently selected snap grid.', 'Alinea las notas con la rejilla seleccionada.'], automationParam: ['Automation lane', 'Línea de automatización', 'Choose which parameter is drawn below the piano roll.', 'Elige qué parámetro se dibuja bajo el piano roll.'], clearAutomationBtn: ['Clear automation', 'Limpiar automatización', 'Remove every point from the visible automation lane.', 'Elimina todos los puntos de la automatización visible.'], addSceneBtn: ['Add section', 'Añadir sección', 'Append a new song section using the active clips.', 'Añade una nueva sección usando los clips activos.'], autoArrangeBtn: ['Auto sequence', 'Secuencia automática', 'Distribute available clips across the complete song.', 'Distribuye los clips disponibles a lo largo de la canción.'],
    deleteClipBtn: ['Delete active clip', 'Borrar clip activo', 'Delete this clip safely. Arrangement sections are reassigned and the operation can be undone.', 'Borra este clip de forma segura. Las secciones del arreglo se reasignan y puedes deshacer la operación.'], confirmDeleteClipBtn: ['Confirm clip deletion', 'Confirmar borrado del clip', 'Permanently remove the selected clip from this project.', 'Elimina el clip seleccionado de este proyecto.'], sequencer: ['Piano roll', 'Piano roll', 'Click to add a note. Drag across empty space to select several notes; hold Shift to add them to the current selection.', 'Haz clic para añadir una nota. Arrastra sobre un espacio vacío para seleccionar varias; mantén Mayús para sumarlas a la selección actual.']
};
Object.assign(controlDescriptions, { arpEnabled: ['Clip arpeggiator', 'Arpegiador del clip', 'Turn held notes in the active clip into a rhythmic sequence.', 'Convierte las notas mantenidas del clip activo en una secuencia rítmica.'], lfoEnabled: ['Clip LFO', 'LFO del clip', 'Enable cyclic modulation for the active clip.', 'Activa la modulación cíclica del clip activo.'], fxBypass: ['Clip effects bypass', 'Omitir efectos del clip', 'Disable or restore effects on the active clip.', 'Desactiva o restaura los efectos del clip activo.'], clipSelect: ['Active clip and character', 'Clip y carácter activos', 'Choose the pattern together with its independent motion, effects and vector settings.', 'Elige el patrón junto con sus ajustes independientes de movimiento, efectos y vectores.'] });
Object.assign(controlDescriptions, { scratchCaptureBtn: ['Capture active mix', 'Capturar mezcla activa', 'Render the active clips into a mastered one, two, four, or eight-bar scratch buffer.', 'Renderiza los clips activos en un búfer masterizado de uno, dos, cuatro u ocho compases.'], scratchPlatter: ['Bidirectional scratch platter', 'Plato de scratch bidireccional', 'Drag in either direction for sample-accurate scratching. Release to return smoothly to normal motor speed.', 'Arrastra en ambas direcciones para hacer scratch con precisión de muestra. Suelta para recuperar suavemente la velocidad normal.'], scratchSyncBtn: ['Beat sync', 'Sincronía de pulso', 'Move the deck to the nearest beat boundary and return to normal speed.', 'Mueve el plato al pulso más cercano y recupera la velocidad normal.'], scratchBrakeBtn: ['Motor brake', 'Freno de motor', 'Slow the deck to a stop with a progressive motor brake.', 'Detiene el plato progresivamente con un freno de motor.'], scratchSpinBtn: ['Spinback', 'Retroceso', 'Throw the record backwards and let it decelerate.', 'Lanza el disco hacia atrás y deja que desacelere.'], scratchStutterBtn: ['Beat stutter', 'Repetición rítmica', 'Loop a short tempo-derived fragment until this control is released.', 'Repite un fragmento corto derivado del tempo hasta desactivar el control.'], scratchMix: ['Deck crossfader', 'Crossfader del plato', 'Blend between the live program and the captured Scratch Deck with equal-power curves.', 'Mezcla el programa en directo y el plato capturado con curvas de potencia constante.'], scratchFilter: ['Deck filter', 'Filtro del plato', 'Darken the Scratch Deck with a smooth resonant-free low-pass filter.', 'Oscurece el plato con un filtro paso bajo suave y sin resonancia.'], scratchWaveform: ['Scratch waveform', 'Forma de onda de scratch', 'Shows the captured buffer and its live playback position.', 'Muestra el búfer capturado y su posición de reproducción en directo.'] });
Object.assign(controlDescriptions, { exportBtn: ['Export', 'Exportar', 'Repeat the last export recipe and update its linked file. Shortcut: Ctrl or Command plus E.', 'Repite la última exportación y actualiza su archivo vinculado. Atajo: Ctrl o Comando más E.'], exportAsBtn: ['Export As', 'Exportar como', 'Choose a format and always select a new destination. Shortcut: Ctrl or Command plus Shift plus E.', 'Elige un formato y selecciona siempre un destino nuevo. Atajo: Ctrl o Comando más Mayús más E.'], globalPosition: ['Song start locator', 'Localizador de inicio de canción', 'Choose the exact arrangement step where global playback begins.', 'Elige el paso exacto del arreglo donde comienza la reproducción global.'], clipPosition: ['Clip start locator', 'Localizador de inicio del clip', 'Choose the exact step where active-clip playback begins.', 'Elige el paso exacto donde comienza la reproducción del clip activo.'], performanceRecordBtn: ['Record performance take', 'Grabar toma de interpretación', 'Capture the audible master in real time, including the Scratch Deck.', 'Captura el master audible en tiempo real, incluido el plato de scratch.'] });
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
} $('#commandSearch').placeholder = L('Search actions, views, tracks…', 'Buscar acciones, vistas, pistas…'); $('#commandSearch').ariaLabel = L('Search commands', 'Buscar comandos'); $('#commandDialog').ariaLabel = L('Command palette', 'Paleta de comandos'); $('#contextHelpClose').ariaLabel = L('Close help', 'Cerrar ayuda'); document.querySelector('meta[name="description"]')?.setAttribute('content', L('КИБЕР VENGANCE — cinematic electro-rock composition workstation.', 'КИБЕР VENGANCE — estación de composición electro-rock cinematográfica.')); if (render)
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
    $('#tracks').innerHTML = TRACKS.map((id, i) => { const m = TRACK_META[id], t = project.tracks[id], c = activeClip(project, id); return `<div class="track ${id === selectedTrack ? 'active' : ''} ${t.solo ? 'soloed' : ''} ${soloActive && !t.solo ? 'solo-muted' : ''}" data-track="${id}" style="--track:${t.color || m.color}"><button class="track-select"><span class="track-head"><span><b class="track-name">${m.label}</b><small>${esc(c?.name || L('NO CLIP', 'SIN CLIP'))}</small></span><b>0${i + 1}</b></span><span class="track-foot"><span class="track-meter"><i style="width:${t.volume * 100}%"></i></span></span></button><span class="track-switches"><button class="solo ${t.solo ? 'on' : ''}" data-solo="${id}" aria-label="${L('Solo track', 'Aislar pista')} ${m.label}" aria-pressed="${t.solo}">S</button><button class="mute ${t.mute ? 'on' : ''}" data-mute="${id}" aria-label="${L('Mute track', 'Silenciar pista')} ${m.label}" aria-pressed="${t.mute}">M</button></span></div>`; }).join('');
    $$('.track').forEach(el => el.onclick = (e) => { const solo = e.target.closest('[data-solo]'), mute = e.target.closest('[data-mute]'); if (solo) {
        e.stopPropagation();
        snapshot();
        const id = solo.dataset.solo, was = project.tracks[id].solo;
        TRACKS.forEach(track => project.tracks[track].solo = false);
        project.tracks[id].solo = !was;
        if (!was)
            project.tracks[id].mute = false;
        recordPerformanceEvent('mixer', id + ':solo', !was);
        changed(true);
        toast(was ? L('FULL MIX RESTORED', 'MEZCLA COMPLETA RESTAURADA') : L(`${TRACK_META[id].label} · SOLO`, `SOLO · ${TRACK_META[id].label}`));
        return;
    } if (mute) {
        e.stopPropagation();
        snapshot();
        project.tracks[mute.dataset.mute].mute = !project.tracks[mute.dataset.mute].mute;
        recordPerformanceEvent('mixer', mute.dataset.mute + ':mute', project.tracks[mute.dataset.mute].mute);
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
function macroMarkup(container) { const macros = clip().character.macros, names = { energy: L('ENERGY', 'ENERGÍA'), darkness: L('DARKNESS', 'OSCURIDAD'), tension: L('TENSION', 'TENSIÓN'), aggression: L('AGGRESSION', 'AGRESIÓN'), space: L('SPACE', 'ESPACIO'), complexity: L('COMPLEXITY', 'COMPLEJIDAD') }; container.innerHTML = Object.entries(macros).map(([k, v]) => `<div class="macro"><label><span>${names[k] || k.toUpperCase()}</span><output>${Math.round(v * 100)}</output></label><input data-macro="${k}" type="range" min="0" max="1" step=".01" value="${v}"></div>`).join(''); container.querySelectorAll('input').forEach((i) => { i.onpointerdown = snapshot; i.oninput = () => { macros[i.dataset.macro] = +i.value; i.closest('.macro').querySelector('output').textContent = Math.round(i.value * 100); engine.setProject(project); recordPerformanceEvent('macro', `${clip().id}:${i.dataset.macro}`, +i.value); updateOrb(); }; i.onchange = () => changed(); }); }
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
function renderHarmony() { $('#keySelect').innerHTML = KEYS.map(k => `<option ${k === project.key ? 'selected' : ''}>${k}</option>`).join(''); $('#scaleSelect').innerHTML = Object.keys(SCALES).map(s => `<option value="${s}" ${s === project.scale ? 'selected' : ''}>${s.replace(/([A-Z])/g, ' $1').toUpperCase()}</option>`).join(''); $('#keySelect').onchange = () => { snapshot(); project.key = $('#keySelect').value; changed(true); }; $('#scaleSelect').onchange = () => { snapshot(); project.scale = $('#scaleSelect').value; changed(true); }; $$('[data-generate]').forEach(b => { const type = b.dataset.generate; b.disabled = (selectedTrack === 'drums' && type !== 'drums') || (selectedTrack !== 'drums' && type === 'drums'); b.onclick = () => { snapshot(); generateClip(project, clip(), type, clip().character.macros.complexity); selectedNotes.clear(); changed(true); toast(L('Musical material generated', 'Material musical generado'), true); }; }); $('#quantizeBtn').onclick = () => { snapshot(); quantizeClip(clip(), project.editor.snap); changed(true); toast(L('Clip quantized', 'Clip cuantizado'), true); }; }
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
    } if (editorTool !== 'draw' || e.target !== seq)
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
function bindMarqueeSelection(seq) { seq.onpointerdown = (e) => { if (editorTool === 'navigate' || e.target !== seq || (e.button != null && e.button !== 0) || e.pointerType === 'touch')
    return; const rect = seq.getBoundingClientRect(), clamp = (value, max) => Math.max(0, Math.min(max, value)), startX = clamp(e.clientX - rect.left, seq.clientWidth), startY = clamp(e.clientY - rect.top, seq.clientHeight), base = e.shiftKey ? new Set(selectedNotes) : new Set(), box = document.createElement('div'); box.className = 'selection-marquee'; seq.append(box); let moved = false; const move = (ev) => { const x = clamp(ev.clientX - rect.left, seq.clientWidth), y = clamp(ev.clientY - rect.top, seq.clientHeight), left = Math.min(startX, x), top = Math.min(startY, y), right = Math.max(startX, x), bottom = Math.max(startY, y); if (!moved && Math.hypot(x - startX, y - startY) < 4)
    return; moved = true; ev.preventDefault(); Object.assign(box.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` }); const next = new Set(base); seq.querySelectorAll('.note-block').forEach((note) => { const noteRight = note.offsetLeft + note.offsetWidth, noteBottom = note.offsetTop + note.offsetHeight; if (note.offsetLeft <= right && noteRight >= left && note.offsetTop <= bottom && noteBottom >= top)
    next.add(note.dataset.note); }); selectedNotes = next; syncSelectedClasses(); renderSelection(); }, up = () => { box.remove(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (moved) {
    suppressSequencerClick = true;
    renderSelection();
} }; window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); }; }
function bindNoteDrag(el, c, rows, zoom, rowH) { el.onpointerdown = (e) => { if (editorTool === 'navigate')
    return; e.stopPropagation(); const id = el.dataset.note; if (editorTool === 'select') {
    selectedNotes.has(id) ? selectedNotes.delete(id) : selectedNotes.add(id);
    syncSelectedClasses();
    renderSelection();
    return;
} if (e.shiftKey) {
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
} renderPiano(); }; const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (moved)
    changed(); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); }; }
function syncSelectedClasses() { $$('.note-block').forEach(n => n.classList.toggle('selected', selectedNotes.has(n.dataset.note))); }
function syncRollScroll() { const pane = $('#rollPane'), content = $('#rollRuler .ruler-content'); if (content)
    content.style.transform = `translateX(${-pane.scrollLeft}px)`; $('#pianoLabelRows').style.transform = `translateY(${-pane.scrollTop}px)`; $('#automationPane').scrollLeft = pane.scrollLeft; }
function setDefaultScroll() { setTimeout(() => { const pane = $('#rollPane'); if (!pane || selectedTrack === 'drums')
    return; const row = (TRACK_META[selectedTrack].high - TRACK_META[selectedTrack].base) * 22; pane.scrollTop = Math.max(0, row - pane.clientHeight / 2); rollScroll[selectedTrack] = { left: 0, top: pane.scrollTop }; syncRollScroll(); }, 0); }
function renderSelection() { const notes = clip().notes.filter(n => selectedNotes.has(n.id)); $('#selectionCount').textContent = language === 'es' ? `${notes.length} NOTA${notes.length === 1 ? '' : 'S'}` : `${notes.length} NOTE${notes.length === 1 ? '' : 'S'}`; $('#noteLength').disabled = !notes.length; $('#noteVelocity').disabled = !notes.length; $('#deleteNotesBtn').disabled = !notes.length; $$('[data-selection-action]').forEach((button) => button.disabled = !notes.length); if (notes.length) {
    $('#noteLength').value = notes[0].length;
    $('#noteVelocity').value = notes.reduce((a, n) => a + n.velocity, 0) / notes.length;
} }
function editSelection(key, value) { const notes = clip().notes.filter(n => selectedNotes.has(n.id)); if (!notes.length)
    return; snapshot(); for (const n of notes)
    n[key] = key === 'velocity' ? Math.max(.01, Math.min(1, +value)) : Math.max(project.editor.snap, Math.min(clipLengthSteps(clip()) - n.step, +value)); changed(); renderPiano(); }
function deleteSelection() { if (!selectedNotes.size)
    return; snapshot(); clip().notes = clip().notes.filter(n => !selectedNotes.has(n.id)); selectedNotes.clear(); changed(); renderPiano(); renderSelection(); toast(L('Selected notes deleted', 'Notas seleccionadas borradas'), true); }
function renderAutomation() { const c = clip(), steps = clipLengthSteps(c), zoom = project.editor.zoom, param = project.editor.automationParam, lane = c.automation[param]; $('#automationParam').value = param; const el = $('#automationLane'); el.style.width = `${steps * zoom}px`; el.innerHTML = Array.from({ length: steps }, (_, s) => { const value = automationValue(c, param, s, .5), point = lane[s] != null; return `<i class="automation-step ${point ? 'point' : ''}" style="left:${s * zoom}px;width:${zoom}px;--value:${value}" data-step="${s}"></i>`; }).join('') + `<div class="automation-playhead" style="left:${Math.max(0, currentStep % steps) * zoom}px"></div>`; const draw = (e) => { const rect = el.getBoundingClientRect(), step = Math.max(0, Math.min(steps - 1, Math.round((e.clientX - rect.left) / zoom / project.editor.snap) * project.editor.snap)), value = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height)); lane[step] = value; renderAutomation(); engine.setProject(project); }; el.onpointerdown = (e) => { snapshot(); draw(e); const move = (ev) => draw(ev), up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); changed(); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); }; $('#automationPane').scrollLeft = $('#rollPane').scrollLeft; }
const heldKeyPointers = new Map();
function releaseKeyPointer(pointerId) { const held = heldKeyPointers.get(pointerId); if (!held)
    return; heldKeyPointers.delete(pointerId); endPerformance(held.source, held.key); }
function releaseKeyPointers() { for (const id of [...heldKeyPointers.keys()])
    releaseKeyPointer(id); }
window.addEventListener('blur', releaseKeyPointers);
document.addEventListener('visibilitychange', () => { if (document.hidden)
    releaseKeyPointers(); });
function renderKeyboard() {
    releaseKeyPointers();
    const base = TRACK_META[selectedTrack].base, offsets = selectedTrack === 'drums' ? [0, 1, 2, 3, 4, 5, 6] : [0, 2, 4, 5, 7, 9, 11, 12];
    const markup = offsets.map((x, i) => `<button class="key" data-pitch="${base + x}" data-source="${keyMap[i] || i}" aria-label="${selectedTrack === 'drums' ? DRUM_NAMES[x] : pitchNames[(base + x) % 12]} ${keyMap[i]?.toUpperCase() || ''}">${keyMap[i]?.toUpperCase() || ''}</button>`).join('');
    for (const id of ['#keyboard', '#performanceKeyboard']) {
        $(id).innerHTML = markup;
        $(id).querySelectorAll('.key').forEach((key) => {
            key.onpointerdown = (event) => { if (event.button !== 0)
                return; event.preventDefault(); const source = `key-pointer-${event.pointerId}`; heldKeyPointers.set(event.pointerId, { source, key }); key.setPointerCapture(event.pointerId); startPerformance(source, Number(key.dataset.pitch), .85, key); };
            key.onpointerup = key.onpointercancel = key.onlostpointercapture = (event) => releaseKeyPointer(event.pointerId);
            key.ondblclick = event => event.preventDefault();
        });
    }
}
function startPerformance(source, pitch, velocity = .8, el = null, expression = {}, channel = null) { if (samplerArmed && activeView === 'audio') {
    const keyboardIndex = keyMap.indexOf(source), samplerPitch = keyboardIndex >= 0 ? samplerQwertyPitches[keyboardIndex] : pitch, samplerKey = $(`[data-sampler-pitch="${samplerPitch}"]`);
    startSamplerPerformance(source, samplerPitch, velocity, samplerKey);
    return;
} el?.classList.add('active'); engine.startLive(source, selectedTrack, pitch, velocity, expression, channel); if (recordArmed && engine.playing && (!project.loop.punch || (transportPosition >= project.loop.start && transportPosition < project.loop.end))) {
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
function endPerformance(source, el = null) { if (engine.samplerVoices.has(source)) {
    endSamplerPerformance(source);
    return;
} el?.classList.remove('active'); engine.stopLive(source); const rec = recording.get(source); if (!rec)
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
function launcherSnapshot(name = 'LIVE') { const current = { name, clipIds: { ...project.activeClipIds }, repeats: 1 }; const previous = launcherSnapshots.at(-1); if (previous && TRACKS.every(track => previous.clipIds[track] === current.clipIds[track]))
    previous.repeats = Math.min(16, previous.repeats + 1);
else
    launcherSnapshots.push(current); $('#launcherCommitBtn').disabled = !launcherSnapshots.length; }
async function launchClip(track, clipId) { const quantization = +$('#launchQuantize').value || project.launcher.quantization; project.launcher.quantization = quantization; engine.stopLauncherTrack(track, false); if (!engine.playing) {
    project.activeClipIds[track] = clipId;
    await togglePlay(false);
    engine.onLaunch?.(track, clipId, 0);
}
else
    engine.queueClip(track, clipId, quantization); recordPerformanceEvent('launcher', track, clipId); renderLauncher(); }
function renderLauncher() { const root = $('#launcherGrid'); if (!root)
    return; root.innerHTML = TRACKS.map(track => { const cfg = project.tracks[track], clips = clipsForTrack(project, track), queued = engine.launchQueue.get(track)?.clipId; return `<section class="launcher-track" style="--track:${cfg.color || TRACK_META[track].color}"><header><b>${TRACK_META[track].label}</b><button data-launch-stop="${track}" aria-label="${L('Stop track', 'Parar pista')}">■</button></header>${clips.map(item => `<button class="launcher-cell ${project.activeClipIds[track] === item.id && !engine.launcherStopped.has(track) ? 'active' : ''} ${queued === item.id ? 'queued' : ''}" data-launch-track="${track}" data-launch-clip="${item.id}"><b>${esc(item.name)}</b><small>${item.bars} ${L('BARS', 'COMPASES')} · ${item.notes.length} NOTES</small></button>`).join('')}</section>`; }).join(''); $$('[data-launch-clip]').forEach(button => button.onclick = () => launchClip(button.dataset.launchTrack, button.dataset.launchClip)); $$('[data-launch-stop]').forEach(button => button.onclick = () => { const track = button.dataset.launchStop; engine.stopLauncherTrack(track, true); engine.launchQueue.delete(track); recordPerformanceEvent('launcher', track, 'stop'); renderLauncher(); }); $('#launchQuantize').value = String(project.launcher.quantization); }
function setupLauncher() { engine.onLaunch = (track, clipId) => { if (launcherCapturing)
    launcherSnapshot(`LIVE ${launcherSnapshots.length + 1}`); $('#launcherStatus').textContent = `${TRACK_META[track].label} · ${project.clips.find((item) => item.id === clipId)?.name || 'CLIP'} · LIVE`; renderLauncher(); changed(); }; $('#launchQuantize').onchange = () => { project.launcher.quantization = +$('#launchQuantize').value; changed(); }; $('#launcherCaptureBtn').onclick = () => { launcherCapturing = !launcherCapturing; if (launcherCapturing)
    launcherSnapshots = []; $('#launcherCaptureBtn').setAttribute('aria-pressed', String(launcherCapturing)); $('#launcherCaptureBtn').textContent = launcherCapturing ? '■ STOP CAPTURE' : '● CAPTURE'; if (launcherCapturing)
    launcherSnapshot('LIVE 1');
else
    $('#launcherCommitBtn').disabled = !launcherSnapshots.length; }; $('#launcherCommitBtn').onclick = () => { if (!launcherSnapshots.length)
    return; snapshot(); captureLauncherScenes(project, launcherSnapshots); launcherSnapshots = []; launcherCapturing = false; $('#launcherCaptureBtn').setAttribute('aria-pressed', 'false'); $('#launcherCaptureBtn').textContent = '● CAPTURE'; changed(true); activateView('arrange'); toast(L('LIVE SEQUENCE COMMITTED TO ARRANGE', 'SECUENCIA EN DIRECTO AÑADIDA AL ARREGLO')); }; }
function renderArrangement() {
    const options = (track, id) => clipsForTrack(project, track).map(c => `<option value="${c.id}" ${c.id === id ? 'selected' : ''}>${esc(c.name)} · ${c.bars}b</option>`).join(''), { durationSteps } = playbackEvents(project, { song: true }), seconds = durationSteps * 60 / project.tempo / 4;
    $('#songStats').textContent = language === 'es' ? `${project.arrangement.length} SECCIONES · ${Math.ceil(durationSteps / meterSteps(project.meter))} COMPASES · ${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}` : `${project.arrangement.length} SECTIONS · ${Math.ceil(durationSteps / meterSteps(project.meter))} BARS · ${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
    let timelineCursor = 0;
    $('#arrangeTimeline').innerHTML = project.arrangement.map((scene, index) => { const length = sceneLength(scene) * scene.repeats, start = timelineCursor; timelineCursor += length; return `<button data-timeline-start="${start}" data-timeline-scene="${index}" data-timeline-length="${length}" style="--scene-width:${Math.max(1, length / durationSteps * 100)}%"><b>${String(index + 1).padStart(2, '0')} · ${esc(scene.name)}</b><span>${Math.ceil(length / meterSteps(project.meter))} ${L('BARS', 'COMPASES')}</span></button>`; }).join('') + `<i class="arrange-playhead" style="left:${durationSteps ? transportPosition / durationSteps * 100 : 0}%"></i>`;
    $$('[data-timeline-start]').forEach(button => button.onclick = (event) => { const rect = button.getBoundingClientRect(), offset = Math.floor((event.clientX - rect.left) / Math.max(1, rect.width) * (+button.dataset.timelineLength)); setGlobalStart(+button.dataset.timelineStart + offset); focusScene(+button.dataset.timelineScene); });
    $('#arrangement').innerHTML = project.arrangement.map((s, i) => `<article class="scene ${selectedScenes.has(i) ? 'selected' : ''} ${currentScene === i && engine.playing ? 'playing' : ''}" data-scene="${i}" tabindex="0"><div class="scene-top"><span class="drag-handle" draggable="true">⠿</span><input data-scene-name aria-label="${L('Section', 'Sección')} ${i + 1}" value="${esc(s.name)}"><button data-action="remove" aria-label="${L('Remove section', 'Eliminar sección')} ${i + 1}" ${project.arrangement.length === 1 ? 'disabled' : ''}>×</button></div><div class="scene-clips">${TRACKS.map(t => `<label style="--track:${TRACK_META[t].color}"><span>${TRACK_META[t].label}</span><select data-scene-track="${t}">${options(t, s.clipIds[t])}</select></label>`).join('')}</div><div class="scene-bottom"><label class="scene-repeats"><span>${L('REPEATS', 'REPETICIONES')}</span><input data-repeats type="number" min="1" max="16" value="${s.repeats}"></label><div class="scene-actions"><button data-action="left" aria-label="${L('Move section left', 'Mover sección a la izquierda')}" ${i === 0 ? 'disabled' : ''}>←</button><button data-action="duplicate" aria-label="${L('Duplicate section', 'Duplicar sección')}">⧉</button><button data-action="right" aria-label="${L('Move section right', 'Mover sección a la derecha')}" ${i === project.arrangement.length - 1 ? 'disabled' : ''}>→</button></div><em>${String(i + 1).padStart(2, '0')}</em></div></article>`).join('');
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
    $$('.scene').forEach(card => card.addEventListener('click', (event) => { if (event.target.closest('input,select,button,.drag-handle'))
        return; const index = +card.dataset.scene; if (event.shiftKey || event.ctrlKey || event.metaKey) {
        if (selectedScenes.has(index))
            selectedScenes.delete(index);
        else
            selectedScenes.add(index);
    }
    else {
        selectedScenes.clear();
        selectedScenes.add(index);
    } renderArrangement(); }));
    $('#arrangeTimeline').style.width = `${Math.max(100, project.editor.arrangeZoom * 100)}%`;
    $('#arrangeZoom').value = project.editor.arrangeZoom;
    $('#arrangeLoopEnabled').checked = project.loop.enabled;
    $('#arrangePunchEnabled').checked = project.loop.punch;
    $('#arrangeLoopStart').value = project.loop.start;
    $('#arrangeLoopEnd').value = project.loop.end;
    $('#arrangeMarkers').innerHTML = project.markers.map((marker) => `<button class="arrange-marker" style="--marker:${marker.color}" data-marker="${marker.id}">${esc(marker.name)} · ${formatLocator(marker.step)} ×</button>`).join('');
    $$('[data-marker]').forEach(button => button.onclick = () => { const marker = project.markers.find((item) => item.id === button.dataset.marker); if (!marker)
        return; if (confirm(L(`Remove marker “${marker.name}”?`, `¿Eliminar marcador “${marker.name}”?`))) {
        project.markers = project.markers.filter((item) => item.id !== marker.id);
        changed(true);
    }
    else
        setGlobalStart(marker.step); });
}
function sceneLength(scene) { return Math.max(...TRACKS.map(track => clipLengthSteps(project.clips.find((c) => c.id === scene.clipIds[track]) || activeClip(project, track)))); }
function focusScene(i) { setTimeout(() => document.querySelector(`.scene[data-scene="${i}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }), 0); }
function updatePlayheads() { const c = clip(), steps = clipLengthSteps(c), local = currentStep < 0 ? (clipStartSteps.get(c.id) || 0) : currentStep % steps; const p = $('.roll-playhead'), a = $('.automation-playhead'); if (p)
    p.style.left = `${local * project.editor.zoom}px`; if (a)
    a.style.left = `${local * project.editor.zoom}px`; $$('.scene').forEach((s, i) => s.classList.toggle('playing', engine.playing && engine.songMode && i === currentScene)); const global = $('.arrange-playhead'), duration = songLength(); if (global)
    global.style.left = `${duration ? transportPosition / duration * 100 : 0}%`; }
function updatePosition() { if (currentStep < 0) {
    $('#positionReadout').textContent = 'BAR 1 · STEP 1';
    return;
} const bar = meterSteps(project.meter); $('#positionReadout').textContent = `BAR ${Math.floor(currentStep / bar) + 1} · STEP ${currentStep % bar + 1}`; }
function updateOrb() { const macros = clip().character.macros, o = $('#performanceOrb'); o.style.transform = `scale(${.9 + macros.energy * .12})`; o.style.filter = `saturate(${.7 + macros.tension}) brightness(${.8 + macros.space * .35})`; }
function songLength() { return playbackEvents(project, { song: true }).durationSteps; }
function formatLocator(step) { const bar = meterSteps(project.meter), seconds = step * 60 / project.tempo / 4; return `${L('BAR', 'COMPÁS')} ${Math.floor(step / bar) + 1} · ${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
function setGlobalStart(value) { globalStartStep = Math.max(0, Math.min(Math.max(0, songLength() - 1), Math.round(value))); $('#globalPosition').value = globalStartStep; $('#globalPositionValue').textContent = formatLocator(globalStartStep); if (engine.playing && engine.songMode) {
    engine.seek(globalStartStep, true);
    transportPosition = globalStartStep;
    updatePlayheads();
} }
function setClipStart(value) { const c = clip(), length = clipLengthSteps(c), step = Math.max(0, Math.min(length - 1, Math.round(value))); clipStartSteps.set(c.id, step); $('#clipPosition').value = step; $('#clipPositionValue').textContent = `${L('BAR', 'COMPÁS')} ${Math.floor(step / meterSteps(project.meter)) + 1} · ${L('STEP', 'PASO')} ${step % meterSteps(project.meter) + 1}`; if (engine.playing && !engine.songMode) {
    engine.seek(step, false);
    currentStep = step;
    updatePlayheads();
} }
function renderLocators() { const length = songLength(), clipLength = clipLengthSteps(clip()); globalStartStep = Math.min(globalStartStep, Math.max(0, length - 1)); $('#globalPosition').max = Math.max(1, length - 1); $('#globalPosition').value = globalStartStep; $('#globalPositionValue').textContent = formatLocator(globalStartStep); const local = Math.min(clipStartSteps.get(clip().id) || 0, Math.max(0, clipLength - 1)); clipStartSteps.set(clip().id, local); $('#clipPosition').max = Math.max(1, clipLength - 1); $('#clipPosition').value = local; setClipStart(local); }
function syncLocatorsFromPlayback() { if (!engine.playing)
    return; if (engine.songMode) {
    $('#globalPosition').value = transportPosition;
    $('#globalPositionValue').textContent = formatLocator(transportPosition);
}
else {
    const step = Math.max(0, currentStep);
    $('#clipPosition').value = step;
    $('#clipPositionValue').textContent = `${L('BAR', 'COMPÁS')} ${Math.floor(step / meterSteps(project.meter)) + 1} · ${L('STEP', 'PASO')} ${step % meterSteps(project.meter) + 1}`;
} }
function renderMixer() { const root = $('#mixerChannels'); if (!root)
    return; root.innerHTML = TRACKS.map((track, index) => { const cfg = project.tracks[track], character = activeClip(project, track).character, meta = TRACK_META[track], db = gainToDb(cfg.volume); return `<article class="mixer-channel ${cfg.mute ? 'muted' : ''}" data-mix-track="${track}" style="--track:${cfg.color || meta.color}"><header><span>0${index + 1}</span><b>${meta.label}</b><input data-track-color type="color" value="${cfg.color || meta.color}" aria-label="${meta.label} color"></header><div class="mix-meter-pair"><canvas width="14" height="150" aria-label="${meta.label} left meter"></canvas><canvas width="14" height="150" aria-label="${meta.label} right meter"></canvas></div><label class="mix-fader"><span>FADER</span><input data-mix="faderDb" type="range" min="-60" max="6" step=".1" value="${db}" orient="vertical"><output>${db <= -60 ? "−∞" : `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`}</output></label><label data-precision><span>PRE GAIN</span><input data-mix="preGainDb" type="range" min="-24" max="12" step=".5" value="${cfg.preGainDb}"><output>${cfg.preGainDb > 0 ? '+' : ''}${cfg.preGainDb.toFixed(1)} dB</output></label><label data-precision><span>PAN</span><input data-mix="pan" type="range" min="-1" max="1" step=".01" value="${cfg.pan}"><output>${Math.round(cfg.pan * 100)}</output></label><label data-precision><span>DELAY</span><input data-mix="delay" type="range" min="0" max="1" step=".01" value="${character.fx.delay}"><output>${Math.round(character.fx.delay * 100)}</output></label><label data-precision><span>REVERB</span><input data-mix="reverb" type="range" min="0" max="1" step=".01" value="${character.fx.reverb}"><output>${Math.round(character.fx.reverb * 100)}</output></label><label data-precision><span>SENDS</span><select data-send-mode><option value="post" ${cfg.sendMode === 'post' ? 'selected' : ''}>POST</option><option value="pre" ${cfg.sendMode === 'pre' ? 'selected' : ''}>PRE</option></select><output class="mix-peak">${db.toFixed(1)} dB</output></label><div><button data-mix-solo aria-pressed="${cfg.solo}" class="${cfg.solo ? 'on' : ''}">S</button><button data-mix-mute aria-pressed="${cfg.mute}" class="${cfg.mute ? 'on' : ''}">M</button></div></article>`; }).join(''); $$('[data-mix-track]').forEach(channel => { const track = channel.dataset.mixTrack, cfg = project.tracks[track], character = activeClip(project, track).character; channel.querySelectorAll('[data-mix]').forEach((input) => { input.onpointerdown = snapshot; input.oninput = () => { const key = input.dataset.mix, value = +input.value; if (key === 'delay' || key === 'reverb')
    character.fx[key] = value;
else if (key === 'faderDb')
    cfg.volume = value <= -60 ? 0 : 10 ** (value / 20);
else
    cfg[key] = value; const output = input.closest('label').querySelector('output'); if (output)
    output.textContent = key === 'preGainDb' || key === 'faderDb' ? (value <= -60 ? '−∞' : (value > 0 ? '+' : '') + value.toFixed(1) + ' dB') : String(Math.round(value * 100)); engine.setProject(project); recordPerformanceEvent('mixer', `${track}:${key}`, value); }; input.onchange = () => changed(); }); channel.querySelector('[data-send-mode]').onchange = (event) => { cfg.sendMode = event.target.value; recordPerformanceEvent('mixer', `${track}:sendMode`, cfg.sendMode); changed(); }; channel.querySelector('[data-track-color]').oninput = (event) => { cfg.color = event.target.value; channel.style.setProperty('--track', cfg.color); }; channel.querySelector('[data-track-color]').onchange = () => changed(true); channel.querySelector('[data-mix-solo]').onclick = () => $(`[data-solo="${track}"]`)?.click(); channel.querySelector('[data-mix-mute]').onclick = () => $(`[data-mute="${track}"]`)?.click(); }); $('#mixerMaster').value = project.master; $('#mixerMasterValue').textContent = `${Math.round(project.master * 100)}%`; $('#masterBypassBtn').setAttribute('aria-pressed', String(project.masterSettings.bypass)); $('#masterBypassBtn').textContent = project.masterSettings.bypass ? 'FX BYPASSED' : 'MASTER FX'; }
function animateMixer() { if (activeView !== 'mix')
    return; let loudnessEnergy = 0; for (const channel of $$('[data-mix-track]')) {
    const track = channel.dataset.mixTrack, meter = engine.trackMeter(track), canvases = channel.querySelectorAll('canvas'), levels = [meter.left, meter.right];
    loudnessEnergy += meter.rms * meter.rms;
    mixerPeaks[track] = Math.max(meter.peak, (mixerPeaks[track] || 0) * .965);
    canvases.forEach((canvas, index) => { const level = levels[index] || 0, ctx = canvas.getContext('2d'), height = canvas.height; ctx.clearRect(0, 0, canvas.width, height); const gradient = ctx.createLinearGradient(0, height, 0, 0); gradient.addColorStop(0, '#2ee8ff'); gradient.addColorStop(.72, '#a7ff5b'); gradient.addColorStop(1, '#ff4e72'); ctx.fillStyle = gradient; ctx.fillRect(2, height * (1 - level), canvas.width - 4, height * level); ctx.fillStyle = '#ffcf67'; ctx.fillRect(1, height * (1 - (mixerPeaks[track] || 0)), canvas.width - 2, 2); });
    const peak = channel.querySelector('.mix-peak');
    if (peak)
        peak.textContent = mixerPeaks[track] <= .001 ? '−∞ dB' : `${(20 * Math.log10(mixerPeaks[track])).toFixed(1)} dB`;
} const loudness = Math.sqrt(loudnessEnergy / TRACKS.length); $('#mixerLoudness').textContent = loudness > .0001 ? `${(20 * Math.log10(loudness) - 9).toFixed(1)} LUFS-M APPROX` : '−∞ LUFS-M APPROX'; engine.draw($('#mixerMasterMeter')); requestAnimationFrame(animateMixer); }
function setScratchControls(enabled) { for (const id of ['scratchPlayBtn', 'scratchSyncBtn', 'scratchBrakeBtn', 'scratchSpinBtn', 'scratchStutterBtn', 'scratchFilter', 'scratchMix'])
    $(`#${id}`).disabled = !enabled; const platter = $('#scratchPlatter'); platter.classList.toggle('disabled', !enabled); platter.setAttribute('aria-disabled', String(!enabled)); $('.scratch-deck').classList.toggle('ready', enabled); }
function updateScratchPlayButton() { const button = $('#scratchPlayBtn'); button.textContent = engine.scratchPlaying ? L('■ STOP', '■ PARAR') : L('▶ PLAY', '▶ REPRODUCIR'); button.classList.toggle('active', Boolean(engine.scratchPlaying)); }
function drawScratchWaveform(buffer) { const canvas = $('#scratchWaveform'), ctx = canvas.getContext('2d'), width = canvas.width, height = canvas.height, data = buffer.getChannelData(0), stride = Math.max(1, Math.floor(data.length / width)); ctx.clearRect(0, 0, width, height); const gradient = ctx.createLinearGradient(0, 0, width, 0); gradient.addColorStop(0, '#2ee8ff'); gradient.addColorStop(.52, '#8b7cff'); gradient.addColorStop(1, '#ff3bd4'); ctx.strokeStyle = gradient; ctx.lineWidth = 1.5; ctx.beginPath(); for (let x = 0; x < width; x++) {
    let peak = 0;
    const start = x * stride;
    for (let i = 0; i < stride && start + i < data.length; i++)
        peak = Math.max(peak, Math.abs(data[start + i]));
    const size = Math.max(1, peak * (height * .45));
    ctx.moveTo(x, height / 2 - size);
    ctx.lineTo(x, height / 2 + size);
} ctx.stroke(); ctx.fillStyle = '#ffffff12'; ctx.fillRect(0, height / 2, width, 1); }
async function captureScratchMix() { const button = $('#scratchCaptureBtn'); if (button.disabled)
    return; button.disabled = true; button.classList.add('busy'); button.textContent = L('RENDERING…', 'RENDERIZANDO…'); $('#scratchStatus').textContent = L('FORGING A MASTERED PERFORMANCE BUFFER…', 'CREANDO EL BÚFER MASTERIZADO…'); try {
    const bars = Math.max(1, +$('#scratchBars').value), wav = await renderWav(project, { song: false });
    await engine.init();
    const decoded = await engine.ctx.decodeAudioData(await wav.arrayBuffer()), rate = engine.ctx.sampleRate, targetSeconds = bars * meterSteps(project.meter) * 60 / project.tempo / 4, targetFrames = Math.max(1, Math.round(targetSeconds * rate)), sourceSteps = Math.max(...TRACKS.map(track => clipLengthSteps(activeClip(project, track)))), sourceSeconds = sourceSteps * 60 / project.tempo / 4, sourceFrames = Math.max(1, Math.min(decoded.length, Math.round(sourceSeconds * decoded.sampleRate))), buffer = engine.ctx.createBuffer(2, targetFrames, rate);
    for (let channel = 0; channel < 2; channel++) {
        const source = decoded.getChannelData(Math.min(channel, decoded.numberOfChannels - 1)), target = buffer.getChannelData(channel);
        for (let i = 0; i < target.length; i++) {
            const sourcePosition = (i * decoded.sampleRate / rate) % sourceFrames, index = Math.floor(sourcePosition), next = (index + 1) % sourceFrames, mix = sourcePosition - index;
            target[i] = source[index] * (1 - mix) + source[next] * mix;
        }
    }
    scratchBuffer = buffer;
    drawScratchWaveform(buffer);
    await engine.loadScratchBuffer(buffer);
    engine.setScratchFilter(+$('#scratchFilter').value);
    engine.setScratchMix(+$('#scratchMix').value);
    setScratchControls(true);
    updateScratchPlayButton();
    $('#scratchStatus').textContent = L(`BUFFER ARMED · ${bars} BAR${bars === 1 ? '' : 'S'} · DRAG THE VINYL`, `BÚFER LISTO · ${bars} COMPÁS${bars === 1 ? '' : 'ES'} · ARRASTRA EL VINILO`);
    toast(L('SCRATCH BUFFER ARMED', 'BÚFER DE SCRATCH LISTO'));
}
catch (error) {
    $('#scratchStatus').textContent = `${L('CAPTURE FAILED', 'ERROR DE CAPTURA')}: ${error instanceof Error ? error.message : String(error)}`;
    toast(L('SCRATCH ENGINE UNAVAILABLE', 'MOTOR DE SCRATCH NO DISPONIBLE'));
}
finally {
    button.disabled = false;
    button.classList.remove('busy');
    button.textContent = L('CAPTURE MIX', 'CAPTURAR MEZCLA');
} }
function animateScratchDeck(now = performance.now()) { cancelAnimationFrame(scratchAnimation); const dt = Math.min(.05, (now - scratchLastFrame) / 1000); scratchLastFrame = now; if (scratchBuffer && engine.scratchPlaying && !$('.scratch-deck').classList.contains('scratching'))
    scratchAngle += Number(engine.scratchSpeed || 0) * 200 * dt; $('#scratchPlatter').style.setProperty('--rotation', `${scratchAngle}deg`); $('#scratchSpeed').textContent = `${Number(engine.scratchSpeed || 0) >= 0 ? '+' : ''}${Number(engine.scratchSpeed || 0).toFixed(2)}×`; if (scratchBuffer && engine.scratchFrames)
    $('#scratchWavePlayhead').style.left = `${Math.max(0, Math.min(100, (engine.scratchPosition || 0) / engine.scratchFrames * 100))}%`; scratchAnimation = requestAnimationFrame(animateScratchDeck); }
function setupScratchDeck() { setScratchControls(false); engine.onScratchPosition = (state) => { engine.scratchPosition = state.frame; engine.scratchSpeed = state.speed; engine.scratchPlaying = state.playing; }; $('#scratchCaptureBtn').onclick = captureScratchMix; $('#scratchPlayBtn').onclick = () => { engine.setScratchPlaying(!engine.scratchPlaying); updateScratchPlayButton(); }; $('#scratchSyncBtn').onclick = () => engine.syncScratch((engine.scratchSampleRate || 44100) * 60 / project.tempo * 4 / project.meter.unit); $('#scratchBrakeBtn').onclick = () => { engine.setScratchSpeed(0, 1.15); toast(L('MOTOR BRAKE', 'FRENO DE MOTOR')); }; $('#scratchSpinBtn').onclick = () => { engine.setScratchPlaying(true); engine.setScratchSpeed(-3.6, .035); engine.setScratchSpeed(0, 1.6); updateScratchPlayButton(); }; $('#scratchStutterBtn').onclick = () => { scratchStuttering = !scratchStuttering; const frames = scratchStuttering ? Math.round((engine.scratchSampleRate || 44100) * 60 / project.tempo / 2) : 0; engine.setScratchStutter(frames); $('#scratchStutterBtn').setAttribute('aria-pressed', String(scratchStuttering)); }; $('#scratchFilter').oninput = () => { const value = +$('#scratchFilter').value; engine.setScratchFilter(value); $('#scratchFilterValue').textContent = value > .96 ? 'OPEN' : `${Math.round(value * 100)}%`; }; $('#scratchMix').oninput = () => { const value = +$('#scratchMix').value; engine.setScratchMix(value); $('#scratchMixValue').textContent = `${L('DECK', 'PLATO')} ${Math.round(value * 100)}%`; }; const platter = $('#scratchPlatter'); let previousAngle = 0, previousTime = 0, dragging = false, rotation = 0; const angle = (event) => { const rect = platter.getBoundingClientRect(); return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)); }; platter.onpointerdown = (event) => { if (!scratchBuffer)
    return; event.preventDefault(); dragging = true; previousAngle = angle(event); previousTime = performance.now(); rotation = scratchAngle; try {
    platter.setPointerCapture(event.pointerId);
}
catch { } $('.scratch-deck').classList.add('scratching'); engine.setScratchPlaying(true); engine.setScratchSpeed(0, 0); updateScratchPlayButton(); }; platter.onpointermove = (event) => { if (!dragging)
    return; event.preventDefault(); const current = angle(event), time = performance.now(); let delta = current - previousAngle; if (delta > Math.PI)
    delta -= Math.PI * 2; if (delta < -Math.PI)
    delta += Math.PI * 2; rotation += delta * 180 / Math.PI; scratchAngle = rotation; const elapsed = Math.max(.008, (time - previousTime) / 1000), speed = Math.max(-6, Math.min(6, delta / (Math.PI * 2) / elapsed / (33.333 / 60))); engine.setScratchSpeed(speed, 0); previousAngle = current; previousTime = time; }; const release = (event) => { if (!dragging)
    return; dragging = false; try {
    platter.releasePointerCapture(event.pointerId);
}
catch { } $('.scratch-deck').classList.remove('scratching'); engine.setScratchSpeed(1, .14); }; platter.onpointerup = release; platter.onpointercancel = release; platter.onwheel = (event) => { if (!scratchBuffer)
    return; event.preventDefault(); engine.setScratchPlaying(true); engine.setScratchSpeed(Math.max(-4, Math.min(4, -event.deltaY * .018)), .01); clearTimeout(engine.scratchReturnTimer); engine.scratchReturnTimer = setTimeout(() => engine.setScratchSpeed(1, .12), 90); }; platter.onkeydown = (event) => { if (!scratchBuffer)
    return; if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    engine.setScratchPlaying(true);
    engine.setScratchSpeed(event.key === 'ArrowLeft' ? -1.8 : 1.8, .01);
}
else if (event.key === 'Enter') {
    event.preventDefault();
    $('#scratchPlayBtn').click();
} }; platter.onkeyup = (event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    engine.setScratchSpeed(1, .1); }; animateScratchDeck(); }
const performanceEventThrottle = new Map();
function performanceStep() { return Math.max(0, (Date.now() - performanceStarted) / 1000 / (60 / project.tempo / 4)); }
function recordPerformanceEvent(kind, target, value) { if (!performanceEvents)
    return; const step = performanceStep(), key = `${kind}:${target}`, last = performanceEventThrottle.get(key) ?? -1; if (step - last < .12)
    return; performanceEventThrottle.set(key, step); performanceEvents.push({ id: crypto.randomUUID(), step, kind, target, value }); }
async function loadPerformanceAudio(take) { if (!take.audioAssetId)
    return null; return getAsset(take.audioAssetId); }
function applyPerformanceEvent(event) { if (event.kind === 'macro') {
    const [clipId, key] = event.target.split(':'), target = project.clips.find((item) => item.id === clipId);
    if (target && key)
        target.character.macros[key] = +event.value;
}
else if (event.kind === 'mixer') {
    if (event.target === 'master:volume') {
        project.master = +event.value;
        engine.setProject(project);
        return;
    }
    if (event.target === 'master:bypass') {
        project.masterSettings.bypass = Boolean(event.value);
        engine.setProject(project);
        return;
    }
    const [track, key] = event.target.split(':'), cfg = project.tracks[track];
    if (!cfg || !key)
        return;
    if (key === 'solo') {
        TRACKS.forEach(id => project.tracks[id].solo = false);
        cfg.solo = Boolean(event.value);
    }
    else if (key === 'faderDb')
        cfg.volume = +event.value <= -60 ? 0 : 10 ** (+event.value / 20);
    else if (key === 'delay' || key === 'reverb')
        activeClip(project, track).character.fx[key] = +event.value;
    else
        cfg[key] = event.value;
}
else if (event.kind === 'scratch') {
    if (event.target === 'speed')
        engine.setScratchSpeed(+event.value, .01);
    if (event.target === 'mix')
        engine.setScratchMix(+event.value);
    if (event.target === 'filter')
        engine.setScratchFilter(+event.value);
    if (event.target === 'stutter')
        engine.setScratchStutter(event.value ? Math.round((engine.scratchSampleRate || 44100) * 60 / project.tempo / 2) : 0);
    if (event.target === 'playing')
        engine.setScratchPlaying(Boolean(event.value));
}
else if (event.kind === 'launcher') {
    const track = event.target;
    if (event.value === 'stop')
        engine.stopLauncherTrack(track, true);
    else if (typeof event.value === 'string')
        engine.queueClip(track, event.value, 1);
} engine.setProject(project); }
async function playPerformanceTake(take) { const blob = await loadPerformanceAudio(take); if (!blob) {
    toast(L('TAKE AUDIO IS MISSING ON THIS DEVICE', 'FALTA EL AUDIO DE LA TOMA EN ESTE DISPOSITIVO'));
    return;
} const audio = new Audio(URL.createObjectURL(blob)), secondsPerTakeStep = 60 / project.tempo / 4, timers = []; audio.currentTime = Math.max(0, take.trimStart * secondsPerTakeStep); for (const event of take.events.filter(item => item.step >= take.trimStart && item.step <= take.trimEnd))
    timers.push(window.setTimeout(() => { applyPerformanceEvent(event); if (activeView === 'perform')
        renderPerformanceTakes(); if (activeView === 'mix')
        renderMixer(); }, Math.max(0, (event.step - take.trimStart) * secondsPerTakeStep * 1000))); await audio.play(); window.setTimeout(() => { audio.pause(); timers.forEach(timer => clearTimeout(timer)); URL.revokeObjectURL(audio.src); }, Math.max(100, (take.trimEnd - take.trimStart) * secondsPerTakeStep * 1000)); }
function openTakeEditor(take) { activePerformanceTakeId = take.id; $('#takeEditorTitle').textContent = take.name; $('#takeTrimStart').value = take.trimStart; $('#takeTrimEnd').value = take.trimEnd; const renderEvents = () => { $('#takeEventList').innerHTML = take.events.filter(event => event.step >= take.trimStart && event.step <= take.trimEnd).map(event => `<div class="take-event" data-take-event="${event.id}"><code>${event.kind.toUpperCase()}</code><input data-event-step type="number" min="0" max="${take.durationSteps}" step=".25" value="${event.step.toFixed(3)}"><span>${esc(event.target)}</span><input data-event-value value="${esc(String(event.value))}" aria-label="Event value"><button data-event-delete>×</button></div>`).join('') || `<p class="launcher-status">${L('NO EVENTS INSIDE THE CURRENT TRIM', 'NO HAY EVENTOS DENTRO DEL RECORTE')}</p>`; $$('[data-take-event]').forEach(row => { const event = take.events.find(item => item.id === row.dataset.takeEvent); row.querySelector('[data-event-step]').onchange = (input) => { event.step = Math.max(0, Math.min(take.durationSteps, +input.target.value)); take.events.sort((a, b) => a.step - b.step); changed(); renderEvents(); }; row.querySelector('[data-event-value]').onchange = (input) => { const raw = input.target.value; event.value = event.value === true || event.value === false ? raw === 'true' : typeof event.value === 'number' ? (Number.isFinite(+raw) ? +raw : event.value) : raw; changed(); }; row.querySelector('[data-event-delete]').onclick = () => { take.events = take.events.filter(item => item.id !== event.id); changed(); renderEvents(); }; }); }; const trim = () => { take.trimStart = Math.max(0, Math.min(take.durationSteps - .25, +$('#takeTrimStart').value || 0)); take.trimEnd = Math.max(take.trimStart + .25, Math.min(take.durationSteps, +$('#takeTrimEnd').value || take.durationSteps)); changed(); renderEvents(); }; $('#takeTrimStart').onchange = trim; $('#takeTrimEnd').onchange = trim; $('#takeQuantizeBtn').onclick = () => { quantizePerformanceTake(take, project.editor.snap); changed(); renderEvents(); }; renderEvents(); open('#takeEditorDialog'); }
function renderPerformanceTakes() { const root = $('#performanceTakes'); if (!root)
    return; root.innerHTML = project.performanceTakes.length ? project.performanceTakes.map((take) => `<article class="performance-take ${take.id === activePerformanceTakeId ? 'active' : ''}" data-take="${take.id}"><span><b>${esc(take.name)}</b><small>${take.events.length} EVENTS · ${take.trimStart.toFixed(1)}–${take.trimEnd.toFixed(1)} STEPS</small></span><button data-take-play>▶</button><button data-take-edit>EDIT</button><button data-take-export>EXPORT</button><button data-take-delete>×</button></article>`).join('') : `<p class="launcher-status">${L('NO SAVED TAKES · RECORDING STORES AUDIO AND EDITABLE CONTROL EVENTS LOCALLY', 'SIN TOMAS · LA GRABACIÓN GUARDA AUDIO Y EVENTOS EDITABLES EN LOCAL')}</p>`; $$('[data-take]').forEach(card => { const take = project.performanceTakes.find((item) => item.id === card.dataset.take); card.querySelector('[data-take-play]').onclick = () => playPerformanceTake(take); card.querySelector('[data-take-edit]').onclick = () => openTakeEditor(take); card.querySelector('[data-take-export]').onclick = async () => { activePerformanceTakeId = take.id; performanceTake = await loadPerformanceAudio(take); performExport('performance', true); }; card.querySelector('[data-take-delete]').onclick = async () => { if (!confirm(L(`Delete “${take.name}”?`, `¿Borrar “${take.name}”?`)))
    return; project.performanceTakes = project.performanceTakes.filter((item) => item.id !== take.id); if (take.audioAssetId)
    await deleteAsset(take.audioAssetId); changed(); renderPerformanceTakes(); }; }); }
async function togglePerformanceCapture() { const button = $('#performanceRecordBtn'); if (engine.performanceRecorder?.state === 'recording') {
    try {
        performanceTake = await engine.stopPerformanceCapture();
        if (performanceTimer)
            clearInterval(performanceTimer);
        performanceTimer = null;
        const durationSteps = Math.max(1, performanceStep()), take = createPerformanceTake(`${L('Live take', 'Toma en directo')} ${project.performanceTakes.length + 1}`, durationSteps, performanceEvents || []), assetId = `take-${take.id}`;
        take.audioAssetId = assetId;
        take.mimeType = performanceTake.type;
        await putAsset(assetId, performanceTake);
        project.performanceTakes.push(take);
        activePerformanceTakeId = take.id;
        performanceEvents = null;
        changed();
        renderPerformanceTakes();
        button.textContent = L('● RECORD TAKE', '● GRABAR TOMA');
        button.classList.remove('active');
        $('#performanceSaveBtn').disabled = false;
        toast(L('PERFORMANCE TAKE STORED WITH EDITABLE EVENTS', 'TOMA GUARDADA CON EVENTOS EDITABLES'));
    }
    catch (error) {
        toast(error instanceof Error ? error.message : String(error));
    }
    return;
} try {
    performanceTake = null;
    performanceEvents = [];
    performanceEventThrottle.clear();
    $('#performanceSaveBtn').disabled = true;
    await engine.startPerformanceCapture();
    performanceStarted = Date.now();
    button.textContent = L('■ STOP TAKE', '■ PARAR TOMA');
    button.classList.add('active');
    performanceTimer = setInterval(() => { const elapsed = Math.floor((Date.now() - performanceStarted) / 1000); $('#performanceRecordTime').textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`; }, 250);
    toast(L('PERFORMANCE CAPTURE ACTIVE', 'CAPTURA DE INTERPRETACIÓN ACTIVA'));
}
catch (error) {
    performanceEvents = null;
    toast(`${L('CAPTURE UNAVAILABLE', 'CAPTURA NO DISPONIBLE')}: ${error instanceof Error ? error.message : String(error)}`);
} }
function mixSnapshot() { const tracks = Object.fromEntries(TRACKS.map(track => [track, { volume: project.tracks[track].volume, pan: project.tracks[track].pan, preGainDb: project.tracks[track].preGainDb }])), loudness = Math.sqrt(TRACKS.reduce((sum, track) => sum + (project.tracks[track].volume * 10 ** (project.tracks[track].preGainDb / 20)) ** 2, 0)); return { tracks, master: project.master, loudness }; }
function captureMixerReference() { mixerReference = mixSnapshot(); mixerComparing = false; $('#mixCompareBtn').disabled = false; $('#mixCompareBtn').setAttribute('aria-pressed', 'false'); toast(L('MIX A CAPTURED · LOUDNESS MATCH READY', 'MEZCLA A CAPTURADA · NIVEL COMPENSADO LISTO')); }
function toggleMixerReference() { if (!mixerReference)
    return; if (!mixerReference.current)
    mixerReference.current = mixSnapshot(); mixerComparing = !mixerComparing; const source = mixerComparing ? mixerReference : mixerReference.current, target = mixerComparing ? mixerReference.current : mixerReference, compensation = Math.max(.5, Math.min(2, (target.loudness || 1) / (source.loudness || 1))); for (const track of TRACKS)
    Object.assign(project.tracks[track], source.tracks[track]); project.master = Math.max(0, Math.min(1, source.master * compensation)); engine.setProject(project); renderMixer(); renderTracks(); $('#mixCompareBtn').setAttribute('aria-pressed', String(mixerComparing)); $('#mixCompareBtn').textContent = mixerComparing ? L('LISTENING A · MATCHED', 'ESCUCHANDO A · IGUALADO') : L('COMPARE B', 'COMPARAR B'); }
function setupArrangeTools() { $('#arrangeSelectAllBtn').onclick = () => { selectedScenes = new Set(project.arrangement.map((_scene, index) => index)); renderArrangement(); }; $('#arrangeDuplicateBtn').onclick = () => { if (!selectedScenes.size)
    return; snapshot(); const copies = duplicateArrangementSelection(project, [...selectedScenes]); selectedScenes = new Set(copies.map((_copy, index) => project.arrangement.length - copies.length + index)); changed(true); }; $('#arrangeCopyBtn').onclick = () => { sceneClipboard = [...selectedScenes].sort((a, b) => a - b).map(index => structuredClone(project.arrangement[index])); toast(`${sceneClipboard.length} ${L('SECTIONS COPIED', 'SECCIONES COPIADAS')}`); }; $('#arrangePasteBtn').onclick = () => { if (!sceneClipboard.length)
    return; snapshot(); const at = selectedScenes.size ? Math.max(...selectedScenes) + 1 : project.arrangement.length, copies = sceneClipboard.map(scene => ({ ...structuredClone(scene), id: crypto.randomUUID(), name: `${scene.name} COPY` })); project.arrangement.splice(at, 0, ...copies); selectedScenes = new Set(copies.map((_copy, index) => at + index)); changed(true); }; $('#arrangeDeleteBtn').onclick = () => { if (!selectedScenes.size)
    return; snapshot(); if (!removeArrangementSelection(project, [...selectedScenes])) {
    toast(L('THE SONG MUST KEEP ONE SECTION', 'LA CANCIÓN DEBE CONSERVAR UNA SECCIÓN'));
    return;
} selectedScenes.clear(); changed(true); }; $('#arrangeFillBtn').onclick = () => { snapshot(); const at = selectedScenes.size ? Math.max(...selectedScenes) + 1 : project.arrangement.length, source = project.arrangement[Math.max(0, at - 1)] || project.arrangement[0], drum = createClip('drums', 'IMPACT FILL', 1, meterSteps(project.meter)); generateClip(project, drum, 'drums', 1); drum.notes.push(makeNote(Math.max(0, drum.stepsPerBar - 2), 6, 1, 1)); project.clips.push(drum); project.arrangement.splice(at, 0, { id: crypto.randomUUID(), name: 'IMPACT FILL', clipIds: { ...source.clipIds, drums: drum.id }, repeats: 1 }); selectedScenes = new Set([at]); changed(true); }; $('#arrangeMarkerBtn').onclick = () => { const name = prompt(L('Marker name', 'Nombre del marcador'), `MARK ${project.markers.length + 1}`); if (!name?.trim())
    return; snapshot(); project.markers.push({ id: crypto.randomUUID(), name: name.trim(), step: globalStartStep, color: ['#2ee8ff', '#ff3bd4', '#a7ff5b', '#ff9f43'][project.markers.length % 4] }); project.markers.sort((a, b) => a.step - b.step); changed(true); }; $('#arrangeZoom').oninput = () => { project.editor.arrangeZoom = +$('#arrangeZoom').value; renderArrangement(); }; $('#arrangeZoom').onchange = () => changed(); $('#arrangeLoopEnabled').onchange = () => { project.loop.enabled = $('#arrangeLoopEnabled').checked; changed(); }; $('#arrangePunchEnabled').onchange = () => { project.loop.punch = $('#arrangePunchEnabled').checked; changed(); }; const loopChange = () => { project.loop.start = Math.max(0, +$('#arrangeLoopStart').value || 0); project.loop.end = Math.max(project.loop.start + 1, +$('#arrangeLoopEnd').value || 1); changed(); }; $('#arrangeLoopStart').onchange = loopChange; $('#arrangeLoopEnd').onchange = loopChange; }
const USER_PRESETS = 'kiber-vengance-user-presets-v1', PRESET_FAVORITES = 'kiber-vengance-preset-favorites-v1';
function userPresets() { try {
    return JSON.parse(localStorage.getItem(USER_PRESETS) || '[]');
}
catch {
    return [];
} }
function saveUserPresets(items) { localStorage.setItem(USER_PRESETS, JSON.stringify(items)); }
function presetFavorites() { try {
    return new Set(JSON.parse(localStorage.getItem(PRESET_FAVORITES) || '[]'));
}
catch {
    return new Set();
} }
function renderPresetLibrary() { const query = String($('#presetSearch').value || '').toLowerCase(), favorites = presetFavorites(), builtins = TRACKS.flatMap(track => presets[track].map(name => ({ id: `builtin:${track}:${name}`, name, track, tags: ['factory', track] }))), users = userPresets(), items = [...builtins, ...users].filter(item => `${item.name} ${item.track} ${item.tags.join(' ')}`.toLowerCase().includes(query)); $('#presetLibrary').innerHTML = items.map(item => `<article class="preset-card" data-preset-id="${esc(item.id)}"><span><b>${esc(item.name)}</b><small>${item.track.toUpperCase()} · ${item.tags.map(tag => tag.toUpperCase()).join(' · ')}</small></span><button class="favorite" data-preset-favorite aria-pressed="${favorites.has(item.id)}">${favorites.has(item.id) ? '★' : '☆'}</button><button data-preset-load>LOAD</button>${item.id.startsWith('builtin:') ? '' : '<button data-preset-delete>×</button>'}</article>`).join(''); $$('[data-preset-id]').forEach(card => { const item = items.find(candidate => candidate.id === card.dataset.presetId); card.querySelector('[data-preset-load]').onclick = () => { snapshot(); selectedTrack = item.track; if (item.id.startsWith('builtin:'))
    applyPreset(item.track, item.name);
else {
    Object.assign(project.tracks[item.track], structuredClone(item.instrument));
    activeClip(project, item.track).character = structuredClone(item.character);
} changed(true); $('#presetDialog').close(); toast(L('PRESET LOADED', 'PRESET CARGADO')); }; card.querySelector('[data-preset-favorite]').onclick = () => { const next = presetFavorites(); if (next.has(item.id))
    next.delete(item.id);
else
    next.add(item.id); localStorage.setItem(PRESET_FAVORITES, JSON.stringify([...next])); renderPresetLibrary(); }; const remove = card.querySelector('[data-preset-delete]'); if (remove)
    remove.onclick = () => { saveUserPresets(userPresets().filter(candidate => candidate.id !== item.id)); renderPresetLibrary(); }; }); }
function saveCurrentPreset() { const name = prompt(L('Preset name', 'Nombre del preset'), `${TRACK_META[selectedTrack].label} CUSTOM`); if (!name?.trim())
    return; const tags = (prompt(L('Tags separated by commas', 'Etiquetas separadas por comas'), 'custom, cinematic') || 'custom').split(',').map(tag => tag.trim()).filter(Boolean), items = userPresets(); items.push({ id: crypto.randomUUID(), name: name.trim(), track: selectedTrack, tags, instrument: structuredClone(project.tracks[selectedTrack]), character: structuredClone(clip().character) }); saveUserPresets(items); renderPresetLibrary(); }
async function loadLocalSample(asset) { const blob = await getAsset(asset.id); if (!blob) {
    toast(`${DRUM_NAMES[asset.slot]} · ${L('SAMPLE FILE MISSING', 'ARCHIVO DE SAMPLE AUSENTE')}`);
    return;
} await engine.setDrumSample(asset.slot, await blob.arrayBuffer(), asset); }
async function loadLocalSamples() { for (const asset of project.samples)
    try {
        await loadLocalSample(asset);
    }
    catch { } }
function renderSampleSlots() { $('#sampleSlots').innerHTML = DRUM_NAMES.map((name, slot) => { const asset = project.samples.find((item) => item.slot === slot); return `<article class="sample-slot" data-sample-slot="${slot}"><b>${name}</b><label class="file-button">${asset ? esc(asset.name) : 'LOAD WAV/MP3'}<input data-sample-file type="file" accept="audio/*"></label><label>START<input data-sample-setting="trimStart" type="range" min="0" max=".95" step=".01" value="${asset?.trimStart ?? 0}"></label><label>END<input data-sample-setting="trimEnd" type="range" min=".05" max="1" step=".01" value="${asset?.trimEnd ?? 1}"></label><label>TUNE<input data-sample-setting="tune" type="number" min="-24" max="24" step="1" value="${asset?.tune ?? 0}"></label><label>ATTACK<input data-sample-setting="attack" type="number" min="0" max="1" step=".001" value="${asset?.attack ?? .002}"></label><label>RELEASE<input data-sample-setting="release" type="number" min=".005" max="3" step=".005" value="${asset?.release ?? .08}"></label><label>REVERSE<input data-sample-setting="reverse" type="checkbox" ${asset?.reverse ? 'checked' : ''}></label><button data-sample-remove ${asset ? '' : 'disabled'}>×</button></article>`; }).join(''); $$('[data-sample-slot]').forEach(row => { const slot = +row.dataset.sampleSlot, file = row.querySelector('[data-sample-file]'); file.onchange = async () => { const blob = file.files?.[0]; if (!blob)
    return; const old = project.samples.find((item) => item.slot === slot); if (old)
    await deleteAsset(old.id); const asset = { id: `sample-${crypto.randomUUID()}`, name: blob.name, slot, size: blob.size, type: blob.type || 'audio/wav', trimStart: 0, trimEnd: 1, tune: 0, attack: .002, release: .08, reverse: false }; await putAsset(asset.id, blob); project.samples = project.samples.filter((item) => item.slot !== slot); project.samples.push(asset); await loadLocalSample(asset); changed(); renderSampleSlots(); toast(`${DRUM_NAMES[slot]} · ${L('SAMPLE READY', 'SAMPLE LISTO')}`); }; row.querySelectorAll('[data-sample-setting]').forEach((input) => input.onchange = async () => { const asset = project.samples.find((item) => item.slot === slot); if (!asset)
    return; const key = input.dataset.sampleSetting; asset[key] = input.type === 'checkbox' ? input.checked : +input.value; if (asset.trimEnd <= asset.trimStart)
    asset.trimEnd = Math.min(1, asset.trimStart + .05); await loadLocalSample(asset); changed(); renderSampleSlots(); }); row.querySelector('[data-sample-remove]').onclick = async () => { const asset = project.samples.find((item) => item.slot === slot); if (!asset)
    return; await deleteAsset(asset.id); project.samples = project.samples.filter((item) => item.id !== asset.id); engine.clearDrumSample(slot); changed(); renderSampleSlots(); }; }); }
function setupLibraries() { $('#presetLibraryBtn').onclick = () => { $('#projectMenu').close(); renderPresetLibrary(); open('#presetDialog'); }; $('#sampleLibraryBtn').onclick = () => { $('#projectMenu').close(); renderSampleSlots(); open('#sampleDialog'); }; $('#presetSearch').oninput = renderPresetLibrary; $('#saveUserPresetBtn').onclick = saveCurrentPreset; $('#exportPresetBankBtn').onclick = () => download(JSON.stringify({ format: 'kiber-vengance-preset-bank', version: 1, presets: userPresets() }, null, 2), 'kiber-vengance-presets.json', 'application/json'); $('#importPresetBank').onchange = async (event) => { try {
    const data = JSON.parse(await event.target.files[0].text());
    if (data.format !== 'kiber-vengance-preset-bank' || !Array.isArray(data.presets))
        throw new Error('Invalid preset bank');
    saveUserPresets([...userPresets(), ...data.presets]);
    renderPresetLibrary();
    toast(L('PRESET BANK IMPORTED', 'BANCO DE PRESETS IMPORTADO'));
}
catch (error) {
    toast(error instanceof Error ? error.message : String(error));
} }; $('#compactModeBtn').onclick = () => { document.body.classList.toggle('compact-mode'); $('#compactModeBtn').setAttribute('aria-pressed', String(document.body.classList.contains('compact-mode'))); writeUiPrefs(); }; }
function setupPrecisionControls() { $('#masterBypassBtn').onclick = () => { snapshot(); project.masterSettings.bypass = !project.masterSettings.bypass; engine.setProject(project); recordPerformanceEvent('mixer', 'master:bypass', project.masterSettings.bypass); changed(); renderMixer(); }; $('#cancelExportBtn').onclick = () => exportController?.abort(); }
function setupStudioExtensions() { $('#globalPosition').oninput = () => setGlobalStart(+$('#globalPosition').value); $('#clipPosition').oninput = () => setClipStart(+$('#clipPosition').value); $('#globalZeroBtn').onclick = () => setGlobalStart(0); $('#clipZeroBtn').onclick = () => setClipStart(0); $('#globalStartBtn').onclick = () => { if (engine.playing)
    engine.stop(); activateView('arrange'); togglePlay(true); }; $('#clipStartBtn').onclick = () => { if (engine.playing)
    engine.stop(); activateView('forge'); togglePlay(false); }; $('#performanceRecordBtn').onclick = togglePerformanceCapture; $('#performanceSaveBtn').onclick = () => performExport('performance', true); $('#mixCaptureBtn').onclick = captureMixerReference; $('#mixCompareBtn').onclick = toggleMixerReference; $('#mixerMaster').onpointerdown = snapshot; $('#mixerMaster').oninput = () => { project.master = +$('#mixerMaster').value; recordPerformanceEvent('mixer', 'master:volume', project.master); $('#mixerMasterValue').textContent = `${Math.round(project.master * 100)}%`; $('#masterVolume').value = project.master; $('#masterValue').textContent = Math.round(project.master * 100); engine.setProject(project); }; $('#mixerMaster').onchange = () => changed(); $('#forgetTargetsBtn').onclick = async () => { for (const kind of [...quickHandles.keys()])
    await forgetExportTarget(kind); toast(L('EXPORT DESTINATIONS FORGOTTEN', 'DESTINOS DE EXPORTACIÓN OLVIDADOS')); }; $$('[data-export]').forEach(button => button.onclick = () => performExport(button.dataset.export, false)); $$('[data-export-as]').forEach(button => button.onclick = () => performExport(button.dataset.exportAs, true)); }
function readUiPrefs() { try {
    return { focus: false, collapsed: [], compact: false, ...JSON.parse(localStorage.getItem(UI_STORAGE) || '{}') };
}
catch {
    return { focus: false, collapsed: [], compact: false };
} }
function writeUiPrefs() { localStorage.setItem(UI_STORAGE, JSON.stringify({ focus: document.body.classList.contains('focus-mode'), collapsed: $$('.collapsible-rack.collapsed').map(x => x.id), compact: document.body.classList.contains('compact-mode') })); }
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
    { label: 'Open Clip Launcher', labelEs: 'Abrir Lanzador de clips', group: 'VIEW', groupEs: 'VISTA', shortcut: 'SHIFT L', icon: 'L', keywords: 'launch launcher clips grid live lanzar matriz', run: () => activateView('launch') },
    { label: 'Open Mix Console', labelEs: 'Abrir mesa de mezcla', group: 'VIEW', groupEs: 'VISTA', shortcut: 'SHIFT X', icon: 'X', keywords: 'mix mixer mezcla console fader', run: () => activateView('mix') },
    { label: 'Open Perform', labelEs: 'Abrir Interpretación', group: 'VIEW', groupEs: 'VISTA', shortcut: 'SHIFT P', icon: 'P', keywords: 'perform interpretar live macros', run: () => activateView('perform') },
    { label: 'Toggle Focus mode', labelEs: 'Activar modo Foco', group: 'VIEW', groupEs: 'VISTA', shortcut: 'SHIFT F', icon: '⌖', keywords: 'focus foco collapse fast editor', run: () => toggleFocus() },
    { label: 'New independent clip', labelEs: 'Nuevo clip independiente', group: 'CLIP', groupEs: 'CLIP', shortcut: 'SHIFT N', icon: '＋', keywords: 'new nuevo clip create', run: () => $('#newClipBtn').click() },
    { label: 'Duplicate active clip', labelEs: 'Duplicar clip activo', group: 'CLIP', groupEs: 'CLIP', shortcut: 'SHIFT D', icon: '⧉', keywords: 'duplicate duplicar copy clip', run: () => $('#duplicateBtn').click() },
    { label: 'Delete active clip', labelEs: 'Borrar clip activo', group: 'CLIP', groupEs: 'CLIP', shortcut: '', icon: '⌫', keywords: 'delete remove borrar eliminar clip', run: () => $('#deleteClipBtn').click() },
    { label: 'Mutate active clip', labelEs: 'Mutar clip activo', group: 'CLIP', groupEs: 'CLIP', shortcut: 'SHIFT V', icon: '⌁', keywords: 'mutate mutar variation clip', run: () => $('#mutateBtn').click() },
    { label: 'Quantize active clip', labelEs: 'Cuantizar clip activo', group: 'CLIP', groupEs: 'CLIP', shortcut: 'SHIFT Q', icon: '▦', keywords: 'quantize cuantizar snap notes', run: () => $('#quantizeBtn').click() },
    { label: 'Add arrangement section', labelEs: 'Añadir sección al arreglo', group: 'SONG', groupEs: 'CANCIÓN', shortcut: '', icon: '＋', keywords: 'section sección scene arrangement arreglo', run: () => { activateView('arrange'); $('#addSceneBtn').click(); } },
    { label: 'Export to current destination', labelEs: 'Exportar al destino actual', group: 'PROJECT', groupEs: 'PROYECTO', shortcut: 'CTRL E', icon: '⇧', keywords: 'export save current destino actual wav midi', run: repeatLastExport },
    { label: 'Export As…', labelEs: 'Exportar como…', group: 'PROJECT', groupEs: 'PROYECTO', shortcut: 'CTRL SHIFT E', icon: '…', keywords: 'export as save choose elegir formato destino', run: () => open('#exportDialog') },
    { label: 'Export song WAV', labelEs: 'Exportar canción WAV', group: 'PROJECT', groupEs: 'PROYECTO', shortcut: '', icon: 'W', keywords: 'export wav render audio canción', run: () => quickExportWav(false) },
    { label: 'Export song MIDI', labelEs: 'Exportar canción MIDI', group: 'PROJECT', groupEs: 'PROYECTO', shortcut: '', icon: 'M', keywords: 'export midi canción', run: () => quickExportMidi(false) },
    { label: 'Export project as JSON', labelEs: 'Exportar proyecto como JSON', group: 'PROJECT', groupEs: 'PROYECTO', shortcut: '', icon: 'J', keywords: 'export project json backup proyecto copia', run: () => quickExportProject(true) },
    { label: 'Project, versions & recovery', labelEs: 'Proyecto, versiones y recuperación', group: 'PROJECT', groupEs: 'PROYECTO', shortcut: '', icon: '••', keywords: 'project proyecto save import snapshot', run: () => $('#menuBtn').click() },
    ...TRACKS.map((track, index) => ({ label: `Select ${TRACK_META[track].label}`, labelEs: `Seleccionar ${TRACK_META[track].label}`, group: 'TRACK', groupEs: 'PISTA', shortcut: String(index + 1), icon: String(index + 1), keywords: `track pista ${track} instrument instrumento`, run: () => selectTrack(track) }))
];
function matchingCommands(query) { const needle = query.trim().toLowerCase(); return commands.filter(command => !needle || `${command.label} ${command.labelEs} ${command.group} ${command.groupEs} ${command.keywords}`.toLowerCase().includes(needle)); }
function renderCommands(query = '') { const list = matchingCommands(query); commandIndex = Math.max(0, Math.min(commandIndex, list.length - 1)); $('#commandResults').innerHTML = list.length ? list.map((command, index) => `<button class="command-item ${index === commandIndex ? 'active' : ''}" data-command="${commands.indexOf(command)}" role="option" aria-selected="${index === commandIndex}"><span><i>${command.icon}</i><b>${esc(L(command.label, command.labelEs))}</b></span><kbd>${L(command.group, command.groupEs)}${command.shortcut ? ` · ${command.shortcut}` : ''}</kbd></button>`).join('') : `<div class="command-empty">${L('NO MATCHING SIGNAL', 'SIN RESULTADOS')}</div>`; $$('.command-item').forEach(item => { item.onmouseenter = () => { commandIndex = list.indexOf(commands[+item.dataset.command]); renderCommands($('#commandSearch').value); }; item.onclick = () => runCommand(commands[+item.dataset.command]); }); }
function runCommand(command) { if (!command)
    return; $('#commandDialog').close(); command.run(); }
function openCommands() { commandIndex = 0; $('#commandSearch').value = ''; renderCommands(); $('#commandDialog').showModal(); setTimeout(() => $('#commandSearch').focus(), 0); }
function initWorkflowUi() { const stored = localStorage.getItem(UI_STORAGE), prefs = readUiPrefs(), defaults = !stored && window.matchMedia('(max-width:760px)').matches ? ['motionRack', 'effectsRack', 'macroRack'] : []; for (const id of new Set([...defaults, ...prefs.collapsed]))
    setRackCollapsed(id, true, false); toggleFocus(prefs.focus, true); document.body.classList.toggle('compact-mode', prefs.compact); $('#compactModeBtn')?.setAttribute('aria-pressed', String(prefs.compact)); $('#commandBtn').onclick = openCommands; $('#focusBtn').onclick = () => toggleFocus(); $$('.rack-toggle').forEach(button => button.onclick = () => setRackCollapsed(button.dataset.rack, !$(`#${button.dataset.rack}`).classList.contains('collapsed'))); $('#commandSearch').oninput = () => { commandIndex = 0; renderCommands($('#commandSearch').value); }; $('#commandSearch').onkeydown = (event) => { const list = matchingCommands($('#commandSearch').value); if (event.key === 'ArrowDown') {
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
let inputRecorder = null, inputStream = null, inputChunks = [], midiLearnTarget = null;
function applyMidiMapping(mapping, normalized) { const value = mapping.min + (mapping.max - mapping.min) * normalized; if (mapping.target === 'master.volume')
    project.master = Math.max(0, Math.min(1, value));
else {
    const match = /^track\.([^.]+)\.(volume|pan|cutoff)$/.exec(mapping.target);
    if (match && TRACKS.includes(match[1]))
        project.tracks[match[1]][match[2]] = match[2] === 'cutoff' ? 120 + value * 11880 : match[2] === 'pan' ? value * 2 - 1 : value;
} engine.setProject(project); renderMixer(); renderMixGroups(); }
function audioBufferWav(buffer) { const channels = Math.min(2, buffer.numberOfChannels), frames = buffer.length, bytes = 44 + frames * channels * 2, array = new ArrayBuffer(bytes), view = new DataView(array), write = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0))); write(0, 'RIFF'); view.setUint32(4, bytes - 8, true); write(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, frames * channels * 2, true); let offset = 44; for (let frame = 0; frame < frames; frame++)
    for (let channel = 0; channel < channels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[frame]));
        view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
        offset += 2;
    } return new Blob([array], { type: 'audio/wav' }); }
async function addAudioBlob(blob, name = '', lane) { await engine.init(); const resolvedName = name || blob.name || 'Recorded signal.wav', id = `audio-${cryptoId()}`, duration = await engine.setAudioAsset(id, await blob.arrayBuffer()); await putAsset(id, blob); const targetLane = lane || project.audioLanes[0] || (project.audioLanes[0] = createAudioLane()), steps = Math.max(1, Math.round(duration / (60 / project.tempo / 4) * 4) / 4), end = Math.max(0, ...targetLane.regions.map((region) => region.startStep + region.lengthSteps)); targetLane.regions.push(createAudioRegion(id, resolvedName, end, steps, duration)); changed(); renderAudioStudio(); toast(L('AUDIO REGION READY', 'REGIÓN DE AUDIO LISTA')); }
async function loadAudioAssets() { const ids = new Set(); for (const lane of project.audioLanes || [])
    for (const region of lane.regions)
        ids.add(region.assetId); for (const id of ids)
    try {
        const blob = await getAsset(id);
        if (blob)
            await engine.setAudioAsset(id, await blob.arrayBuffer());
    }
    catch { } renderAudioStudio(); }
function renderAudioStudio() { const root = $('#audioLanes'); if (!root)
    return; root.innerHTML = project.audioLanes.length ? project.audioLanes.map((lane) => `<article class="audio-lane" data-audio-lane="${lane.id}" style="--lane:${lane.color}"><header class="audio-lane-head"><input data-lane-name type="text" value="${esc(lane.name)}" aria-label="Lane name"><button data-lane-solo class="${lane.solo ? 'on' : ''}" aria-pressed="${lane.solo}">S</button><button data-lane-mute class="${lane.mute ? 'on' : ''}" aria-pressed="${lane.mute}">M</button><label>VOL<input data-lane-value="volume" type="range" min="0" max="1.5" step=".01" value="${lane.volume}"><output>${Math.round(lane.volume * 100)}</output></label><label>PAN<input data-lane-value="pan" type="range" min="-1" max="1" step=".01" value="${lane.pan}"><output>${Math.round(lane.pan * 100)}</output></label><button data-lane-delete>DELETE LANE</button></header><div class="audio-track">${lane.regions.map((region) => `<article class="audio-region" data-audio-region="${region.id}" style="--length:${region.lengthSteps}"><header><b>${esc(region.name)}</b><button data-region-delete title="Delete region">×</button></header><div class="mini-wave"></div><div class="audio-region-controls"><label>START<input data-region-key="startStep" type="number" min="0" step=".25" value="${region.startStep}"></label><label>LENGTH<input data-region-key="lengthSteps" type="number" min=".25" step=".25" value="${region.lengthSteps}"></label><label>OFFSET<input data-region-key="offsetSeconds" type="number" min="0" step=".01" value="${region.offsetSeconds.toFixed(2)}"></label><label>GAIN<input data-region-key="gainDb" type="number" min="-60" max="18" step=".5" value="${region.gainDb}"></label><label>FADE IN<input data-region-key="fadeInSteps" type="number" min="0" step=".25" value="${region.fadeInSteps}"></label><label>FADE OUT<input data-region-key="fadeOutSteps" type="number" min="0" step=".25" value="${region.fadeOutSteps}"></label><label>PITCH<input data-region-key="pitch" type="number" min="-24" max="24" step="1" value="${region.pitch}"></label><label>BPM<input data-region-key="sourceBpm" type="number" min="20" max="300" step=".1" value="${region.sourceBpm}"></label><label class="wide">WARP<select data-region-key="warp"><option value="0" ${!region.warp ? 'selected' : ''}>OFF</option><option value="1" ${region.warp ? 'selected' : ''}>TEMPO LOCK</option></select></label><label class="wide">MODE<select data-region-key="warpMode"><option value="repitch" ${region.warpMode === 'repitch' ? 'selected' : ''}>REPITCH</option><option value="stretch" ${region.warpMode === 'stretch' ? 'selected' : ''}>STRETCH PREVIEW</option></select></label></div></article>`).join('') || '<div class="audio-empty">DROP OR IMPORT AUDIO TO THIS LANE</div>'}</div></article>`).join('') : '<div class="audio-empty">IMPORT AUDIO OR CREATE A LANE TO START THE HYBRID ARRANGEMENT</div>'; $$('[data-audio-lane]').forEach(row => { const lane = project.audioLanes.find((item) => item.id === row.dataset.audioLane); row.querySelector('[data-lane-name]').onchange = (event) => { lane.name = event.target.value || lane.name; changed(); }; row.querySelector('[data-lane-solo]').onclick = () => { lane.solo = !lane.solo; changed(); renderAudioStudio(); }; row.querySelector('[data-lane-mute]').onclick = () => { lane.mute = !lane.mute; changed(); renderAudioStudio(); }; row.querySelectorAll('[data-lane-value]').forEach((input) => input.oninput = () => { lane[input.dataset.laneValue] = +input.value; input.closest('label').querySelector('output').textContent = Math.round(+input.value * 100); engine.setProject(project); }); row.querySelectorAll('[data-lane-value]').forEach((input) => input.onchange = () => changed()); row.querySelector('[data-lane-delete]').onclick = () => { if (!confirm(L('Delete this audio lane?', '¿Borrar esta pista de audio?')))
    return; snapshot(); project.audioLanes = project.audioLanes.filter((item) => item.id !== lane.id); changed(); renderAudioStudio(); }; row.querySelectorAll('[data-audio-region]').forEach((card) => { const region = lane.regions.find((item) => item.id === card.dataset.audioRegion); card.querySelectorAll('[data-region-key]').forEach((input) => input.onchange = () => { const key = input.dataset.regionKey; region[key] = key === 'warp' ? input.value === '1' : key === 'warpMode' ? input.value : +input.value; if (region.offsetSeconds >= region.durationSeconds)
    region.offsetSeconds = Math.max(0, region.durationSeconds - .01); changed(); renderAudioStudio(); }); card.querySelector('[data-region-delete]').onclick = async () => { snapshot(); lane.regions = lane.regions.filter((item) => item.id !== region.id); const used = project.audioLanes.some((item) => item.regions.some((candidate) => candidate.assetId === region.assetId)); if (!used) {
    engine.clearAudioAsset(region.assetId);
    await deleteAsset(region.assetId);
} changed(); renderAudioStudio(); }; }); }); renderGlobalAutomation(); }
function renderGlobalAutomation() { const root = $('#globalAutomation'); if (!root)
    return; root.innerHTML = [...(project.automationLanes || []).map((lane) => `<article class="automation-card" data-global-auto="${lane.id}"><b>${esc(lane.name)}</b><button data-auto-delete>×</button><small>${lane.target} · ${lane.points.length} POINTS · ${lane.writeMode.toUpperCase()}</small><button data-auto-point>＋ POINT</button></article>`), ...(project.modulationRoutes || []).map((route) => `<article class="modulation-card" data-mod-route="${route.id}"><b>${route.source.toUpperCase()} → ${esc(route.target)}</b><button data-mod-delete>×</button><small>AMOUNT ${Math.round(route.amount * 100)}% · ${route.rate.toFixed(2)} Hz</small><input data-mod-amount type="range" min="-1" max="1" step=".01" value="${route.amount}"></article>`)].join('') || '<small>NO GLOBAL AUTOMATION OR MODULATION ROUTES</small>'; $$('[data-global-auto]').forEach(card => { const lane = project.automationLanes.find((item) => item.id === card.dataset.globalAuto); card.querySelector('[data-auto-delete]').onclick = () => { project.automationLanes = project.automationLanes.filter((item) => item.id !== lane.id); changed(); renderGlobalAutomation(); }; card.querySelector('[data-auto-point]').onclick = () => { const step = +(prompt(L('Step', 'Paso'), '0') || '0'), value = +(prompt(L('Value 0–1', 'Valor 0–1'), '0.5') || '.5'); lane.points.push({ id: cryptoId(), step: Math.max(0, step), value: Math.max(0, Math.min(1, value)), curve: 'smooth' }); changed(); renderGlobalAutomation(); }; }); $$('[data-mod-route]').forEach(card => { const route = project.modulationRoutes.find((item) => item.id === card.dataset.modRoute); card.querySelector('[data-mod-delete]').onclick = () => { project.modulationRoutes = project.modulationRoutes.filter((item) => item.id !== route.id); changed(); renderGlobalAutomation(); }; card.querySelector('[data-mod-amount]').oninput = (event) => { route.amount = +event.target.value; engine.setProject(project); }; card.querySelector('[data-mod-amount]').onchange = () => { changed(); renderGlobalAutomation(); }; }); }
function renderMixGroups() { const root = $('#mixGroups'); if (!root)
    return; root.innerHTML = (project.mixerGroups || []).map((group) => `<article class="mix-group" data-mix-group="${group.id}" style="--group:${group.color}"><b>${esc(group.name)}</b><label>BUS LEVEL<input data-group-volume type="range" min="0" max="1.5" step=".01" value="${group.volume}"></label><label>SIDECHAIN<input data-group-duck type="range" min="0" max=".9" step=".01" value="${group.sidechainAmount}"></label></article>`).join(''); $$('[data-mix-group]').forEach(card => { const group = project.mixerGroups.find((item) => item.id === card.dataset.mixGroup); card.querySelector('[data-group-volume]').oninput = (event) => { group.volume = +event.target.value; engine.setProject(project); }; card.querySelector('[data-group-duck]').oninput = (event) => group.sidechainAmount = +event.target.value; card.querySelectorAll('input').forEach((input) => input.onchange = () => changed()); }); $$('[data-mix-track]').forEach(channel => { const track = channel.dataset.mixTrack, select = document.createElement('select'); select.dataset.trackGroup = ''; select.innerHTML = '<option value="">MASTER</option>' + project.mixerGroups.map((group) => `<option value="${group.id}" ${project.tracks[track].groupId === group.id ? 'selected' : ''}>${esc(group.name)}</option>`).join(''); const label = document.createElement('label'); label.dataset.precision = ''; label.innerHTML = '<span>GROUP</span>'; label.append(select); channel.insertBefore(label, channel.lastElementChild); select.onchange = () => { project.tracks[track].groupId = select.value || null; changed(); }; }); $('#masterTargetLufs').value = project.masterSettings.targetLufs; $('#masterTargetValue').textContent = `${project.masterSettings.targetLufs}`; $('#masterCeiling').value = project.masterSettings.ceilingDb; $('#masterCeilingValue').textContent = project.masterSettings.ceilingDb.toFixed(1); $('#monoCheckBtn').setAttribute('aria-pressed', String(project.masterSettings.monoCheck)); }
function renderTempoMap() { const root = $('#arrangeMarkers'); if (!root)
    return; for (const event of project.tempoMap || []) {
    const badge = document.createElement('button');
    badge.className = 'arrange-marker';
    badge.style.setProperty('--marker', '#2ee8ff');
    badge.textContent = `${event.step} · ${event.bpm} BPM`;
    badge.title = 'Tempo map';
    root.append(badge);
} for (const event of (project.meterMap || []).slice(1)) {
    const badge = document.createElement('button');
    badge.className = 'arrange-marker';
    badge.style.setProperty('--marker', '#8b7cff');
    badge.textContent = `${event.step} · ${event.beats}/${event.unit}`;
    root.append(badge);
} }
function samplerSettings() { return project.sampler || (project.sampler = samplerDefaults()); }
function setupSamplerOctaveControls() {
    if ($('#samplerOctaveValue'))
        return;
    $('#samplerArm').insertAdjacentHTML('afterend', '<span class="sampler-octave"><button id="samplerOctaveDown" aria-label="Sampler octave down">− OCT</button><output id="samplerOctaveValue">C4–C5</output><button id="samplerOctaveUp" aria-label="Sampler octave up">OCT ＋</button></span>');
    $('.sampler-keyboard-shell').insertAdjacentHTML('beforeend', '<output id="samplerLiveStatus" class="sampler-live-status" aria-live="polite">READY</output>');
    $('.sampler-hint').textContent = 'A W S E D F T G Y H U J K · Z/X octave · velocity-sensitive MIDI · Record Take captures the performance.';
    const decorate = () => { if (!$('#samplerKeyboard'))
        return; for (const key of $$('[data-sampler-pitch]')) {
        const marker = String(samplerQwertyBase);
        if (key.dataset.qwertyBase === marker)
            continue;
        key.dataset.qwertyBase = marker;
        key.querySelector('span')?.remove();
        const pitch = +key.dataset.samplerPitch, entry = Object.entries(samplerQwertyMap).find(([, offset]) => samplerQwertyBase + offset === pitch);
        key.classList.toggle('qwerty', Boolean(entry));
        if (entry) {
            const label = document.createElement('span');
            label.textContent = entry[0].toUpperCase();
            key.append(label);
        }
    } $('#samplerOctaveValue').textContent = `${samplerNoteName(samplerQwertyBase)}–${samplerNoteName(samplerQwertyBase + 12)}`; $('#samplerOctaveDown').disabled = samplerQwertyBase <= 48; $('#samplerOctaveUp').disabled = samplerQwertyBase >= 60; };
    const shift = (amount) => { for (const key of Object.keys(samplerQwertyMap))
        endSamplerPerformance(`sampler-qwerty-${key}`); samplerQwertyBase = Math.max(48, Math.min(60, samplerQwertyBase + amount)); decorate(); $('#samplerLiveStatus').textContent = `QWERTY · ${samplerNoteName(samplerQwertyBase)}–${samplerNoteName(samplerQwertyBase + 12)}`; };
    $('#samplerOctaveDown').onclick = () => shift(-12);
    $('#samplerOctaveUp').onclick = () => shift(12);
    new window.MutationObserver(decorate).observe($('#samplerKeyboard'), { childList: true });
    document.addEventListener('keydown', (event) => { if (!samplerArmed || activeView !== 'audio' || event.ctrlKey || event.metaKey || event.altKey || ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName))
        return; const key = event.key.toLowerCase(); if (key === 'z' || key === 'x') {
        if (!event.repeat)
            shift(key === 'z' ? -12 : 12);
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
    } const offset = samplerQwertyMap[key]; if (offset == null)
        return; event.preventDefault(); event.stopImmediatePropagation(); const source = `sampler-qwerty-${key}`; if (!event.repeat && !samplerHeld.has(source)) {
        const pitch = samplerQwertyBase + offset;
        startSamplerPerformance(source, pitch, .86, $(`[data-sampler-pitch="${pitch}"]`));
    } }, true);
    document.addEventListener('keyup', (event) => { const key = event.key.toLowerCase(); if (samplerQwertyMap[key] == null)
        return; const source = `sampler-qwerty-${key}`; if (!samplerHeld.has(source))
        return; event.preventDefault(); event.stopImmediatePropagation(); endSamplerPerformance(source); }, true);
    decorate();
}
function samplerNoteName(pitch) { return `${pitchNames[(pitch % 12 + 12) % 12]}${Math.floor(pitch / 12) - 1}`; }
function drawSamplerWaveform() { const canvas = $('#samplerWaveform'), buffer = engine.samplerBuffer; if (!canvas)
    return; const context = canvas.getContext('2d'); context.clearRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#070b16'; context.fillRect(0, 0, canvas.width, canvas.height); if (!buffer) {
    context.fillStyle = '#52607b';
    context.font = '800 12px sans-serif';
    context.textAlign = 'center';
    context.fillText(L('LOAD A SAMPLE TO BEGIN', 'CARGA UN SAMPLE PARA EMPEZAR'), canvas.width / 2, canvas.height / 2 + 4);
    return;
} const data = buffer.getChannelData(0), step = Math.max(1, Math.floor(data.length / canvas.width)), middle = canvas.height / 2, gradient = context.createLinearGradient(0, 0, canvas.width, 0); gradient.addColorStop(0, '#2ee8ff'); gradient.addColorStop(.5, '#ff3bd4'); gradient.addColorStop(1, '#a7ff5b'); context.strokeStyle = gradient; context.lineWidth = 1.5; context.beginPath(); for (let x = 0; x < canvas.width; x++) {
    let peak = 0;
    for (let index = x * step; index < Math.min(data.length, (x + 1) * step); index++)
        peak = Math.max(peak, Math.abs(data[index]));
    const height = Math.max(1, peak * (canvas.height - 8));
    context.moveTo(x, middle - height / 2);
    context.lineTo(x, middle + height / 2);
} context.stroke(); const settings = samplerSettings(); context.fillStyle = '#050914aa'; context.fillRect(0, 0, settings.trimStart * canvas.width, canvas.height); context.fillRect(settings.trimEnd * canvas.width, 0, (1 - settings.trimEnd) * canvas.width, canvas.height); }
function startSamplerPerformance(source, pitch, velocity = .85, element) { if (!samplerSettings().assetId) {
    toast(L('LOAD A SAMPLE FIRST', 'CARGA PRIMERO UN SAMPLE'));
    return;
} element?.classList.add('active', 'hit'); if (element) {
    samplerHeld.set(source, element);
    setTimeout(() => element.classList.remove('hit'), 260);
} $('#samplerLab')?.classList.add('playing'); if ($('#samplerLiveStatus'))
    $('#samplerLiveStatus').textContent = `LIVE · ${samplerNoteName(pitch)} · ${Math.round(velocity * 127)}`; engine.startSampler(source, pitch, velocity, samplerSettings()); }
function endSamplerPerformance(source, element) { (element || samplerHeld.get(source))?.classList.remove('active'); samplerHeld.delete(source); engine.stopSampler(source); if (!samplerHeld.size) {
    $('#samplerLab')?.classList.remove('playing');
    if ($('#samplerLiveStatus'))
        $('#samplerLiveStatus').textContent = 'READY';
} }
function renderSamplerKeyboard() { if (!$('#samplerKeyboard'))
    return; const settings = samplerSettings(), keyboard = $('#samplerKeyboard'), black = new Set([1, 3, 6, 8, 10]); let whites = 0; const keys = []; for (let pitch = 48; pitch <= 72; pitch++) {
    const dark = black.has(pitch % 12), left = dark ? whites * 72 - 24 : whites++ * 72, label = keyMap[samplerQwertyPitches.indexOf(pitch)]?.toUpperCase() || '';
    keys.push(`<button class="sampler-key ${dark ? 'accidental' : 'natural'} ${pitch === settings.rootNote ? 'root' : ''}" style="--key-left:${left}px;--key-hue:${(pitch % 12) * 30}" data-sampler-pitch="${pitch}" aria-label="${samplerNoteName(pitch)}"><b>${samplerNoteName(pitch)}</b>${label ? `<span>${label}</span>` : ''}</button>`);
} keyboard.style.width = `${whites * 72}px`; keyboard.innerHTML = keys.join(''); $$('[data-sampler-pitch]').forEach((key) => { const source = `sampler-pointer-${key.dataset.samplerPitch}`; key.onpointerdown = (event) => { event.preventDefault(); key.setPointerCapture?.(event.pointerId); startSamplerPerformance(source, +key.dataset.samplerPitch, .88, key); }; key.onpointerup = () => endSamplerPerformance(source, key); key.onpointercancel = () => endSamplerPerformance(source, key); }); $('#samplerName').textContent = settings.assetId ? settings.name : L('DROP A SOUND INTO THE CHROMATIC ENGINE', 'ARRASTRA UN SONIDO AL MOTOR CROMÁTICO'); $('#samplerMeta').textContent = settings.assetId ? `${settings.duration.toFixed(2)} s · ${samplerNoteName(settings.rootNote)} ROOT · ${settings.mode.toUpperCase()}` : L('WAV · MP3 · OGG · WEBM', 'WAV · MP3 · OGG · WEBM'); $('#samplerArm').disabled = !settings.assetId; $('#samplerArm').setAttribute('aria-pressed', String(samplerArmed)); $('#samplerArm').classList.toggle('active', samplerArmed); $('#samplerRemove').disabled = !settings.assetId; for (const [id, key] of [['#samplerRoot', 'rootNote'], ['#samplerMode', 'mode'], ['#samplerTune', 'tune'], ['#samplerGain', 'gain'], ['#samplerAttack', 'attack'], ['#samplerRelease', 'release'], ['#samplerFilter', 'filter'], ['#samplerTrimStart', 'trimStart'], ['#samplerTrimEnd', 'trimEnd'], ['#samplerPolyphony', 'polyphony']])
    $(id).value = String(settings[key]); $('#samplerReverse').checked = settings.reverse; $('#samplerRootValue').textContent = samplerNoteName(settings.rootNote); $('#samplerTuneValue').textContent = `${settings.tune > 0 ? '+' : ''}${settings.tune} st`; $('#samplerGainValue').textContent = `${Math.round(settings.gain * 100)}%`; $('#samplerAttackValue').textContent = `${Math.round(settings.attack * 1000)} ms`; $('#samplerReleaseValue').textContent = `${Math.round(settings.release * 1000)} ms`; $('#samplerFilterValue').textContent = `${Math.round(settings.filter * 100)}%`; drawSamplerWaveform(); }
async function loadSamplerAsset() { const settings = samplerSettings(); if (!settings.assetId) {
    loadedSamplerAssetId = null;
    engine.clearSamplerSample();
    renderSamplerKeyboard();
    return;
} try {
    const blob = await getAsset(settings.assetId);
    if (!blob)
        throw new Error('missing');
    settings.duration = await engine.setSamplerSample(await blob.arrayBuffer(), settings.reverse);
    loadedSamplerAssetId = settings.assetId;
}
catch {
    loadedSamplerAssetId = null;
    engine.clearSamplerSample();
} renderSamplerKeyboard(); }
function setupSamplerKeyboard() { if ($('#samplerLab'))
    return; $('.audio-ruler').insertAdjacentHTML('beforebegin', '<section id="samplerLab" class="sampler-lab"><header><div><span class="eyebrow">CHROMATIC SAMPLE ENGINE</span><h2>PRISM KEYS</h2><p id="samplerName">NO SAMPLE LOADED</p><small id="samplerMeta">WAV · MP3 · OGG · WEBM</small></div><div class="sampler-actions"><label class="file-button">＋ LOAD SAMPLE<input id="samplerImport" type="file" accept="audio/*"></label><button id="samplerArm" aria-pressed="false" disabled>⌨ ARM QWERTY / MIDI</button><button id="samplerRemove" disabled>REMOVE</button></div></header><canvas id="samplerWaveform" width="1100" height="82" aria-label="Sampler waveform"></canvas><div class="sampler-controls"><label>ROOT <input id="samplerRoot" data-sampler-setting="rootNote" type="range" min="36" max="84" step="1"><output id="samplerRootValue"></output></label><label>MODE <select id="samplerMode" data-sampler-setting="mode"><option value="gate">GATE</option><option value="one-shot">ONE SHOT</option><option value="loop">LOOP</option></select></label><label>TUNE <input id="samplerTune" data-sampler-setting="tune" type="range" min="-24" max="24" step="1"><output id="samplerTuneValue"></output></label><label>LEVEL <input id="samplerGain" data-sampler-setting="gain" type="range" min="0" max="1.5" step=".01"><output id="samplerGainValue"></output></label><label>ATTACK <input id="samplerAttack" data-sampler-setting="attack" type="range" min=".001" max="2" step=".001"><output id="samplerAttackValue"></output></label><label>RELEASE <input id="samplerRelease" data-sampler-setting="release" type="range" min=".01" max="4" step=".01"><output id="samplerReleaseValue"></output></label><label>FILTER <input id="samplerFilter" data-sampler-setting="filter" type="range" min="0" max="1" step=".01"><output id="samplerFilterValue"></output></label><label>START <input id="samplerTrimStart" data-sampler-setting="trimStart" type="range" min="0" max=".99" step=".001"></label><label>END <input id="samplerTrimEnd" data-sampler-setting="trimEnd" type="range" min=".01" max="1" step=".001"></label><label>VOICES <input id="samplerPolyphony" data-sampler-setting="polyphony" type="number" min="1" max="24" step="1"></label><label class="switch"><input id="samplerReverse" data-sampler-setting="reverse" type="checkbox"><span>REVERSE</span></label></div><div class="sampler-keyboard-shell"><div id="samplerKeyboard" class="sampler-keyboard" role="application" aria-label="Chromatic sampler keyboard"></div></div><p class="sampler-hint">A S D F G H J K · velocity-sensitive MIDI · use Record Take to capture the live sampler performance.</p></section>'); $('#samplerImport').onchange = async (event) => { const file = event.target.files?.[0]; if (!file)
    return; try {
    const previous = samplerSettings().assetId, id = `sampler-${cryptoId()}`, duration = await engine.setSamplerSample(await file.arrayBuffer(), false);
    await putAsset(id, file);
    if (previous)
        await deleteAsset(previous);
    project.sampler = { ...samplerDefaults(), assetId: id, name: file.name, size: file.size, type: file.type, duration };
    samplerArmed = true;
    changed();
    renderSamplerKeyboard();
    toast(L('SAMPLER READY', 'SAMPLER LISTO'));
}
catch (error) {
    toast(`${L('SAMPLE ERROR', 'ERROR DE SAMPLE')}: ${error instanceof Error ? error.message : String(error)}`);
} event.target.value = ''; }; $('#samplerArm').onclick = () => { samplerArmed = !samplerArmed; renderSamplerKeyboard(); toast(samplerArmed ? L('SAMPLER INPUT ARMED', 'ENTRADA DEL SAMPLER ACTIVADA') : L('SAMPLER INPUT RELEASED', 'ENTRADA DEL SAMPLER DESACTIVADA')); }; $('#samplerRemove').onclick = async () => { const settings = samplerSettings(); if (settings.assetId)
    await deleteAsset(settings.assetId); project.sampler = samplerDefaults(); samplerArmed = false; engine.clearSamplerSample(); changed(); renderSamplerKeyboard(); }; $$('[data-sampler-setting]').forEach((input) => input.onchange = async () => { const settings = samplerSettings(), key = input.dataset.samplerSetting; settings[key] = input.type === 'checkbox' ? input.checked : input.tagName === 'SELECT' ? input.value : +input.value; if (settings.trimEnd <= settings.trimStart)
    settings.trimEnd = Math.min(1, settings.trimStart + .01); settings.polyphony = Math.max(1, Math.min(24, Math.round(settings.polyphony))); changed(); if (key === 'reverse')
    await loadSamplerAsset();
else
    renderSamplerKeyboard(); }); loadSamplerAsset(); }
function setupV6Studio() { const scale = localStorage.getItem('kiber-vengance-ui-scale-v1') || '1'; document.documentElement.style.setProperty('--ui-scale', scale); $('#uiScale').value = scale; $('#uiScale').onchange = () => { localStorage.setItem('kiber-vengance-ui-scale-v1', $('#uiScale').value); document.documentElement.style.setProperty('--ui-scale', $('#uiScale').value); }; $('#audioLaneBtn').onclick = () => { project.audioLanes.push(createAudioLane(`AUDIO ${project.audioLanes.length + 1}`, ['#2ee8ff', '#ff3bd4', '#a7ff5b', '#ff9f43'][project.audioLanes.length % 4])); changed(); renderAudioStudio(); }; $('#audioImport').onchange = async (event) => { for (const file of Array.from(event.target.files || []))
    await addAudioBlob(file); event.target.value = ''; }; $('#audioRecordBtn').onclick = async () => { const button = $('#audioRecordBtn'); if (inputRecorder?.state === 'recording') {
    inputRecorder.stop();
    button.classList.remove('active');
    button.textContent = '● RECORD INPUT';
    return;
} try {
    inputStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    inputChunks = [];
    inputRecorder = new MediaRecorder(inputStream);
    inputRecorder.ondataavailable = event => { if (event.data.size)
        inputChunks.push(event.data); };
    inputRecorder.onstop = async () => { inputStream?.getTracks().forEach(track => track.stop()); await addAudioBlob(new Blob(inputChunks, { type: inputRecorder?.mimeType || 'audio/webm' }), `Input ${new Date().toLocaleTimeString()}.webm`); };
    inputRecorder.start(250);
    button.classList.add('active');
    button.textContent = '■ STOP INPUT';
}
catch (error) {
    toast(`${L('INPUT UNAVAILABLE', 'ENTRADA NO DISPONIBLE')}: ${error instanceof Error ? error.message : String(error)}`);
} }; $('#audioScratchBtn').onclick = async () => { if (!scratchBuffer) {
    toast(L('CAPTURE THE SCRATCH DECK FIRST', 'CAPTURA PRIMERO EL PLATO'));
    return;
} await addAudioBlob(audioBufferWav(scratchBuffer), 'Scratch resample.wav'); }; $('#automationLaneBtn').onclick = () => { const target = $('#automationTarget').value, lane = createAutomationLane(target, target.replace(/[._]/g, ' ').toUpperCase()); lane.writeMode = $('#automationWriteMode').value; lane.points = [{ id: cryptoId(), step: 0, value: .5, curve: 'smooth' }, { id: cryptoId(), step: 64, value: .8, curve: 'smooth' }]; project.automationLanes.push(lane); changed(); renderGlobalAutomation(); }; $('#modulationBtn').onclick = () => { project.modulationRoutes.push({ id: cryptoId(), source: 'lfo-1', target: $('#automationTarget').value, amount: .25, bipolar: true, rate: .5 }); changed(); renderGlobalAutomation(); }; $('#monoCheckBtn').onclick = () => { project.masterSettings.monoCheck = !project.masterSettings.monoCheck; changed(); renderMixer(); renderMixGroups(); }; for (const id of ['masterTargetLufs', 'masterCeiling'])
    $(`#${id}`).onchange = () => { project.masterSettings[id === 'masterTargetLufs' ? 'targetLufs' : 'ceilingDb'] = +$(`#${id}`).value; changed(); engine.setProject(project); renderMixGroups(); }; const tools = $('.generators'); if (tools && !$('#transformNotes'))
    tools.insertAdjacentHTML('beforeend', '<span id="transformNotes"><button data-transform="retrograde">REVERSE</button><button data-transform="invert">INVERT</button><button data-transform="double">×2</button><button data-transform="half">÷2</button><button data-transform="humanize">HUMANIZE</button></span>'); $$('[data-transform]').forEach(button => button.onclick = () => { snapshot(); transformNotes(clip(), button.dataset.transform, .65); changed(); renderPiano(); toast(`TRANSFORM · ${button.dataset.transform.toUpperCase()}`); }); const toolbar = $('.arrange-toolbar'); if (toolbar && !$('#tempoEventBtn'))
    toolbar.insertAdjacentHTML('beforeend', '<button id="tempoEventBtn">＋ TEMPO</button><button id="meterEventBtn">＋ METER</button>'); $('#tempoEventBtn').onclick = () => { const step = +(prompt('Step', '0') || 0), bpm = +(prompt('BPM', String(project.tempo)) || project.tempo); project.tempoMap.push({ id: cryptoId(), step: Math.max(0, step), bpm: Math.max(30, Math.min(300, bpm)), curve: 'jump' }); changed(); renderArrangement(); renderTempoMap(); }; $('#meterEventBtn').onclick = () => { const step = +(prompt('Step', '0') || 0), meter = (prompt('Meter', '4/4') || '4/4').split('/').map(Number); project.meterMap.push({ id: cryptoId(), step: Math.max(0, step), beats: Math.max(1, Math.min(12, meter[0] || 4)), unit: meter[1] === 8 ? 8 : 4 }); changed(); renderArrangement(); renderTempoMap(); }; loadAudioAssets(); }
function setupMidiLearnUi() { if (!$('#midiLearnBtn'))
    $('#globalAutomation').insertAdjacentHTML('beforebegin', '<button id="midiLearnBtn">MIDI LEARN</button>'); $('#midiLearnBtn').onclick = () => { midiLearnTarget = $('#automationTarget').value; $('#midiLearnBtn').textContent = 'MOVE A MIDI CC…'; toast(L('MIDI LEARN ARMED', 'MIDI LEARN ARMADO')); }; }
function setupV6Copy() { const sync = () => { const projectCopy = $('.export-choice:nth-child(3) span'), bundleCopy = $('.export-choice:nth-child(6) span'); if (projectCopy)
    projectCopy.textContent = L('Portable v6 backup', 'Copia portátil v6'); if (bundleCopy)
    bundleCopy.textContent = L('Project JSON + local audio assets', 'JSON del proyecto + audio local'); }; sync(); $('#languageSelect').addEventListener('change', sync); $('#menuLanguageSelect').addEventListener('change', sync); }
function setupV6Safety() { const syncScale = () => $('#app').classList.toggle('ui-scaled', Math.abs(+$('#uiScale').value - 1) > .001); syncScale(); $('#uiScale').addEventListener('change', syncScale); $('#audioLanes').addEventListener('change', (event) => { const input = event.target; if (!input.matches('[data-region-key]'))
    return; event.stopImmediatePropagation(); const card = input.closest('[data-audio-region]'), row = input.closest('[data-audio-lane]'), lane = project.audioLanes.find((item) => item.id === row.dataset.audioLane), region = lane?.regions.find((item) => item.id === card.dataset.audioRegion); if (!region)
    return; const key = input.dataset.regionKey; region[key] = key === 'warp' ? input.value === '1' : key === 'warpMode' ? input.value : +input.value; if (region.offsetSeconds >= region.durationSeconds)
    region.offsetSeconds = Math.max(0, region.durationSeconds - .01); changed(); setTimeout(renderAudioStudio, 0); }, true); }
function setupSampleSlicing() { const decorate = () => $$('[data-sample-slot]').forEach(row => { const slot = +row.dataset.sampleSlot, asset = project.samples.find((item) => item.slot === slot); if (!asset || row.querySelector('[data-slice-sample]'))
    return; const button = document.createElement('button'); button.dataset.sliceSample = ''; button.textContent = asset.slices?.length ? `${asset.slices.length} SLICES` : 'AUTO SLICE'; button.onclick = async () => { const blob = await getAsset(asset.id); if (!blob)
    return; await engine.init(); const buffer = await engine.ctx.decodeAudioData(await blob.arrayBuffer()), count = Math.max(2, Math.min(16, +(prompt(L('Number of slices', 'Número de cortes'), '8') || 8))), points = detectTransientSlices(buffer.getChannelData(0), count), pairs = points.slice(0, -1).map((start, index) => ({ start, end: points[index + 1] })), empty = DRUM_NAMES.map((_, index) => index).filter(index => !project.samples.some((sample) => sample.slot === index) || index === slot); asset.slices = pairs.map((pair, index) => ({ id: cryptoId(), name: `${asset.name} ${index + 1}`, start: pair.start, end: pair.end, rootNote: 36 + index })); for (let index = 0; index < Math.min(pairs.length, empty.length); index++) {
    const target = empty[index], pair = pairs[index], id = index === 0 ? asset.id : `sample-${cryptoId()}`;
    if (index > 0)
        await putAsset(id, blob);
    const sliced = { ...structuredClone(asset), id, slot: target, name: `${asset.name} · ${index + 1}`, trimStart: pair.start, trimEnd: pair.end, slices: [] };
    project.samples = project.samples.filter((sample) => sample.slot !== target);
    project.samples.push(sliced);
} changed(); await loadLocalSamples(); renderSampleSlots(); toast(`${pairs.length} ${L('TRANSIENT SLICES DETECTED', 'CORTES TRANSITORIOS DETECTADOS')}`); }; row.append(button); }); new window.MutationObserver(decorate).observe($('#sampleSlots'), { childList: true }); decorate(); }
function setupProjectTemplates() { if (!$('#projectTemplate'))
    $('#newBtn').insertAdjacentHTML('beforebegin', '<label class="ui-scale-control"><span>PROJECT TEMPLATE</span><select id="projectTemplate"><option value="cinematic">CINEMATIC DEMO</option><option value="minimal">MINIMAL SIGNAL</option><option value="performance">PERFORMANCE RIG</option><option value="audio">AUDIO / RESAMPLE</option></select><button id="applyTemplateBtn">CREATE</button></label>'); $('#applyTemplateBtn').onclick = () => { const type = $('#projectTemplate').value, next = type === 'cinematic' ? createProject() : createEmptyProject(); if (type === 'performance') {
    next.title = 'Live Voltage';
    for (const track of TRACKS)
        activeClip(next, track).bars = 4;
    next.loop = { enabled: true, start: 0, end: 64, punch: false };
} if (type === 'audio') {
    next.title = 'Hybrid Session';
    next.audioLanes = [createAudioLane('RESAMPLE', '#ff3bd4'), createAudioLane('VOCALS', '#2ee8ff')];
} replaceProject(next); toast(L('PROJECT TEMPLATE CREATED', 'PLANTILLA DE PROYECTO CREADA')); }; }
function renderAll() { renderTracks(); renderInspector(); renderArp(); renderFx(); macroMarkup($('#macros')); macroMarkup($('#performMacros')); renderClipControls(); renderHarmony(); renderPiano(); renderAutomation(); renderKeyboard(); renderLauncher(); renderArrangement(); renderTempoMap(); renderMixer(); renderMixGroups(); renderSamplerKeyboard(); renderAudioStudio(); renderPerformanceTakes(); renderLocators(); $('#title').value = project.title; $('#tempo').value = project.tempo; $('#meterSelect').value = `${project.meter.beats}/${project.meter.unit}`; $('#recordMode').value = project.editor.recordMode || 'quantized'; $('#swing').value = Math.round(project.swing * 100); $('#masterVolume').value = project.master; $('#masterValue').textContent = Math.round(project.master * 100); updateOrb(); installControlHelp(); syncStudioUi(); }
async function togglePlay(forceSong) { if (engine.playing) {
    engine.stop();
    $('#playBtn').textContent = '▶';
    $('#playBtn').classList.remove('active');
}
else {
    engine.songMode = forceSong ?? ['arrange', 'mix'].includes(activeView);
    const startStep = engine.songMode ? globalStartStep : (clipStartSteps.get(clip().id) || 0);
    await engine.start(project, { countInBars: recordArmed ? +$('#countIn').value : 0, startStep });
    $('#playBtn').textContent = '■';
    $('#playBtn').classList.add('active');
    $('#audioState').textContent = engine.countingIn ? 'COUNT IN' : 'RUNNING';
    animateMeter();
    if (activeView === 'mix')
        animateMixer();
} }
function animateMeter() { cancelAnimationFrame(animation); const loop = () => { if (engine.playing) {
    engine.draw($('#meter'));
    animation = requestAnimationFrame(loop);
} }; loop(); }
function wavOptions() { const useRegion = Boolean($('#wavRegion').checked) && project.loop.end > project.loop.start; return { bitDepth: (+$('#wavDepth').value === 32 ? 32 : 16), normalize: Boolean($('#wavNormalize').checked), sampleRate: (+$('#wavSampleRate').value || 48000), tailSeconds: +$('#wavTail').value || 0, dither: Boolean($('#wavDither').checked), dry: $('#wavFx').value === 'dry', region: useRegion ? { start: project.loop.start, end: project.loop.end } : undefined, signal: exportController?.signal, drumSamples: engine.drumSamples, audioAssets: engine.audioAssets }; }
function setExportProgress(value, status) { $('#exportProgress').value = Math.max(0, Math.min(100, value)); if (status)
    $('#renderStatus').textContent = status; }
async function exportWav(song, target) { const st = $('#renderStatus'), buttons = $$('#exportDialog button'); exportController = new AbortController(); buttons.forEach(button => { if (button.id !== 'cancelExportBtn')
    button.disabled = true; }); $('#cancelExportBtn').disabled = false; setExportProgress(12, L(song ? 'RENDERING FULL ARRANGEMENT…' : 'RENDERING ACTIVE CLIPS…', song ? 'RENDERIZANDO ARREGLO COMPLETO…' : 'RENDERIZANDO CLIPS ACTIVOS…')); try {
    const wav = await renderWav(project, { song, ...wavOptions() }), name = `${safeName()}${song ? '-song' : '-clips'}.wav`;
    setExportProgress(90, L('WRITING AUDIO…', 'ESCRIBIENDO AUDIO…'));
    if (target)
        await writeQuickExport(target, wav);
    else
        download(wav, name);
    setExportProgress(100, L('WAV READY', 'WAV LISTO'));
    toast(target && !target.fallback ? L(`WAV SAVED · ${target.name}`, `WAV GUARDADO · ${target.name}`) : L('WAV EXPORTED', 'WAV EXPORTADO'));
}
catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
        st.textContent = L('EXPORT CANCELLED', 'EXPORTACIÓN CANCELADA');
        return;
    }
    throw error;
}
finally {
    exportController = null;
    buttons.forEach(button => button.disabled = false);
    $('#cancelExportBtn').disabled = true;
} }
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++)
        crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
} return (crc ^ 0xffffffff) >>> 0; }
async function zipFiles(files) { const encoder = new TextEncoder(), parts = [], central = [], offsets = []; let offset = 0; const u16 = (value) => new Uint8Array([value & 255, value >>> 8 & 255]), u32 = (value) => new Uint8Array([value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24 & 255]); for (const file of files) {
    const name = encoder.encode(file.name), data = new Uint8Array(await file.data.arrayBuffer()), crc = crc32(data), header = new Blob([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name]);
    offsets.push(offset);
    parts.push(header, data);
    offset += header.size + data.length;
} let centralSize = 0; for (let i = 0; i < files.length; i++) {
    const file = files[i], name = encoder.encode(file.name), data = new Uint8Array(await file.data.arrayBuffer()), entry = new Blob([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc32(data)), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offsets[i]), name]);
    central.push(entry);
    centralSize += entry.size;
} return new Blob([...parts, ...central, u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralSize), u32(offset), u16(0)], { type: 'application/zip' }); }
async function readStoreZip(blob) { const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), decoder = new TextDecoder(), files = new Map(); let offset = 0; while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true), size = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true);
    if (method !== 0)
        throw new Error('Only uncompressed КИБЕР VENGANCE packages are supported');
    const nameStart = offset + 30, dataStart = nameStart + nameLength + extraLength, name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    files.set(name, new Blob([bytes.slice(dataStart, dataStart + size)]));
    offset = dataStart + size;
} return files; }
async function importProjectFile(file) { if (file.name.toLowerCase().endsWith('.zip')) {
    const files = await readStoreZip(file), entry = [...files.entries()].find(([name]) => name.endsWith('.kiber.json'));
    if (!entry)
        throw new Error('Project package does not contain a .kiber.json file');
    const next = migrateProject(JSON.parse(await entry[1].text()));
    for (const asset of next.samples) {
        const sample = [...files.entries()].find(([name]) => name.startsWith(`samples/${asset.slot}-`));
        if (sample)
            await putAsset(asset.id, new Blob([await sample[1].arrayBuffer()], { type: asset.type }));
    }
    if (next.sampler.assetId) {
        const packed = [...files.entries()].find(([name]) => name.startsWith(`sampler/${next.sampler.assetId}-`));
        if (packed) {
            const blob = new Blob([await packed[1].arrayBuffer()], { type: next.sampler.type || 'audio/wav' });
            await putAsset(next.sampler.assetId, blob);
            try {
                await engine.setSamplerSample(await blob.arrayBuffer(), next.sampler.reverse);
            }
            catch { }
        }
    }
    const audioIds = new Set();
    for (const lane of next.audioLanes)
        for (const region of lane.regions)
            audioIds.add(region.assetId);
    for (const id of audioIds) {
        const entry = [...files.entries()].find(([name]) => name.startsWith(`audio/${id}-`));
        if (!entry)
            continue;
        const blob = new Blob([await entry[1].arrayBuffer()], { type: 'audio/wav' });
        await putAsset(id, blob);
        try {
            await engine.setAudioAsset(id, await blob.arrayBuffer());
        }
        catch { }
    }
    return next;
} return migrateProject(JSON.parse(await file.text())); }
async function renderStems() { const files = [], base = safeName(), selected = new Set($$('[data-stem]:checked').map(input => input.dataset.stem)), jobs = (selected.has('master') ? 1 : 0) + TRACKS.filter(track => selected.has(track)).length; exportController = new AbortController(); $('#cancelExportBtn').disabled = false; let done = 0; if (selected.has('master')) {
    setExportProgress(2, L('RENDERING MASTER…', 'RENDERIZANDO MASTER…'));
    files.push({ name: `${base}-master.wav`, data: await renderWav(project, { song: true, ...wavOptions() }) });
    done++;
} for (const track of TRACKS.filter(track => selected.has(track))) {
    if (exportController.signal.aborted)
        throw new DOMException('Export cancelled', 'AbortError');
    const isolated = structuredClone(project);
    TRACKS.forEach(id => { isolated.tracks[id].solo = id === track; isolated.tracks[id].mute = false; });
    setExportProgress(done / Math.max(1, jobs) * 88, L(`RENDERING STEM ${done + 1}/${jobs} · ${TRACK_META[track].label}`, `RENDERIZANDO PISTA ${done + 1}/${jobs} · ${TRACK_META[track].label}`));
    files.push({ name: `${base}-${track}.wav`, data: await renderWav(isolated, { song: true, ...wavOptions() }) });
    done++;
} if (!files.length)
    throw new Error(L('Select at least one stem', 'Selecciona al menos una pista')); files.push({ name: 'manifest.json', data: new Blob([JSON.stringify({ app: 'КИБЕР VENGANCE', project: project.title, createdAt: new Date().toISOString(), sampleRate: +$('#wavSampleRate').value, bitDepth: +$('#wavDepth').value, tracks: [...selected] }, null, 2)], { type: 'application/json' }) }); setExportProgress(94, L('PACKING STEMS…', 'EMPAQUETANDO PISTAS…')); const zip = await zipFiles(files); setExportProgress(100); exportController = null; $('#cancelExportBtn').disabled = true; return zip; }
async function renderProjectBundle() { const files = [{ name: `${safeName()}.kiber.json`, data: new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }) }]; for (const asset of project.samples) {
    const blob = await getAsset(asset.id);
    if (blob)
        files.push({ name: `samples/${asset.slot}-${asset.name.replace(/[^a-z0-9._-]+/gi, '-')}`, data: blob });
} if (project.sampler.assetId) {
    const blob = await getAsset(project.sampler.assetId);
    if (blob)
        files.push({ name: `sampler/${project.sampler.assetId}-${project.sampler.name.replace(/[^a-z0-9._-]+/gi, '-')}`, data: blob });
} const regionAssets = new Map(); for (const lane of project.audioLanes)
    for (const region of lane.regions)
        regionAssets.set(region.assetId, region.name); for (const [id, name] of regionAssets) {
    const blob = await getAsset(id);
    if (blob)
        files.push({ name: `audio/${id}-${name.replace(/[^a-z0-9._-]+/gi, '-')}`, data: blob });
} files.push({ name: 'PACKAGE-README.txt', data: new Blob(['КИБЕР VENGANCE v6 project package\nImport this ZIP from Project Core. КИБЕР VENGANCE restores sampler, audio-region and drum-sample assets into local browser storage.\n'], { type: 'text/plain' }) }); return zipFiles(files); }
const exportMeta = { wav: { extension: '.wav', type: 'audio/wav', description: 'Wave audio' }, midi: { extension: '.mid', type: 'audio/midi', description: 'MIDI song' }, project: { extension: '.json', type: 'application/json', description: 'КИБЕР VENGANCE project' }, 'clip-wav': { extension: '.wav', type: 'audio/wav', description: 'Wave audio' }, 'clip-midi': { extension: '.mid', type: 'audio/midi', description: 'MIDI clips' }, stems: { extension: '.zip', type: 'application/zip', description: 'КИБЕР VENGANCE stems' }, bundle: { extension: '.zip', type: 'application/zip', description: 'КИБЕР VENGANCE project package' }, performance: { extension: '.webm', type: 'audio/webm', description: 'Live performance' } };
function exportName(kind) { const suffix = { wav: '-song.wav', midi: '-song.mid', project: '.kiber.json', 'clip-wav': '-clips.wav', 'clip-midi': '-clips.mid', stems: '-stems.zip', bundle: '-project-package.zip', performance: '-performance.webm' }; return `${safeName()}${suffix[kind]}`; }
async function performExport(kind, forcePicker = false) { if (kind === 'performance' && !performanceTake && activePerformanceTakeId) {
    const take = project.performanceTakes.find((item) => item.id === activePerformanceTakeId);
    if (take)
        performanceTake = await loadPerformanceAudio(take);
} if (kind === 'performance' && !performanceTake) {
    toast(L('RECORD A PERFORMANCE TAKE FIRST', 'GRABA PRIMERO UNA TOMA'));
    return;
} const meta = exportMeta[kind], target = await prepareQuickExport(kind, exportName(kind), meta.type, meta.extension, meta.description, forcePicker); if (target.cancelled)
    return; try {
    let data;
    if (kind === 'wav' || kind === 'clip-wav') {
        localStorage.setItem(LAST_EXPORT, kind);
        await exportWav(kind === 'wav', target);
        renderExportTargets();
        return;
    }
    else if (kind === 'midi' || kind === 'clip-midi')
        data = encodeMidi(project, { song: kind === 'midi' });
    else if (kind === 'project')
        data = JSON.stringify(project, null, 2);
    else if (kind === 'stems')
        data = await renderStems();
    else if (kind === 'bundle')
        data = await renderProjectBundle();
    else
        data = performanceTake;
    await writeQuickExport(target, data);
    localStorage.setItem(LAST_EXPORT, kind);
    setExportProgress(100, L('EXPORT READY', 'EXPORTACIÓN LISTA'));
    toast(target.fallback ? L('EXPORT DOWNLOADED', 'EXPORTACIÓN DESCARGADA') : L(`SAVED · ${target.name}`, `GUARDADO · ${target.name}`));
    renderExportTargets();
}
catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
        $('#renderStatus').textContent = L('EXPORT CANCELLED', 'EXPORTACIÓN CANCELADA');
    else
        $('#renderStatus').textContent = `${L('EXPORT FAILED', 'ERROR DE EXPORTACIÓN')}: ${error instanceof Error ? error.message : String(error)}`;
    toast($('#renderStatus').textContent);
}
finally {
    exportController = null;
    $('#cancelExportBtn').disabled = true;
} }
async function quickExportWav(forcePicker = false) { await performExport('wav', forcePicker); }
async function quickExportMidi(forcePicker = false) { await performExport('midi', forcePicker); }
function repeatLastExport() { const kind = (localStorage.getItem(LAST_EXPORT) || 'wav'); performExport(kind, false); }
$('#playBtn').onclick = () => togglePlay();
$('#rewindBtn').onclick = () => { engine.stop(); currentStep = -1; currentScene = -1; transportPosition = 0; setGlobalStart(0); setClipStart(0); updatePlayheads(); $('#playBtn').textContent = '▶'; $('#playBtn').classList.remove('active'); };
$('#recordBtn').onclick = () => { recordArmed = !recordArmed; $('#recordBtn').classList.toggle('active', recordArmed); toast(recordArmed ? `RECORD ARMED · ${$('#countIn').value} BAR COUNT-IN` : 'RECORD SAFE'); syncStudioUi(); };
$('#metroBtn').onclick = () => { metronome = !metronome; engine.metronome = metronome; $('#metroBtn').setAttribute('aria-pressed', metronome); };
$('#tempo').onchange = () => { snapshot(); project.tempo = Math.max(50, Math.min(220, +$('#tempo').value)); changed(); };
$('#meterSelect').onchange = () => { snapshot(); const [beats, unit] = $('#meterSelect').value.split('/').map(Number); setProjectMeter(project, beats, unit); selectedNotes.clear(); changed(true); };
$('#recordMode').onchange = () => { snapshot(); project.editor.recordMode = $('#recordMode').value; changed(); toast(project.editor.recordMode === 'free' ? 'FREE MICROTIMING RECORDING' : 'QUANTIZED RECORDING'); };
$('#swing').onchange = () => { snapshot(); project.swing = Math.max(0, Math.min(.6, +$('#swing').value / 100)); changed(); };
$('#title').onchange = () => { snapshot(); project.title = $('#title').value.trim() || 'Untitled Signal'; changed(); };
$('#masterVolume').onpointerdown = snapshot;
$('#masterVolume').oninput = () => { project.master = +$('#masterVolume').value; $('#masterValue').textContent = Math.round(project.master * 100); $('#mixerMaster').value = project.master; $('#mixerMasterValue').textContent = `${Math.round(project.master * 100)}%`; engine.setProject(project); };
$('#masterVolume').onchange = () => changed();
$('#undoBtn').onclick = () => { project = history.undo(project); engine.project = project; selectedNotes.clear(); changed(true); };
$('#redoBtn').onclick = () => { project = history.redo(project); engine.project = project; selectedNotes.clear(); changed(true); };
$('#newClipBtn').onclick = () => { snapshot(); const source = clip(), c = createClip(selectedTrack, `${TRACK_META[selectedTrack].label} ${clipsForTrack(project, selectedTrack).length + 1}`, 2, meterSteps(project.meter)); c.character = structuredClone(source.character); project.clips.push(c); project.activeClipIds[selectedTrack] = c.id; selectedNotes.clear(); changed(true); toast(L('New clip created', 'Nuevo clip creado'), true); };
$('#duplicateBtn').onclick = () => { snapshot(); duplicateClip(project, clip().id); selectedNotes.clear(); changed(true); toast(L('Clip duplicated', 'Clip duplicado'), true); };
$('#mutateBtn').onclick = () => { snapshot(); varyClip(project, clip(), clip().character.macros.tension); selectedNotes.clear(); changed(true); toast(L('Variation created', 'Variación creada'), true); };
$('#noteLength').onchange = () => editSelection('length', $('#noteLength').value);
$('#noteVelocity').onpointerdown = () => { if (selectedNotes.size)
    snapshot(); };
$('#noteVelocity').oninput = () => { for (const n of clip().notes.filter(n => selectedNotes.has(n.id)))
    n.velocity = +$('#noteVelocity').value; renderPiano(); };
$('#noteVelocity').onchange = () => changed();
$('#deleteNotesBtn').onclick = deleteSelection;
$('#automationParam').onchange = () => { project.editor.automationParam = $('#automationParam').value; changed(); renderAutomation(); };
$('#clearAutomationBtn').onclick = () => { snapshot(); clip().automation[project.editor.automationParam] = {}; changed(); renderAutomation(); toast(L('Automation cleared', 'Automatización borrada'), true); };
$('#addSceneBtn').onclick = () => { snapshot(); addArrangementScene(project); changed(true); focusScene(project.arrangement.length - 1); };
$('#autoArrangeBtn').onclick = () => { snapshot(); distributeArrangementPatterns(project); changed(true); toast('CLIPS DISTRIBUTED ACROSS SONG'); };
function activateView(view) { activeView = view; $$('[data-view]').forEach(x => x.classList.toggle('active', x.dataset.view === view)); $$('.view').forEach(v => v.classList.toggle('active', v.id === `${view}View`)); engine.songMode = ['audio', 'arrange', 'mix'].includes(view); if (view === 'launch')
    renderLauncher(); if (view === 'audio') {
    renderAudioStudio();
    renderSamplerKeyboard();
} if (view === 'arrange') {
    renderArrangement();
    renderTempoMap();
} if (view === 'mix') {
    renderMixer();
    renderMixGroups();
    requestAnimationFrame(animateMixer);
} if (view === 'perform')
    renderPerformanceTakes(); syncStudioUi(); }
$$('[data-view]').forEach((b) => b.onclick = () => activateView(b.dataset.view));
function compatibility() { return { timestamp: new Date().toISOString(), userAgent: navigator.userAgent, audioContext: Boolean(window.AudioContext || window.webkitAudioContext), offlineAudio: Boolean(window.OfflineAudioContext), webMidi: Boolean(navigator.requestMIDIAccess), fileSystemAccess: Boolean(window.showSaveFilePicker), serviceWorker: Boolean(navigator.serviceWorker), secureContext: window.isSecureContext, platform: navigator.platform || 'unknown', sampleRate: engine.ctx?.sampleRate || 'not initialized', audioState: engine.ctx?.state || 'not initialized' }; }
function showCompatibility() { const data = compatibility(); $('#compatReport').innerHTML = Object.entries(data).map(([key, value]) => `<div><span>${esc(key)}</span><b class="${value === false ? 'bad' : 'good'}">${esc(value)}</b></div>`).join(''); open('#compatDialog'); return data; }
const open = (id) => $(id).showModal(), replaceProject = (next) => { snapshot(); project = next; engine.project = project; selectedNotes.clear(); globalStartStep = 0; clipStartSteps.clear(); changed(true); $('#projectMenu').close(); };
$('#menuBtn').onclick = () => { renderVersions(); renderExportTargets(); open('#projectMenu'); };
$('#exportBtn').onclick = repeatLastExport;
$('#exportAsBtn').onclick = () => open('#exportDialog');
$('#helpBtn').onclick = () => open('#helpDialog');
$('#aboutBtn').onclick = () => open('#aboutDialog');
$$('[data-close]').forEach((b) => b.onclick = () => b.closest('dialog').close());
$('#newBtn').onclick = () => { if (confirm('Create a new demo project? Autosave will be replaced.'))
    replaceProject(createProject()); };
$('#emptyBtn').onclick = () => { if (confirm('Create an empty project? Autosave will be replaced.'))
    replaceProject(createEmptyProject()); };
$('#duplicateProjectBtn').onclick = () => { const copy = migrateProject(structuredClone(project)); copy.id = crypto.randomUUID(); copy.title = `${project.title} Copy`; replaceProject(copy); toast('PROJECT DUPLICATED'); };
$('#saveBtn').onclick = saveVersion;
$('#exportProjectBtn').onclick = () => performExport('project', true);
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
    project = await importProjectFile(e.target.files[0]);
    engine.project = project;
    await loadLocalSamples();
    selectedNotes.clear();
    changed(true);
    $('#projectMenu').close();
    toast('PROJECT IMPORTED');
}
catch (err) {
    toast(`IMPORT ERROR: ${err instanceof Error ? err.message : String(err)}`);
} };
$('#backingBtn').onclick = () => open('#backingDialog');
$('#backingIntensity').oninput = () => $('#backingIntensityValue').textContent = Math.round(+$('#backingIntensity').value * 100);
$('#generateBackingBtn').onclick = () => { snapshot(); generateBacking(project, { sections: +$('#backingSections').value, intensity: +$('#backingIntensity').value, style: $('#backingStyle').value }); selectedNotes.clear(); changed(true); $('#backingDialog').close(); activateView('arrange'); toast(L('Backing generated · guitar ready', 'Base generada · guitarra lista'), true); };
$('#deleteClipDialog').onclose = () => pendingDeleteClipId = null;
$('#confirmDeleteClipBtn').onclick = () => { if (!pendingDeleteClipId)
    return; const target = project.clips.find((c) => c.id === pendingDeleteClipId); if (!target)
    return; const name = target.name; snapshot(); if (!deleteClip(project, pendingDeleteClipId)) {
    toast(L('KEEP AT LEAST ONE CLIP PER TRACK', 'DEBE QUEDAR UN CLIP POR PISTA'));
    return;
} pendingDeleteClipId = null; selectedNotes.clear(); $('#deleteClipDialog').close(); changed(true); toast(L(`“${name}” DELETED · ARRANGEMENT UPDATED`, `“${name}” BORRADO · ARREGLO ACTUALIZADO`), true); };
document.addEventListener('keydown', e => { const target = e.target, typing = Boolean(target?.closest?.('textarea,[contenteditable="true"],input:not([type]),input[type="text"],input[type="search"],input[type="number"],input[type="email"],input[type="password"],input[type="url"],input[type="tel"]')), blocked = $$('dialog').some(dialog => dialog.open) || typing, key = e.code === 'KeyS' || e.key.toLowerCase() === 's' ? 'solo' : e.code === 'KeyM' || e.key.toLowerCase() === 'm' ? 'mute' : e.code === 'KeyV' || e.key.toLowerCase() === 'v' ? 'mutate' : null; if (!blocked && !e.ctrlKey && !e.metaKey && !e.altKey && e.shiftKey && key) {
    e.preventDefault();
    e.stopImmediatePropagation();
    (key === 'mutate' ? $('#mutateBtn') : $(`[data-${key}="${selectedTrack}"]`))?.click();
} }, { capture: true });
document.addEventListener('keydown', e => { const mod = e.ctrlKey || e.metaKey; if (mod && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openCommands();
    return;
} if (mod && e.key.toLowerCase() === 'e') {
    e.preventDefault();
    if (e.shiftKey)
        open('#exportDialog');
    else
        repeatLastExport();
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
} if (e.shiftKey && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    activateView('launch');
    return;
} if (e.shiftKey && e.key.toLowerCase() === 'x') {
    e.preventDefault();
    activateView('mix');
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
} if (e.shiftKey && e.key.toLowerCase() === 'v') {
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
    } if (command === 0xb0) {
        if (midiLearnTarget) {
            project.midiMappings = project.midiMappings.filter((mapping) => mapping.target !== midiLearnTarget);
            project.midiMappings.push({ id: cryptoId(), channel, controller: data1, target: midiLearnTarget, min: 0, max: 1 });
            midiLearnTarget = null;
            $('#midiLearnBtn').textContent = 'MIDI LEARN';
            changed();
            toast(L('MIDI CONTROL MAPPED', 'CONTROL MIDI ASIGNADO'));
        }
        for (const mapping of project.midiMappings.filter((item) => item.channel === channel && item.controller === data1))
            applyMidiMapping(mapping, data2 / 127);
        if (data1 === 74) {
            s.timbre = data2 / 127;
            updateHeld(channel, 'timbre', s.timbre);
        }
        return;
    } if (command === 0x90 && data2) {
        if (activeView === 'launch' && data1 >= 36 && data1 < 64) {
            const cells = $$('[data-launch-clip]'), cell = cells[data1 - 36];
            if (cell)
                launchClip(cell.dataset.launchTrack, cell.dataset.launchClip);
        }
        else
            startPerformance(key, pitch, data2 / 127, null, { ...s, pressure: data2 / 127 }, channel);
    } if (command === 0x80 || (command === 0x90 && !data2))
        endPerformance(key); };
    for (const input of access.inputs.values())
        bind(input);
    access.onstatechange = e => { if (e.port?.type === 'input' && e.port.state === 'connected')
        bind(e.port); };
}
catch {
    toast('MIDI ACCESS UNAVAILABLE');
} }
setupSamplerKeyboard();
setupSamplerOctaveControls();
const query = new URLSearchParams(location.search);
loadQuickHandles();
initWorkflowUi();
initLearning();
setupScratchDeck();
setupStudioExtensions();
setupPrecisionControls();
setupArrangeTools();
setupLauncher();
setupLibraries();
setupV6Studio();
setupMidiLearnUi();
setupV6Safety();
setupV6Copy();
setupSampleSlicing();
setupProjectTemplates();
renderAll();
applyLanguage();
loadLocalSamples();
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
function syncStudioUi() {
    const context = $('#clipContext');
    if (!context)
        return;
    const c = clip();
    context.textContent = `${TRACK_META[selectedTrack].label} → ${c.name} · ${c.bars} ${L('bars', 'compases')}`;
    document.body.classList.toggle('sound-panel', soundPanel);
    document.body.dataset.editorTool = editorTool;
    $$('[data-studio-tab]').forEach((b) => { const tab = b.dataset.studioTab; const active = tab === 'sound' ? activeView === 'forge' && soundPanel : tab === 'clips' ? activeView === 'forge' && !soundPanel : activeView === tab; b.setAttribute('aria-pressed', String(active)); });
    $$('[data-editor-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.editorTool === editorTool)));
    const hint = $('#recordHint');
    hint.textContent = recordArmed ? L('Armed: keyboard / MIDI notes → active clip. Press Play to record.', 'Preparado: notas de teclado / MIDI → clip activo. Pulsa Play para grabar.') : L('Notes record into the active clip. Record Take captures audio in Perform.', 'Las notas se graban en el clip activo. Grabar toma captura audio en Perform.');
}
function duplicateSelectedNotes() {
    const c = clip(), notes = c.notes.filter(n => selectedNotes.has(n.id));
    if (!notes.length)
        return;
    const first = Math.min(...notes.map(n => n.step + n.offset)), last = Math.max(...notes.map(n => n.step + n.offset + n.length));
    const shift = Math.max(project.editor.snap, Math.ceil((last - first) / project.editor.snap) * project.editor.snap);
    if (last + shift > clipLengthSteps(c)) {
        toast(L('Not enough room. Increase the clip bars to duplicate these notes.', 'No hay espacio. Amplía los compases del clip para duplicar estas notas.'));
        return;
    }
    snapshot();
    const copies = notes.map(n => ({ ...structuredClone(n), id: cryptoId(), step: n.step + shift }));
    c.notes.push(...copies);
    selectedNotes = new Set(copies.map(n => n.id));
    changed();
    renderPiano();
    toast(L('Selected notes duplicated', 'Notas seleccionadas duplicadas'), true);
}
function quantizeSelectedNotes() {
    const c = clip(), notes = c.notes.filter(n => selectedNotes.has(n.id));
    if (!notes.length)
        return;
    snapshot();
    for (const n of notes) {
        n.step = Math.max(0, Math.min(clipLengthSteps(c) - project.editor.snap, Math.round((n.step + n.offset) / project.editor.snap) * project.editor.snap));
        n.offset = 0;
        n.length = Math.min(clipLengthSteps(c) - n.step, Math.max(project.editor.snap, Math.round(n.length / project.editor.snap) * project.editor.snap));
    }
    changed();
    renderPiano();
    toast(L('Selected notes quantized', 'Notas seleccionadas cuantizadas'), true);
}
function setupStudioUi() {
    const bar = document.createElement('div');
    bar.className = 'studio-context';
    bar.innerHTML = '<strong id="clipContext"></strong><div class="studio-tabs"></div><p id="recordHint"></p><p id="saveWarning" role="alert" hidden></p>';
    $('#forgeView').prepend(bar);
    const nav = document.createElement('nav');
    nav.className = 'mobile-studio-nav';
    nav.setAttribute('aria-label', 'Studio');
    document.body.append(nav);
    const choices = [['clips', 'Clips', 'Clips'], ['sound', 'Sound', 'Sonido'], ['arrange', 'Arrange', 'Arreglo'], ['mix', 'Mix', 'Mezcla']];
    for (const container of [bar.querySelector('.studio-tabs'), nav])
        for (const [tab, en, es] of choices) {
            const button = document.createElement('button');
            button.dataset.studioTab = tab;
            button.dataset.en = en;
            button.dataset.es = es;
            button.textContent = L(en, es);
            button.onclick = () => { soundPanel = tab === 'sound'; if (soundPanel)
                toggleFocus(false, true); activateView(tab === 'sound' || tab === 'clips' ? 'forge' : tab); if (window.matchMedia('(max-width:820px)').matches)
                document.querySelector('.workspace')?.scrollIntoView({ block: 'start' }); };
            container.append(button);
        }
    const tools = document.createElement('div');
    tools.className = 'editor-tools';
    tools.setAttribute('role', 'group');
    tools.setAttribute('aria-label', 'Editor tools');
    for (const [tool, en, es] of [['draw', 'Draw', 'Dibujar'], ['select', 'Select', 'Seleccionar'], ['navigate', 'Navigate', 'Navegar']]) {
        const button = document.createElement('button');
        button.dataset.editorTool = tool;
        button.dataset.en = en;
        button.dataset.es = es;
        button.textContent = L(en, es);
        button.onclick = () => { editorTool = tool; syncStudioUi(); };
        tools.append(button);
    }
    const newClip = document.createElement('button');
    newClip.dataset.en = '+ New clip';
    newClip.dataset.es = '+ Nuevo clip';
    newClip.textContent = L('+ New clip', '+ Nuevo clip');
    newClip.onclick = () => $('#newClipBtn').click();
    tools.append(newClip);
    const undo = document.createElement('button');
    undo.dataset.en = 'Undo';
    undo.dataset.es = 'Deshacer';
    undo.textContent = L('Undo', 'Deshacer');
    undo.onclick = () => $('#undoBtn').click();
    tools.append(undo);
    $('.piano-shell').before(tools);
    const selection = document.createElement('div');
    selection.className = 'selection-actions';
    selection.setAttribute('role', 'group');
    selection.setAttribute('aria-label', L('Selected notes', 'Notas seleccionadas'));
    for (const [action, en, es] of [['duplicate', 'Duplicate notes', 'Duplicar notas'], ['quantize', 'Quantize notes', 'Cuantizar notas'], ['delete', 'Delete notes', 'Borrar notas']]) {
        const button = document.createElement('button');
        button.dataset.selectionAction = action;
        button.dataset.en = en;
        button.dataset.es = es;
        button.textContent = L(en, es);
        button.onclick = action === 'duplicate' ? duplicateSelectedNotes : action === 'quantize' ? quantizeSelectedNotes : deleteSelection;
        selection.append(button);
    }
    tools.after(selection);
    renderSelection();
    const automation = document.createElement('details');
    automation.className = 'automation-disclosure';
    const automationLabel = document.createElement('summary');
    automationLabel.dataset.en = 'Clip automation';
    automationLabel.dataset.es = 'Automatización del clip';
    automationLabel.textContent = L(automationLabel.dataset.en, automationLabel.dataset.es);
    automation.append(automationLabel);
    $('.automation-head').before(automation);
    automation.append($('.automation-head'), $('#automationPane'));
    automation.addEventListener('toggle', () => { if (automation.open) {
        renderAutomation();
        syncRollScroll();
    } });
    const advanced = document.createElement('details');
    advanced.className = 'export-advanced';
    const summary = document.createElement('summary');
    summary.dataset.en = 'Advanced export options';
    summary.dataset.es = 'Opciones avanzadas de exportación';
    summary.textContent = L(summary.dataset.en, summary.dataset.es);
    advanced.append(summary);
    $('.export-options').before(advanced);
    advanced.append($('.export-options'), $('.stem-selection'));
    const quick = document.createElement('div');
    quick.className = 'export-simple';
    for (const [kind, en, es] of [['bundle', 'Save complete project', 'Guardar proyecto completo'], ['wav', 'Export audio', 'Exportar audio'], ['midi', 'Export MIDI', 'Exportar MIDI']]) {
        const button = document.createElement('button');
        button.dataset.en = en;
        button.dataset.es = es;
        button.textContent = L(en, es);
        button.onclick = () => performExport(kind, true);
        quick.append(button);
    }
    advanced.before(quick);
    const other = document.createElement('details');
    other.className = 'export-advanced';
    const otherLabel = document.createElement('summary');
    otherLabel.dataset.en = 'More formats and linked destinations';
    otherLabel.dataset.es = 'Más formatos y destinos vinculados';
    otherLabel.textContent = L(otherLabel.dataset.en, otherLabel.dataset.es);
    other.append(otherLabel);
    $('.export-grid').before(other);
    other.append($('.export-grid'));
    const music = document.createElement('details');
    music.className = 'composition-options';
    const musicLabel = document.createElement('summary');
    musicLabel.dataset.en = 'Generate music and harmony';
    musicLabel.dataset.es = 'Generar música y armonía';
    musicLabel.textContent = L(musicLabel.dataset.en, musicLabel.dataset.es);
    music.append(musicLabel);
    $('.composition-tools').before(music);
    music.append($('.harmony'), $('.generators'));
    const transport = $('.transport'), anchor = document.createComment('transport');
    transport.before(anchor);
    const mobile = window.matchMedia('(max-width:820px)');
    const placeTransport = () => { $('#uiScale').disabled = mobile.matches; $('#uiScale').title = mobile.matches ? L('Mobile uses the device scale', 'En móvil se utiliza la escala del dispositivo') : ''; if (mobile.matches)
        document.body.append(transport);
    else
        anchor.parentNode.insertBefore(transport, anchor.nextSibling); };
    mobile.addEventListener('change', placeTransport);
    placeTransport();
    const copy = [['#duplicateBtn', 'Duplicate clip', 'Duplicar clip'], ['#mutateBtn', 'Create variation', 'Crear variación'], ['#quantizeBtn', 'Quantize clip', 'Cuantizar clip'], ['#deleteNotesBtn', 'Delete notes', 'Borrar notas'], ['#backingBtn', 'Create backing', 'Crear base'], ['#clearAutomationBtn', 'Clear lane', 'Borrar curva'], ['#exportDialog h2', 'Save and export', 'Guardar y exportar'], ['#exportDialog>p', 'Save a complete project to keep your audio assets. Audio and MIDI exports are for sharing your music.', 'Guarda el proyecto completo para conservar tus archivos de audio. Exporta audio o MIDI para compartir tu música.']];
    for (const [selector, en, es] of copy) {
        const node = $(selector);
        if (node) {
            node.dataset.en = en;
            node.dataset.es = es;
            node.textContent = L(en, es);
        }
    }
    const translate = () => { $$('[data-en][data-es]').forEach((el) => el.textContent = L(el.dataset.en, el.dataset.es)); syncStudioUi(); };
    $('#languageSelect').addEventListener('change', translate);
    $('#menuLanguageSelect').addEventListener('change', translate);
    syncStudioUi();
}
setupStudioUi();
