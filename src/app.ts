import { captureMusicalContext } from "./ai/composer";
import { requestConfirmation } from "./ui/dialogs";
import {
  buildPresetClip,
  commitPresetClip,
  validateSoundPreset,
} from "./ai/presets";
import * as workflow from "./features/workflow";
import * as storage from "./features/storage";
import * as performanceFeature from "./features/performance";
import * as instruments from "./features/instruments";
import * as audio_studio from "./features/audio-studio";
import * as launcher from "./features/launcher";
import * as arrangement from "./features/arrangement";
import * as mixer from "./features/mixer";
import * as scratch from "./features/scratch";
import * as sampler from "./features/sampler";
// Shared runtime state is injected into feature controllers; UI components never own audio lifetime.
const runtime = {
  get reportError() {
    return reportError;
  },
  get $() {
    return $;
  },
  get $$() {
    return $$;
  },
  get STORAGE() {
    return STORAGE;
  },
  get LEGACY_V5() {
    return LEGACY_V5;
  },
  get LEGACY_V4() {
    return LEGACY_V4;
  },
  get LEGACY_V3() {
    return LEGACY_V3;
  },
  get LEGACY() {
    return LEGACY;
  },
  get VERSIONS() {
    return VERSIONS;
  },
  get UI_STORAGE() {
    return UI_STORAGE;
  },
  get LANGUAGE_STORAGE() {
    return LANGUAGE_STORAGE;
  },
  get project() {
    return project;
  },
  set project(value: typeof project) {
    project = value;
  },
  get selectedTrack() {
    return selectedTrack;
  },
  set selectedTrack(value: typeof selectedTrack) {
    selectedTrack = value;
  },
  get selectedNotes() {
    return selectedNotes;
  },
  set selectedNotes(value: typeof selectedNotes) {
    selectedNotes = value;
  },
  get currentStep() {
    return currentStep;
  },
  set currentStep(value: typeof currentStep) {
    currentStep = value;
  },
  get currentScene() {
    return currentScene;
  },
  set currentScene(value: typeof currentScene) {
    currentScene = value;
  },
  get transportPosition() {
    return transportPosition;
  },
  set transportPosition(value: typeof transportPosition) {
    transportPosition = value;
  },
  get globalStartStep() {
    return globalStartStep;
  },
  set globalStartStep(value: typeof globalStartStep) {
    globalStartStep = value;
  },
  get draggedScene() {
    return draggedScene;
  },
  set draggedScene(value: typeof draggedScene) {
    draggedScene = value;
  },
  get recordArmed() {
    return recordArmed;
  },
  set recordArmed(value: typeof recordArmed) {
    recordArmed = value;
  },
  get metronome() {
    return metronome;
  },
  set metronome(value: typeof metronome) {
    metronome = value;
  },
  get saveTimer() {
    return saveTimer;
  },
  set saveTimer(value: typeof saveTimer) {
    saveTimer = value;
  },
  get animation() {
    return animation;
  },
  set animation(value: typeof animation) {
    animation = value;
  },
  get clipboard() {
    return clipboard;
  },
  set clipboard(value: typeof clipboard) {
    clipboard = value;
  },
  get recording() {
    return recording;
  },
  set recording(value: typeof recording) {
    recording = value;
  },
  get rollScroll() {
    return rollScroll;
  },
  set rollScroll(value: typeof rollScroll) {
    rollScroll = value;
  },
  get activeView() {
    return activeView;
  },
  set activeView(value: typeof activeView) {
    activeView = value;
  },
  get commandIndex() {
    return commandIndex;
  },
  set commandIndex(value: typeof commandIndex) {
    commandIndex = value;
  },
  get pendingDeleteClipId() {
    return pendingDeleteClipId;
  },
  set pendingDeleteClipId(value: typeof pendingDeleteClipId) {
    pendingDeleteClipId = value;
  },
  get suppressSequencerClick() {
    return suppressSequencerClick;
  },
  set suppressSequencerClick(value: typeof suppressSequencerClick) {
    suppressSequencerClick = value;
  },
  get scratchBuffer() {
    return scratchBuffer;
  },
  set scratchBuffer(value: typeof scratchBuffer) {
    scratchBuffer = value;
  },
  get scratchAnimation() {
    return scratchAnimation;
  },
  set scratchAnimation(value: typeof scratchAnimation) {
    scratchAnimation = value;
  },
  get scratchAngle() {
    return scratchAngle;
  },
  set scratchAngle(value: typeof scratchAngle) {
    scratchAngle = value;
  },
  get scratchLastFrame() {
    return scratchLastFrame;
  },
  set scratchLastFrame(value: typeof scratchLastFrame) {
    scratchLastFrame = value;
  },
  get scratchStuttering() {
    return scratchStuttering;
  },
  set scratchStuttering(value: typeof scratchStuttering) {
    scratchStuttering = value;
  },
  get performanceTake() {
    return performanceTake;
  },
  set performanceTake(value: typeof performanceTake) {
    performanceTake = value;
  },
  get performanceStarted() {
    return performanceStarted;
  },
  set performanceStarted(value: typeof performanceStarted) {
    performanceStarted = value;
  },
  get performanceTimer() {
    return performanceTimer;
  },
  set performanceTimer(value: typeof performanceTimer) {
    performanceTimer = value;
  },
  get mixerReference() {
    return mixerReference;
  },
  set mixerReference(value: typeof mixerReference) {
    mixerReference = value;
  },
  get mixerComparing() {
    return mixerComparing;
  },
  set mixerComparing(value: typeof mixerComparing) {
    mixerComparing = value;
  },
  get activePerformanceTakeId() {
    return activePerformanceTakeId;
  },
  set activePerformanceTakeId(value: typeof activePerformanceTakeId) {
    activePerformanceTakeId = value;
  },
  get performanceEvents() {
    return performanceEvents;
  },
  set performanceEvents(value: typeof performanceEvents) {
    performanceEvents = value;
  },
  get exportController() {
    return exportController;
  },
  set exportController(value: typeof exportController) {
    exportController = value;
  },
  get launcherCapturing() {
    return launcherCapturing;
  },
  set launcherCapturing(value: typeof launcherCapturing) {
    launcherCapturing = value;
  },
  get launcherSnapshots() {
    return launcherSnapshots;
  },
  set launcherSnapshots(value: typeof launcherSnapshots) {
    launcherSnapshots = value;
  },
  get selectedScenes() {
    return selectedScenes;
  },
  set selectedScenes(value: typeof selectedScenes) {
    selectedScenes = value;
  },
  get sceneClipboard() {
    return sceneClipboard;
  },
  set sceneClipboard(value: typeof sceneClipboard) {
    sceneClipboard = value;
  },
  get mixerPeaks() {
    return mixerPeaks;
  },
  set mixerPeaks(value: typeof mixerPeaks) {
    mixerPeaks = value;
  },
  get lastRecovery() {
    return lastRecovery;
  },
  set lastRecovery(value: typeof lastRecovery) {
    lastRecovery = value;
  },
  get clipStartSteps() {
    return clipStartSteps;
  },
  get samplerArmed() {
    return samplerArmed;
  },
  set samplerArmed(value: typeof samplerArmed) {
    samplerArmed = value;
  },
  get loadedSamplerAssetId() {
    return loadedSamplerAssetId;
  },
  set loadedSamplerAssetId(value: typeof loadedSamplerAssetId) {
    loadedSamplerAssetId = value;
  },
  get samplerQwertyBase() {
    return samplerQwertyBase;
  },
  set samplerQwertyBase(value: typeof samplerQwertyBase) {
    samplerQwertyBase = value;
  },
  get samplerHeld() {
    return samplerHeld;
  },
  get toastTimer() {
    return toastTimer;
  },
  set toastTimer(value: typeof toastTimer) {
    toastTimer = value;
  },
  get editorTool() {
    return editorTool;
  },
  set editorTool(value: typeof editorTool) {
    editorTool = value;
  },
  get soundPanel() {
    return soundPanel;
  },
  set soundPanel(value: typeof soundPanel) {
    soundPanel = value;
  },
  get language() {
    return language;
  },
  set language(value: typeof language) {
    language = value;
  },
  get tutorialStep() {
    return tutorialStep;
  },
  set tutorialStep(value: typeof tutorialStep) {
    tutorialStep = value;
  },
  get helpMode() {
    return helpMode;
  },
  set helpMode(value: typeof helpMode) {
    helpMode = value;
  },
  get L() {
    return L;
  },
  get history() {
    return history;
  },
  get engine() {
    return engine;
  },
  get presets() {
    return presets;
  },
  get keyMap() {
    return keyMap;
  },
  get pitchNames() {
    return pitchNames;
  },
  get samplerQwertyPitches() {
    return samplerQwertyPitches;
  },
  get samplerQwertyMap() {
    return samplerQwertyMap;
  },
  get loadProject() {
    return loadProject;
  },
  get esc() {
    return esc;
  },
  get snapshot() {
    return snapshot;
  },
  get changed() {
    return changed;
  },
  get toast() {
    return toast;
  },
  get download() {
    return download;
  },
  get quickHandles() {
    return quickHandles;
  },
  get QUICK_HANDLE_DB() {
    return QUICK_HANDLE_DB;
  },
  get LAST_EXPORT() {
    return LAST_EXPORT;
  },
  get quickHandleDb() {
    return quickHandleDb;
  },
  get ASSET_DB() {
    return ASSET_DB;
  },
  get assetDb() {
    return assetDb;
  },
  get putAsset() {
    return putAsset;
  },
  get getAsset() {
    return getAsset;
  },
  get deleteAsset() {
    return deleteAsset;
  },
  get renderExportTargets() {
    return renderExportTargets;
  },
  get showQuickHandle() {
    return showQuickHandle;
  },
  get loadQuickHandles() {
    return loadQuickHandles;
  },
  get rememberQuickHandle() {
    return rememberQuickHandle;
  },
  get forgetExportTarget() {
    return forgetExportTarget;
  },
  get prepareQuickExport() {
    return prepareQuickExport;
  },
  get writeQuickExport() {
    return writeQuickExport;
  },
  get quickExportProject() {
    return quickExportProject;
  },
  get safeName() {
    return safeName;
  },
  get clip() {
    return clip;
  },
  get pitches() {
    return pitches;
  },
  get staticCopy() {
    return staticCopy;
  },
  get leadingCopy() {
    return leadingCopy;
  },
  get shortcutCopy() {
    return shortcutCopy;
  },
  get controlDescriptions() {
    return controlDescriptions;
  },
  get applyLanguage() {
    return applyLanguage;
  },
  get controlInfo() {
    return controlInfo;
  },
  get installControlHelp() {
    return installControlHelp;
  },
  get showHelpIntro() {
    return showHelpIntro;
  },
  get toggleHelp() {
    return toggleHelp;
  },
  get showControlHelp() {
    return showControlHelp;
  },
  get tutorialSteps() {
    return tutorialSteps;
  },
  get showTutorialStep() {
    return showTutorialStep;
  },
  get startTutorial() {
    return startTutorial;
  },
  get endTutorial() {
    return endTutorial;
  },
  get initLearning() {
    return initLearning;
  },
  get renderTracks() {
    return renderTracks;
  },
  get renderInspector() {
    return renderInspector;
  },
  get applyPreset() {
    return applyPreset;
  },
  get renderArp() {
    return renderArp;
  },
  get renderFx() {
    return renderFx;
  },
  get macroMarkup() {
    return macroMarkup;
  },
  get renderClipControls() {
    return renderClipControls;
  },
  get updateDeleteClipDialog() {
    return updateDeleteClipDialog;
  },
  get requestClipDelete() {
    return requestClipDelete;
  },
  get renderHarmony() {
    return renderHarmony;
  },
  get renderPiano() {
    return renderPiano;
  },
  get bindMarqueeSelection() {
    return bindMarqueeSelection;
  },
  get bindNoteDrag() {
    return bindNoteDrag;
  },
  get syncSelectedClasses() {
    return syncSelectedClasses;
  },
  get syncRollScroll() {
    return syncRollScroll;
  },
  get setDefaultScroll() {
    return setDefaultScroll;
  },
  get renderSelection() {
    return renderSelection;
  },
  get editSelection() {
    return editSelection;
  },
  get deleteSelection() {
    return deleteSelection;
  },
  get renderAutomation() {
    return renderAutomation;
  },
  get heldKeyPointers() {
    return heldKeyPointers;
  },
  get releaseKeyPointer() {
    return releaseKeyPointer;
  },
  get releaseKeyPointers() {
    return releaseKeyPointers;
  },
  get instrumentOctave() {
    return instrumentOctave;
  },
  set instrumentOctave(value: typeof instrumentOctave) {
    instrumentOctave = value;
  },
  get renderKeyboard() {
    return renderKeyboard;
  },
  get startPerformance() {
    return startPerformance;
  },
  get endPerformance() {
    return endPerformance;
  },
  get launcherSnapshot() {
    return launcherSnapshot;
  },
  get launchClip() {
    return launchClip;
  },
  get renderLauncher() {
    return renderLauncher;
  },
  get setupLauncher() {
    return setupLauncher;
  },
  get renderArrangement() {
    return renderArrangement;
  },
  get sceneLength() {
    return sceneLength;
  },
  get focusScene() {
    return focusScene;
  },
  get updatePlayheads() {
    return updatePlayheads;
  },
  get updatePosition() {
    return updatePosition;
  },
  get updateOrb() {
    return updateOrb;
  },
  get songLength() {
    return songLength;
  },
  get formatLocator() {
    return formatLocator;
  },
  get setGlobalStart() {
    return setGlobalStart;
  },
  get setClipStart() {
    return setClipStart;
  },
  get renderLocators() {
    return renderLocators;
  },
  get syncLocatorsFromPlayback() {
    return syncLocatorsFromPlayback;
  },
  get renderMixer() {
    return renderMixer;
  },
  get animateMixer() {
    return animateMixer;
  },
  get setScratchControls() {
    return setScratchControls;
  },
  get updateScratchPlayButton() {
    return updateScratchPlayButton;
  },
  get drawScratchWaveform() {
    return drawScratchWaveform;
  },
  get armScratchBuffer() {
    return armScratchBuffer;
  },
  get importScratchFile() {
    return importScratchFile;
  },
  get audioRegionScratchBuffer() {
    return audioRegionScratchBuffer;
  },
  get loadAudioRegionIntoScratch() {
    return loadAudioRegionIntoScratch;
  },
  get captureScratchMix() {
    return captureScratchMix;
  },
  get animateScratchDeck() {
    return animateScratchDeck;
  },
  get scratchMotorRate() {
    return scratchMotorRate;
  },
  get setupScratchPro() {
    return setupScratchPro;
  },
  get setupScratchDeck() {
    return setupScratchDeck;
  },
  get performanceEventThrottle() {
    return performanceEventThrottle;
  },
  get performanceStep() {
    return performanceStep;
  },
  get recordPerformanceEvent() {
    return recordPerformanceEvent;
  },
  get loadPerformanceAudio() {
    return loadPerformanceAudio;
  },
  get applyPerformanceEvent() {
    return applyPerformanceEvent;
  },
  get playPerformanceTake() {
    return playPerformanceTake;
  },
  get openTakeEditor() {
    return openTakeEditor;
  },
  get renderPerformanceTakes() {
    return renderPerformanceTakes;
  },
  get togglePerformanceCapture() {
    return togglePerformanceCapture;
  },
  get mixSnapshot() {
    return mixSnapshot;
  },
  get captureMixerReference() {
    return captureMixerReference;
  },
  get toggleMixerReference() {
    return toggleMixerReference;
  },
  get setupArrangeTools() {
    return setupArrangeTools;
  },
  get USER_PRESETS() {
    return USER_PRESETS;
  },
  get PRESET_FAVORITES() {
    return PRESET_FAVORITES;
  },
  get userPresets() {
    return userPresets;
  },
  get saveUserPresets() {
    return saveUserPresets;
  },
  get presetFavorites() {
    return presetFavorites;
  },
  get renderPresetLibrary() {
    return renderPresetLibrary;
  },
  get saveCurrentPreset() {
    return saveCurrentPreset;
  },
  get loadLocalSample() {
    return loadLocalSample;
  },
  get loadLocalSamples() {
    return loadLocalSamples;
  },
  get renderSampleSlots() {
    return renderSampleSlots;
  },
  get setupLibraries() {
    return setupLibraries;
  },
  get setupPrecisionControls() {
    return setupPrecisionControls;
  },
  get setupStudioExtensions() {
    return setupStudioExtensions;
  },
  get readUiPrefs() {
    return readUiPrefs;
  },
  get writeUiPrefs() {
    return writeUiPrefs;
  },
  get setRackCollapsed() {
    return setRackCollapsed;
  },
  get toggleFocus() {
    return toggleFocus;
  },
  get selectTrack() {
    return selectTrack;
  },
  get commands() {
    return commands;
  },
  get matchingCommands() {
    return matchingCommands;
  },
  get renderCommands() {
    return renderCommands;
  },
  get runCommand() {
    return runCommand;
  },
  get openCommands() {
    return openCommands;
  },
  get initWorkflowUi() {
    return initWorkflowUi;
  },
  get renderVersions() {
    return renderVersions;
  },
  get loadVersions() {
    return loadVersions;
  },
  get saveVersion() {
    return saveVersion;
  },
  get inputRecorder() {
    return inputRecorder;
  },
  set inputRecorder(value: typeof inputRecorder) {
    inputRecorder = value;
  },
  get inputStream() {
    return inputStream;
  },
  set inputStream(value: typeof inputStream) {
    inputStream = value;
  },
  get inputChunks() {
    return inputChunks;
  },
  set inputChunks(value: typeof inputChunks) {
    inputChunks = value;
  },
  get midiLearnTarget() {
    return midiLearnTarget;
  },
  set midiLearnTarget(value: typeof midiLearnTarget) {
    midiLearnTarget = value;
  },
  get applyMidiMapping() {
    return applyMidiMapping;
  },
  get audioBufferWav() {
    return audioBufferWav;
  },
  get addAudioBlob() {
    return addAudioBlob;
  },
  get loadAudioAssets() {
    return loadAudioAssets;
  },
  get renderAudioStudio() {
    return renderAudioStudio;
  },
  get renderGlobalAutomation() {
    return renderGlobalAutomation;
  },
  get renderMixGroups() {
    return renderMixGroups;
  },
  get renderTempoMap() {
    return renderTempoMap;
  },
  get samplerSettings() {
    return samplerSettings;
  },
  get setupSamplerOctaveControls() {
    return setupSamplerOctaveControls;
  },
  get samplerNoteName() {
    return samplerNoteName;
  },
  get drawSamplerWaveform() {
    return drawSamplerWaveform;
  },
  get startSamplerPerformance() {
    return startSamplerPerformance;
  },
  get endSamplerPerformance() {
    return endSamplerPerformance;
  },
  get renderSamplerKeyboard() {
    return renderSamplerKeyboard;
  },
  get loadSamplerAsset() {
    return loadSamplerAsset;
  },
  get setupSamplerKeyboard() {
    return setupSamplerKeyboard;
  },
  get setupV6Studio() {
    return setupV6Studio;
  },
  get setupMidiLearnUi() {
    return setupMidiLearnUi;
  },
  get setupV6Copy() {
    return setupV6Copy;
  },
  get setupV6Safety() {
    return setupV6Safety;
  },
  get setupSampleSlicing() {
    return setupSampleSlicing;
  },
  get setupProjectTemplates() {
    return setupProjectTemplates;
  },
  get renderAll() {
    return renderAll;
  },
  get syncTransportButtons() {
    return syncTransportButtons;
  },
  get pausePlayback() {
    return pausePlayback;
  },
  get togglePlay() {
    return togglePlay;
  },
  get animateMeter() {
    return animateMeter;
  },
  get wavOptions() {
    return wavOptions;
  },
  get setExportProgress() {
    return setExportProgress;
  },
  get exportWav() {
    return exportWav;
  },
  get crc32() {
    return crc32;
  },
  get zipFiles() {
    return zipFiles;
  },
  get readStoreZip() {
    return readStoreZip;
  },
  get importProjectFile() {
    return importProjectFile;
  },
  get renderStems() {
    return renderStems;
  },
  get renderProjectBundle() {
    return renderProjectBundle;
  },
  get exportMeta() {
    return exportMeta;
  },
  get exportName() {
    return exportName;
  },
  get performExport() {
    return performExport;
  },
  get quickExportWav() {
    return quickExportWav;
  },
  get quickExportMidi() {
    return quickExportMidi;
  },
  get repeatLastExport() {
    return repeatLastExport;
  },
  get activateView() {
    return activateView;
  },
  get compatibility() {
    return compatibility;
  },
  get showCompatibility() {
    return showCompatibility;
  },
  get open() {
    return open;
  },
  get replaceProject() {
    return replaceProject;
  },
  get initMidi() {
    return initMidi;
  },
  get query() {
    return query;
  },
  get copyQueued() {
    return copyQueued;
  },
  set copyQueued(value: typeof copyQueued) {
    copyQueued = value;
  },
  get syncStudioUi() {
    return syncStudioUi;
  },
  get duplicateSelectedNotes() {
    return duplicateSelectedNotes;
  },
  get quantizeSelectedNotes() {
    return quantizeSelectedNotes;
  },
  get setupStudioUi() {
    return setupStudioUi;
  },
  get setupConsistentControls() {
    return setupConsistentControls;
  },
};
export type RuntimeContext = typeof runtime;
import { t as msg, setLanguage, translateDOM, translate } from "./ui/i18n";
import { mountKeyboard, releaseAllKeyboards } from "./ui/components/keyboard";
import { mountDial } from "./ui/components/dial";
import { studioBridge, type StudioView } from "./ui/bridge";
import {
  createProject,
  createEmptyProject,
  migrateProject,
  activeClip,
  clipsForTrack,
  createClip,
  clipLengthSteps,
  meterSteps,
  setProjectMeter,
  makeNote,
  duplicateClip,
  deleteClip,
  varyClip,
  resizeClip,
  quantizeClip,
  automationValue,
  generateClip,
  generateBacking,
  encodeMidi,
  playbackEvents,
  History,
  TRACKS,
  TRACK_META,
  DRUM_NAMES,
  SCALES,
  KEYS,
  addArrangementScene,
  duplicateArrangementScene,
  moveArrangementScene,
  removeArrangementScene,
  distributeArrangementPatterns,
  isInScale,
  createPerformanceTake,
  quantizePerformanceTake,
  captureLauncherScenes,
  duplicateArrangementSelection,
  removeArrangementSelection,
  dbToGain,
  gainToDb,
  createAudioLane,
  createAudioRegion,
  audioRegionRate,
  createAutomationLane,
  detectTransientSlices,
  transformNotes,
  cryptoId,
  samplerDefaults,
} from "./core.js";
import { AudioEngine, renderWav } from "./audio.js";
import type {
  AudioLane,
  AudioRegion,
  AutomationLane,
  Clip,
  MidiMapping,
  ModulationRoute,
  NoteEvent,
  NoteExpression,
  PerformanceEvent,
  PerformanceTake,
  Project,
  SampleAsset,
  SamplerInstrument,
  TrackId,
  TrackState,
} from "./model.js";

declare global {
  interface Window {
    __kvErrors: string[];
    __kvDiagnostics: () => ReturnType<AudioEngine["diagnostics"]>;
    webkitAudioContext?: typeof AudioContext;
    showSaveFilePicker?: (options: Record<string, unknown>) => Promise<any>;
  }
}

window.__kvErrors = [];
function reportError(message: unknown): any {
  return workflow.reportError(runtime, message);
}
window.addEventListener("error", (e) => reportError(e.message));
window.addEventListener("unhandledrejection", (e) =>
  reportError(String(e.reason?.message || e.reason)),
);

const $ = (s: string): any => document.querySelector(s),
  $$ = (s: string): any[] => [...document.querySelectorAll(s)],
  STORAGE = "kiber-vengance-project-v6",
  LEGACY_V5 = "kiber-vengance-project-v5",
  LEGACY_V4 = "kiber-vengance-project-v4",
  LEGACY_V3 = "kiber-vengance-project-v3",
  LEGACY = "kiber-vengance-project-v2",
  VERSIONS = "kiber-vengance-versions-v1",
  UI_STORAGE = "kiber-vengance-ui-v1",
  LANGUAGE_STORAGE = "kiber-vengance-language-v1";
let copyQueued = false;
let project: any = loadProject(),
  selectedTrack: TrackId = "lead",
  selectedNotes = new Set<string>(),
  currentStep = -1,
  currentScene = -1,
  transportPosition = 0,
  globalStartStep = 0,
  draggedScene = -1,
  recordArmed = false,
  metronome = false,
  saveTimer: ReturnType<typeof setTimeout> | undefined,
  animation = 0,
  clipboard: NoteEvent[] = [],
  recording = new Map<string, any>(),
  rollScroll: any = {},
  activeView = "forge",
  commandIndex = 0,
  pendingDeleteClipId: string | null = null,
  suppressSequencerClick = false,
  scratchBuffer: AudioBuffer | null = null,
  scratchAnimation = 0,
  scratchAngle = 0,
  scratchLastFrame = performance.now(),
  scratchStuttering = false,
  performanceTake: Blob | null = null,
  performanceStarted = 0,
  performanceTimer: ReturnType<typeof setInterval> | null = null,
  mixerReference: any = null,
  mixerComparing = false,
  activePerformanceTakeId: string | null = null,
  performanceEvents: PerformanceEvent[] | null = null,
  exportController: AbortController | null = null,
  launcherCapturing = false,
  launcherSnapshots: Array<{
    name: string;
    clipIds: Record<TrackId, string>;
    repeats: number;
  }> = [],
  selectedScenes = new Set<number>(),
  sceneClipboard: any[] = [],
  mixerPeaks: Partial<Record<TrackId, number>> = {},
  lastRecovery = 0;
const clipStartSteps = new Map<string, number>();
let samplerArmed = false,
  loadedSamplerAssetId: string | null = null,
  samplerQwertyBase = 60;
const samplerHeld = new Map<string, HTMLElement>();
let toastTimer: ReturnType<typeof setTimeout>;
let editorTool: "draw" | "select" | "navigate" = "draw";
let soundPanel = false;
type Language = "en" | "es";
let language: Language =
    localStorage.getItem(LANGUAGE_STORAGE) === "es" ? "es" : "en",
  tutorialStep = 0,
  helpMode = false;
const L = translate;
const history = new History<any>();
const engine = new AudioEngine(
  (
    step: number,
    time: number,
    scene: number,
    info: Record<string, any> = {},
  ) => {
    if (step === -2) {
      $("#audioState").textContent = `COUNT ${info.countIn}`;
      return;
    }
    currentStep = step;
    currentScene = scene;
    if (step >= 0) transportPosition = Number(info.position ?? step);
    if (step < 0) $("#audioState").textContent = "STANDBY";
    else $("#audioState").textContent = "RUNNING";
    requestAnimationFrame(() => {
      updatePlayheads();
      updatePosition();
      syncLocatorsFromPlayback();
    });
  },
);
engine.project = project;
window.__kvDiagnostics = () => engine.diagnostics();
engine.onScratchGesture = (target: string, value: number | boolean) =>
  recordPerformanceEvent("scratch", target, value);
const presets = {
  lead: ["Razor Choir", "Neon Talon", "Solar Vengeance"],
  guitar: ["Chrome Strings", "Voltage Chug", "Glass Horizon"],
  bass: ["Foundry Pulse", "Black Reactor", "Grind Theory"],
  pad: ["Afterlight", "Frozen Cathedral", "Signal Ghost"],
  drums: ["Titan Frame", "Riot Assembly", "Chrome Bones"],
};
const keyMap = "awsedftgyhujk",
  drumKeyMap = "asdfghj",
  pitchNames = [
    "C",
    "C♯",
    "D",
    "D♯",
    "E",
    "F",
    "F♯",
    "G",
    "G♯",
    "A",
    "A♯",
    "B",
  ],
  samplerQwertyPitches = [60, 62, 64, 65, 67, 69, 71, 72],
  samplerQwertyMap: Record<string, number> = {
    a: 0,
    w: 1,
    s: 2,
    e: 3,
    d: 4,
    f: 5,
    t: 6,
    g: 7,
    y: 8,
    h: 9,
    u: 10,
    j: 11,
    k: 12,
  };

function loadProject() {
  for (const key of [STORAGE, LEGACY_V5, LEGACY_V4, LEGACY_V3, LEGACY])
    try {
      const value = localStorage.getItem(key);
      if (value) return migrateProject(JSON.parse(value));
    } catch {}
  return createProject();
}
function esc(v: any) {
  return String(v).replace(
    /[&<>'"]/g,
    (c) =>
      (
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        }) as Record<string, string>
      )[c]!,
  );
}
function snapshot() {
  history.push(project);
}
function changed(render = false) {
  project.modifiedAt = Date.now();
  $("#saveState").textContent = msg("ui_56a2285c5b11");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(project));
      $("#saveState").textContent = msg("ui_87222e82bf5d");
      $("#saveWarning")?.setAttribute("hidden", "");
    } catch {
      $("#saveState").textContent = msg("ui_3d56409d02fb");
      const warning = $("#saveWarning");
      if (warning) {
        warning.hidden = false;
        warning.textContent = msg("ui_008e26ff915f");
      }
      return;
    }
    if (Date.now() - lastRecovery > 60000) {
      try {
        const list = loadVersions();
        list.unshift({
          id: cryptoId(),
          label: `AUTO RECOVERY · ${project.title}`,
          date: Date.now(),
          project: structuredClone(project),
        });
        localStorage.setItem(VERSIONS, JSON.stringify(list.slice(0, 20)));
        lastRecovery = Date.now();
      } catch {
        toast(msg("ui_0af7730f9e25"));
      }
    }
  }, 350);
  engine.setProject(project);
  if (project.sampler?.assetId !== loadedSamplerAssetId)
    void loadSamplerAsset();
  if (render) renderAll();
  syncStudioUi();
}
function toast(message: any, undo = false) {
  clearTimeout(toastTimer);
  const el = $("#toast");
  el.textContent = message;
  if (undo) {
    const button = document.createElement("button");
    button.textContent = msg("ui_39fc72124884");
    button.onclick = () => {
      $("#undoBtn").click();
      el.classList.remove("show");
    };
    el.append(button);
  }
  el.classList.add("show");
  toastTimer = setTimeout(
    () => el.classList.remove("show"),
    undo ? 6000 : 2500,
  );
}
function download(
  data: any,
  name: string,
  type = "application/octet-stream",
): any {
  return storage.download(runtime, data, name, type);
}
type QuickExportKind =
  | "wav"
  | "midi"
  | "project"
  | "clip-wav"
  | "clip-midi"
  | "stems"
  | "bundle"
  | "performance";
type QuickTarget = {
  handle: any | null;
  fallback: boolean;
  cancelled: boolean;
  name: string;
  type: string;
};
const quickHandles = new Map<QuickExportKind, any>(),
  QUICK_HANDLE_DB = "kiber-vengance-file-handles-v1",
  LAST_EXPORT = "kiber-vengance-last-export-v1";
function quickHandleDb(): any {
  return workflow.quickHandleDb(runtime);
}
const ASSET_DB = "kiber-vengance-assets-v1";
function assetDb(): any {
  return storage.assetDb(runtime);
}
async function putAsset(id: string, blob: Blob): Promise<any> {
  return storage.putAsset(runtime, id, blob);
}
async function getAsset(id: string): Promise<any> {
  return storage.getAsset(runtime, id);
}
async function deleteAsset(id: string): Promise<any> {
  return storage.deleteAsset(runtime, id);
}
function renderExportTargets(): any {
  return storage.renderExportTargets(runtime);
}
function showQuickHandle(_kind: QuickExportKind, _handle: any): any {
  return workflow.showQuickHandle(runtime, _kind, _handle);
}
async function loadQuickHandles(): Promise<any> {
  return workflow.loadQuickHandles(runtime);
}
async function rememberQuickHandle(
  kind: QuickExportKind,
  handle: any,
): Promise<any> {
  return workflow.rememberQuickHandle(runtime, kind, handle);
}
async function forgetExportTarget(kind: QuickExportKind): Promise<any> {
  return storage.forgetExportTarget(runtime, kind);
}
async function prepareQuickExport(
  kind: QuickExportKind,
  name: string,
  type: string,
  extension: string,
  description: string,
  forcePicker = false,
): Promise<QuickTarget> {
  return storage.prepareQuickExport(
    runtime,
    kind,
    name,
    type,
    extension,
    description,
    forcePicker,
  );
}
async function writeQuickExport(target: QuickTarget, data: any): Promise<any> {
  return storage.writeQuickExport(runtime, target, data);
}
async function quickExportProject(forcePicker = false): Promise<any> {
  return storage.quickExportProject(runtime, forcePicker);
}
function safeName(): any {
  return storage.safeName(runtime);
}
function clip() {
  return activeClip(project, selectedTrack);
}
function pitches(): any {
  return performanceFeature.pitches(runtime);
}

const staticCopy: Array<[string, string, string]> = [
  ["#boot p", "LOADING COMPOSITION ENGINE", "CARGANDO MOTOR DE COMPOSICIÓN"],
  [".project-head label", "PROJECT", "PROYECTO"],
  [".rail-label", "INDEPENDENT CLIPS", "CLIPS INDEPENDIENTES"],
  ["#newClipBtn", "＋ NEW CLIP", "＋ NUEVO CLIP"],
  ['[data-view="forge"]', "FORGE", "FORJA"],
  ['[data-view="arrange"]', "ARRANGE", "ARREGLO"],
  ['[data-view="perform"]', "PERFORM", "INTERPRETAR"],
  ["#tutorialBtn", "GUIDE", "GUÍA"],
  ["#focusBtn", "FOCUS", "FOCO"],
  ["#motionRack .eyebrow", "MOTION ENGINE", "MOTOR DE MOVIMIENTO"],
  ["#effectsRack .eyebrow", "SIGNAL PROCESSING", "PROCESADO DE SEÑAL"],
  ["#effectsRack strong", "TRACK FX", "EFECTOS DE PISTA"],
  ["#macroRack .eyebrow", "VECTOR CONTROL", "CONTROL VECTORIAL"],
  ["#macroRack strong", "SCULPT THE IMPACT", "MODELA EL IMPACTO"],
  ["#fxBypass", "BYPASS", "OMITIR"],
  [".editor-head .eyebrow", "ACTIVE CLIP", "CLIP ACTIVO"],
  ["#duplicateBtn", "DUPLICATE", "DUPLICAR"],
  ["#mutateBtn", "MUTATE", "MUTAR"],
  ["#backingBtn", "BACKING", "BASE"],
  ["#quantizeBtn", "QUANTIZE", "CUANTIZAR"],
  ["#deleteNotesBtn", "DELETE", "BORRAR"],
  [".automation-head .eyebrow", "AUTOMATION", "AUTOMATIZACIÓN"],
  [
    ".automation-head>span",
    "CLICK / DRAG TO DRAW",
    "CLIC / ARRASTRA PARA DIBUJAR",
  ],
  ["#clearAutomationBtn", "CLEAR LANE", "LIMPIAR LÍNEA"],
  [
    "#arrangeDescription",
    "Each section combines five independent clips. Edit, repeat and reorder the complete song.",
    "Cada sección combina cinco clips independientes. Edita, repite y reordena la canción completa.",
  ],
  ["#addSceneBtn", "＋ ADD SECTION", "＋ AÑADIR SECCIÓN"],
  ["#autoArrangeBtn", "⟳ AUTO SEQUENCE", "⟳ SECUENCIA AUTO"],
  [
    "#performDescription",
    "Play the instruments, capture the active mix, and cut it into the performance with the Scratch Deck.",
    "Toca los instrumentos, captura la mezcla activa y córtala en directo con el plato de scratch.",
  ],
  ["#backingDialog .eyebrow", "BACKING GENERATOR", "GENERADOR DE BASES"],
  [
    "#backingDialog h2",
    "BUILD A PLAYABLE FOUNDATION",
    "CREA UNA BASE PARA TOCAR",
  ],
  [
    "#backingDescription",
    "Generate a structured bass, pad and drum arrangement while preserving your lead and guitar clips.",
    "Genera un arreglo estructurado de bajo, pad y batería conservando tus clips de lead y guitarra.",
  ],
  [
    "#backingWarning",
    "The current arrangement will be replaced. You can undo this action.",
    "El arreglo actual será reemplazado. Puedes deshacer esta acción.",
  ],
  ["#generateBackingBtn", "GENERATE BACKING", "GENERAR BASE"],
  ["#projectMenu .eyebrow", "PROJECT CORE", "NÚCLEO DEL PROYECTO"],
  ["#projectMenu h2", "VERSIONS & RECOVERY", "VERSIONES Y RECUPERACIÓN"],
  ["#menuLanguageLabel", "INTERFACE LANGUAGE", "IDIOMA DE LA INTERFAZ"],
  ["#importProjectLabel", "Import project JSON", "Importar proyecto JSON"],
  ["#newBtn", "New demo project", "Nuevo proyecto de demostración"],
  ["#emptyBtn", "New empty project", "Nuevo proyecto vacío"],
  [
    "#duplicateProjectBtn",
    "Duplicate current project",
    "Duplicar proyecto actual",
  ],
  ["#saveBtn", "Create named snapshot", "Crear instantánea con nombre"],
  ["#exportProjectBtn", "Export project JSON", "Exportar proyecto JSON"],
  ["#compatBtn", "Compatibility report", "Informe de compatibilidad"],
  [".versions-head", "LOCAL VERSIONS", "VERSIONES LOCALES"],
  [
    "#exportDialog .eyebrow",
    "COMMIT THE FULL SIGNAL",
    "CONSOLIDA TODA LA SEÑAL",
  ],
  ["#exportDialog h2", "EXPORT SONG", "EXPORTAR CANCIÓN"],
  [
    "#exportDialog>p",
    "Render the complete arrangement, including repeated clips, automation, arpeggiators and effects.",
    "Renderiza todo el arreglo, incluidos clips repetidos, automatización, arpegiadores y efectos.",
  ],
  ["#wavBtn b", "SONG WAV", "CANCIÓN WAV"],
  ["#exportMidiBtn b", "SONG MIDI", "CANCIÓN MIDI"],
  ["#clipWavBtn b", "CLIP WAV", "CLIP WAV"],
  ["#clipMidiBtn b", "CLIP MIDI", "CLIP MIDI"],
  ["#helpDialog .eyebrow", "FIELD MANUAL", "MANUAL DE CAMPO"],
  ["#helpDialog h2", "COMPOSITION CONTROLS", "CONTROLES DE COMPOSICIÓN"],
  [
    "#helpDialog .note",
    "Drag notes to move them and use the handle on their right edge to resize. Web MIDI records note-on/off, velocity, bend, pressure and timbre.",
    "Arrastra las notas para moverlas y usa el tirador derecho para cambiar su duración. Web MIDI graba nota, velocidad, bend, presión y timbre.",
  ],
  [
    "#aboutDialog p",
    "A complete cinematic electro-rock composition engine built for pressure, motion and controlled impact.",
    "Un motor completo de composición electro-rock cinematográfica creado para presión, movimiento e impacto controlado.",
  ],
  ["#compatDialog .eyebrow", "SYSTEM DIAGNOSTICS", "DIAGNÓSTICO DEL SISTEMA"],
  ["#compatDialog h2", "COMPATIBILITY REPORT", "INFORME DE COMPATIBILIDAD"],
  ["#copyCompatBtn", "COPY REPORT", "COPIAR INFORME"],
  [
    "#commandDialog .command-head .eyebrow",
    "RAPID EXECUTION",
    "EJECUCIÓN RÁPIDA",
  ],
  ["#commandDialog .command-head b", "COMMAND PALETTE", "PALETA DE COMANDOS"],
  [
    ".command-help",
    "↑↓ NAVIGATE · ENTER EXECUTE · ESC CLOSE",
    "↑↓ NAVEGAR · INTRO EJECUTAR · ESC CERRAR",
  ],
  ["#contextHelpEyebrow", "CONTEXT HELP", "AYUDA CONTEXTUAL"],
  ["#manualBtn", "KEYBOARD SHORTCUTS", "ATAJOS DE TECLADO"],
];
staticCopy.push(
  ["#effectsRack strong", "CLIP FX", "EFECTOS DEL CLIP"],
  ["#motionRack .clip-scope", "ACTIVE CLIP", "CLIP ACTIVO"],
  ["#effectsRack .clip-scope", "ACTIVE CLIP", "CLIP ACTIVO"],
  ["#macroRack .clip-scope", "ACTIVE CLIP", "CLIP ACTIVO"],
  [".backing-options label:nth-child(1)>span", "STYLE", "ESTILO"],
  [".backing-options label:nth-child(2)>span", "SECTIONS", "SECCIONES"],
  [".backing-options label:nth-child(3)>span", "INTENSITY", "INTENSIDAD"],
  ["#deleteClipDialog .eyebrow", "DESTRUCTIVE EDIT", "EDICIÓN DESTRUCTIVA"],
  [
    "#deleteClipDialog .delete-clip-warning",
    "This removes the clip from the project. You can undo this action.",
    "Esto elimina el clip del proyecto. Puedes deshacer la acción.",
  ],
  ["#cancelDeleteClipBtn", "CANCEL", "CANCELAR"],
  ["#confirmDeleteClipBtn", "DELETE CLIP", "BORRAR CLIP"],
);
staticCopy.push(
  ["#scratchTitle", "SCRATCH DECK", "PLATO DE SCRATCH"],
  ["#scratchCaptureBtn", "CAPTURE MIX", "CAPTURAR MEZCLA"],
  [".scratch-import span", "IMPORT AUDIO", "IMPORTAR AUDIO"],
  ["#scratchBrakeBtn", "BRAKE", "FRENAR"],
  ["#scratchSpinBtn", "↶ SPINBACK", "↶ RETROCESO"],
  ["#scratchStutterBtn", "STUTTER", "REPETIR"],
  [
    ".scratch-hint",
    "Drag the vinyl in either direction. Release for motor return; wheel or ← → for precise cuts.",
    "Arrastra el vinilo en ambas direcciones. Suelta para recuperar el motor; usa la rueda o ← → para cortes precisos.",
  ],
);
staticCopy.push(
  ['[data-view="mix"]', "MIX", "MEZCLA"],
  ["#exportAsBtn", "EXPORT AS", "EXPORTAR COMO"],
  ["#globalStartBtn", "▶ SONG", "▶ CANCIÓN"],
  [
    "#arrangeDescription",
    "Each section combines five independent clips. Click the timeline to set the global start; edit, repeat and reorder the complete song.",
    "Cada sección combina cinco clips independientes. Pulsa la línea temporal para fijar el inicio global; edita, repite y reordena la canción.",
  ],
  ["#exportDialog h2", "EXPORT / EXPORT AS", "EXPORTAR / EXPORTAR COMO"],
  [
    "#exportDialog>p",
    "Export reuses the linked file. Export As always asks for a new destination.",
    "Exportar reutiliza el archivo vinculado. Exportar como siempre solicita un destino nuevo.",
  ],
  [".export-targets-head", "EXPORT DESTINATIONS", "DESTINOS DE EXPORTACIÓN"],
  [
    "#forgetTargetsBtn",
    "Forget all destinations",
    "Olvidar todos los destinos",
  ],
  ["#mixCaptureBtn", "CAPTURE A", "CAPTURAR A"],
  ["#mixCompareBtn", "COMPARE B", "COMPARAR B"],
  ["#performanceRecordBtn", "● RECORD TAKE", "● GRABAR TOMA"],
  ["#performanceSaveBtn", "SAVE TAKE AS", "GUARDAR TOMA COMO"],
);
staticCopy.push(
  ['[data-view="launch"]', "LAUNCH", "LANZAR"],
  ["#launchView h1", "CLIP LAUNCHER", "LANZADOR DE CLIPS"],
  [
    "#launchView .launcher-head p",
    "Queue clips without stopping the signal, stop individual tracks, and capture the live sequence into Arrange.",
    "Pon clips en cola sin detener la señal, para pistas individuales y captura la secuencia en directo en Arreglo.",
  ],
  ["#launcherCaptureBtn", "● CAPTURE", "● CAPTURAR"],
  ["#launcherCommitBtn", "COMMIT TO ARRANGE", "ENVIAR AL ARREGLO"],
  ["#arrangeSelectAllBtn", "SELECT ALL", "SELECCIONAR TODO"],
  ["#arrangeDuplicateBtn", "DUPLICATE", "DUPLICAR"],
  ["#arrangeCopyBtn", "COPY", "COPIAR"],
  ["#arrangePasteBtn", "PASTE", "PEGAR"],
  ["#arrangeDeleteBtn", "DELETE", "BORRAR"],
  ["#arrangeFillBtn", "＋ FILL", "＋ FILL"],
  ["#arrangeMarkerBtn", "＋ MARKER", "＋ MARCADOR"],
  ["#masterBypassBtn", "MASTER FX", "FX MASTER"],
  ["#presetLibraryBtn", "Preset library", "Biblioteca de presets"],
  ["#sampleLibraryBtn", "Local drum samples", "Samples de batería locales"],
  ["#compactModeBtn", "Compact workspace", "Espacio compacto"],
  ["#presetDialog h2", "PRESET VAULT", "CÁMARA DE PRESETS"],
  ["#sampleDialog h2", "IMPACT SAMPLE SLOTS", "RANURAS DE SAMPLES IMPACT"],
  ["#saveUserPresetBtn", "＋ SAVE CURRENT", "＋ GUARDAR ACTUAL"],
  ["#exportPresetBankBtn", "EXPORT BANK", "EXPORTAR BANCO"],
  ["#takeQuantizeBtn", "QUANTIZE EVENTS", "CUANTIZAR EVENTOS"],
  ["#cancelExportBtn", "CANCEL", "CANCELAR"],
);
const leadingCopy: Array<[string, string, string]> = [
  ["label:has(#barsSelect)", "BARS", "COMPASES"],
  ["label:has(#gridSelect)", "SNAP", "AJUSTE"],
  ["label:has(#zoomRange)", "ZOOM", "ZOOM"],
  ["label:has(#keySelect)", "KEY", "TONALIDAD"],
  ["label:has(#scaleSelect)", "SCALE", "ESCALA"],
  ["label:has(#noteLength)", "LEN", "DUR"],
  ["label:has(#noteVelocity)", "VEL", "VEL"],
  ["label:has(#arpMode)", "MODE", "MODO"],
  ["label:has(#arpOctaves)", "OCT", "OCT"],
  ["label:has(#arpRate)", "RATE", "RITMO"],
  ["label:has(#lfoTarget)", "TARGET", "DESTINO"],
  ["label:has(#lfoRate)", "LFO RATE", "RITMO LFO"],
  ["label:has(#lfoDepth)", "DEPTH", "PROFUNDIDAD"],
];
const shortcutCopy: Array<[string, string]> = [
  ["Play / stop from locator", "Reproducir / parar desde el localizador"],
  ["Perform / record", "Interpretar / grabar"],
  ["Select track", "Seleccionar pista"],
  ["Command palette", "Paleta de comandos"],
  ["Export to current destination", "Exportar al destino actual"],
  ["Open Export As", "Abrir Exportar como"],
  ["Toggle Focus mode", "Activar modo Foco"],
  [
    "Forge / Launch / Arrange / Mix / Perform",
    "Forja / Lanzar / Arreglo / Mezcla / Interpretar",
  ],
  ["New / duplicate clip", "Nuevo / duplicar clip"],
  ["Solo / mute active track", "Solo / silenciar pista activa"],
  ["Mutate / quantize", "Mutar / cuantizar"],
  ["Undo / redo", "Deshacer / rehacer"],
  ["Multi-select notes", "Selección múltiple"],
  ["Select all notes", "Seleccionar todas las notas"],
  ["Move selected notes", "Mover notas seleccionadas"],
  ["Resize selected notes", "Redimensionar notas"],
  ["Copy / paste notes", "Copiar / pegar notas"],
  ["Delete selection", "Borrar selección"],
];
const controlDescriptions: Record<string, [string, string, string, string]> = {
  aboutBtn: [
    "Brand & about",
    "Marca e información",
    "Open product information and version details.",
    "Abre la información del producto y sus detalles.",
  ],
  title: [
    "Project title",
    "Título del proyecto",
    "Rename the current project. Changes are saved locally.",
    "Renombra el proyecto actual. Los cambios se guardan localmente.",
  ],
  rewindBtn: [
    "Return to start",
    "Volver al inicio",
    "Stop playback and return the playhead to the beginning.",
    "Detiene la reproducción y devuelve el cursor al inicio.",
  ],
  playBtn: [
    "Play / stop",
    "Reproducir / parar",
    "Start or stop the active clip or full arrangement. Shortcut: Space.",
    "Inicia o detiene el clip activo o el arreglo completo. Atajo: Espacio.",
  ],
  pauseBtn: [
    "Pause at playhead",
    "Pausar en el cursor",
    "Pause playback and preserve the current position so Play resumes from there.",
    "Pausa la reproducción y conserva la posición para continuar desde ahí.",
  ],
  recordBtn: [
    "Record arm",
    "Armar grabación",
    "Arm live recording from the computer keyboard, touch keys or MIDI.",
    "Prepara la grabación en directo desde teclado, controles táctiles o MIDI.",
  ],
  recordMode: [
    "Recording timing",
    "Temporización de grabación",
    "Choose quantized timing or preserve free microtiming.",
    "Elige tiempo cuantizado o conserva el microtiming libre.",
  ],
  tempo: [
    "Tempo",
    "Tempo",
    "Set song speed in beats per minute.",
    "Ajusta la velocidad de la canción en pulsos por minuto.",
  ],
  meterSelect: [
    "Time signature",
    "Compás",
    "Choose the rhythmic meter used by clips and bars.",
    "Elige el compás rítmico utilizado por clips y barras.",
  ],
  swing: [
    "Swing",
    "Swing",
    "Delay alternating subdivisions to add groove.",
    "Retrasa subdivisiones alternas para añadir groove.",
  ],
  countIn: [
    "Count-in",
    "Cuenta atrás",
    "Choose how many bars play before armed recording starts.",
    "Elige cuántos compases suenan antes de iniciar la grabación.",
  ],
  metroBtn: [
    "Metronome",
    "Metrónomo",
    "Toggle the accented timing click during playback.",
    "Activa o desactiva el clic acentuado durante la reproducción.",
  ],
  masterVolume: [
    "Master volume",
    "Volumen maestro",
    "Set the final output level for the complete mix.",
    "Ajusta el nivel final de salida de toda la mezcla.",
  ],
  languageSelect: [
    "Language",
    "Idioma",
    "Switch the complete interface between English and Spanish.",
    "Cambia toda la interfaz entre inglés y español.",
  ],
  exportBtn: [
    "Export",
    "Exportar",
    "Render the song or active clips to WAV or MIDI.",
    "Renderiza la canción o los clips activos a WAV o MIDI.",
  ],
  menuBtn: [
    "Project menu",
    "Menú del proyecto",
    "Create, import, export or restore project versions.",
    "Crea, importa, exporta o restaura versiones del proyecto.",
  ],
  tutorialBtn: [
    "Interactive guide",
    "Guía interactiva",
    "Start a guided tour through the complete composition workflow.",
    "Inicia un recorrido guiado por todo el flujo de composición.",
  ],
  focusBtn: [
    "Focus mode",
    "Modo Foco",
    "Hide secondary racks and dedicate more space to note editing.",
    "Oculta paneles secundarios y dedica más espacio a editar notas.",
  ],
  commandBtn: [
    "Command palette",
    "Paleta de comandos",
    "Search and execute any common action from the keyboard.",
    "Busca y ejecuta acciones habituales desde el teclado.",
  ],
  undoBtn: [
    "Undo",
    "Deshacer",
    "Restore the previous musical edit.",
    "Restaura la edición musical anterior.",
  ],
  redoBtn: [
    "Redo",
    "Rehacer",
    "Reapply the last undone edit.",
    "Vuelve a aplicar la última edición deshecha.",
  ],
  helpBtn: [
    "Context help",
    "Ayuda contextual",
    "Show a live explanation whenever a control is focused or touched.",
    "Muestra una explicación cuando enfocas o tocas un control.",
  ],
  preset: [
    "Sound preset",
    "Preset de sonido",
    "Load a sound for the active clip. Track level and pan stay unchanged.",
    "Carga un sonido para el clip activo. El nivel y panorama de la pista se conservan.",
  ],
  waveSelect: [
    "Main oscillator",
    "Oscilador principal",
    "Choose the waveform that defines the core timbre.",
    "Elige la forma de onda que define el timbre principal.",
  ],
  osc2WaveSelect: [
    "Second oscillator",
    "Segundo oscilador",
    "Choose an additional waveform or switch oscillator two off.",
    "Elige una onda adicional o desactiva el segundo oscilador.",
  ],
  filterSelect: [
    "Filter type",
    "Tipo de filtro",
    "Choose which frequencies the synthesizer filter removes.",
    "Elige qué frecuencias elimina el filtro del sintetizador.",
  ],
  arpEnabled: [
    "Arpeggiator",
    "Arpegiador",
    "Turn held notes into a rhythmic sequence.",
    "Convierte las notas mantenidas en una secuencia rítmica.",
  ],
  arpMode: [
    "Arpeggio direction",
    "Dirección del arpegio",
    "Choose the order in which held notes are played.",
    "Elige el orden en el que se reproducen las notas.",
  ],
  arpOctaves: [
    "Arpeggio octaves",
    "Octavas del arpegio",
    "Set the pitch range covered by the arpeggiator.",
    "Ajusta el rango tonal recorrido por el arpegiador.",
  ],
  arpRate: [
    "Arpeggio rate",
    "Velocidad del arpegio",
    "Choose the rhythmic subdivision for generated notes.",
    "Elige la subdivisión rítmica de las notas generadas.",
  ],
  lfoEnabled: [
    "LFO modulation",
    "Modulación LFO",
    "Enable cyclic movement for the selected target.",
    "Activa movimiento cíclico sobre el destino seleccionado.",
  ],
  lfoTarget: [
    "LFO target",
    "Destino del LFO",
    "Choose the sound parameter moved by the LFO.",
    "Elige el parámetro de sonido que moverá el LFO.",
  ],
  lfoRate: [
    "LFO rate",
    "Velocidad del LFO",
    "Set how quickly the modulation cycle repeats.",
    "Ajusta la velocidad con que se repite la modulación.",
  ],
  lfoDepth: [
    "LFO depth",
    "Profundidad del LFO",
    "Set the amount of cyclic modulation.",
    "Ajusta la cantidad de modulación cíclica.",
  ],
  fxBypass: [
    "Effects bypass",
    "Omitir efectos",
    "Disable or restore all effects on the selected track.",
    "Desactiva o restaura todos los efectos de la pista.",
  ],
  clipSelect: [
    "Active clip",
    "Clip activo",
    "Choose which independent pattern is edited for this track.",
    "Elige qué patrón independiente se edita en esta pista.",
  ],
  renameClipBtn: [
    "Rename clip",
    "Renombrar clip",
    "Give the active clip a descriptive name.",
    "Asigna un nombre descriptivo al clip activo.",
  ],
  duplicateBtn: [
    "Duplicate clip",
    "Duplicar clip",
    "Create an independent copy of the active clip.",
    "Crea una copia independiente del clip activo.",
  ],
  mutateBtn: [
    "Mutate clip",
    "Mutar clip",
    "Generate a controlled variation using the Tension macro.",
    "Genera una variación controlada usando la macro Tensión.",
  ],
  backingBtn: [
    "Backing generator",
    "Generador de bases",
    "Create a structured accompaniment for bass, pad and drums without changing guitar or lead clips.",
    "Crea un acompañamiento estructurado de bajo, pad y batería sin cambiar los clips de guitarra ni lead.",
  ],
  generateBackingBtn: [
    "Generate backing",
    "Generar base",
    "Replace the arrangement with the selected generated backing. The edit can be undone.",
    "Reemplaza el arreglo por la base generada seleccionada. La edición se puede deshacer.",
  ],
  barsSelect: [
    "Clip length",
    "Duración del clip",
    "Resize the active clip in musical bars.",
    "Cambia la duración del clip activo en compases.",
  ],
  gridSelect: [
    "Snap grid",
    "Rejilla de ajuste",
    "Choose the rhythmic resolution for placing and moving notes.",
    "Elige la resolución rítmica para colocar y mover notas.",
  ],
  zoomRange: [
    "Editor zoom",
    "Zoom del editor",
    "Change the horizontal width of sequencer steps.",
    "Cambia el ancho horizontal de los pasos del secuenciador.",
  ],
  keySelect: [
    "Song key",
    "Tonalidad",
    "Set the root note used by scale-aware generators.",
    "Ajusta la nota raíz usada por los generadores musicales.",
  ],
  scaleSelect: [
    "Musical scale",
    "Escala musical",
    "Constrain generated material to a harmonic scale.",
    "Limita el material generado a una escala armónica.",
  ],
  quantizeBtn: [
    "Quantize",
    "Cuantizar",
    "Align notes to the currently selected snap grid.",
    "Alinea las notas con la rejilla seleccionada.",
  ],
  automationParam: [
    "Automation lane",
    "Línea de automatización",
    "Choose which parameter is drawn below the piano roll.",
    "Elige qué parámetro se dibuja bajo el piano roll.",
  ],
  clearAutomationBtn: [
    "Clear automation",
    "Limpiar automatización",
    "Remove every point from the visible automation lane.",
    "Elimina todos los puntos de la automatización visible.",
  ],
  addSceneBtn: [
    "Add section",
    "Añadir sección",
    "Append a new song section using the active clips.",
    "Añade una nueva sección usando los clips activos.",
  ],
  autoArrangeBtn: [
    "Auto sequence",
    "Secuencia automática",
    "Distribute available clips across the complete song.",
    "Distribuye los clips disponibles a lo largo de la canción.",
  ],
  deleteClipBtn: [
    "Delete active clip",
    "Borrar clip activo",
    "Delete this clip safely. Arrangement sections are reassigned and the operation can be undone.",
    "Borra este clip de forma segura. Las secciones del arreglo se reasignan y puedes deshacer la operación.",
  ],
  confirmDeleteClipBtn: [
    "Confirm clip deletion",
    "Confirmar borrado del clip",
    "Permanently remove the selected clip from this project.",
    "Elimina el clip seleccionado de este proyecto.",
  ],
  sequencer: [
    "Piano roll",
    "Piano roll",
    "Click to add a note. Drag across empty space to select several notes; hold Shift to add them to the current selection.",
    "Haz clic para añadir una nota. Arrastra sobre un espacio vacío para seleccionar varias; mantén Mayús para sumarlas a la selección actual.",
  ],
};
Object.assign(controlDescriptions, {
  arpEnabled: [
    "Clip arpeggiator",
    "Arpegiador del clip",
    "Turn held notes in the active clip into a rhythmic sequence.",
    "Convierte las notas mantenidas del clip activo en una secuencia rítmica.",
  ],
  lfoEnabled: [
    "Clip LFO",
    "LFO del clip",
    "Enable cyclic modulation for the active clip.",
    "Activa la modulación cíclica del clip activo.",
  ],
  fxBypass: [
    "Clip effects bypass",
    "Omitir efectos del clip",
    "Disable or restore effects on the active clip.",
    "Desactiva o restaura los efectos del clip activo.",
  ],
  clipSelect: [
    "Active clip and character",
    "Clip y carácter activos",
    "Choose the pattern together with its independent motion, effects and vector settings.",
    "Elige el patrón junto con sus ajustes independientes de movimiento, efectos y vectores.",
  ],
});
Object.assign(controlDescriptions, {
  scratchCaptureBtn: [
    "Capture active mix",
    "Capturar mezcla activa",
    "Render the active clips into a mastered one, two, four, or eight-bar scratch buffer.",
    "Renderiza los clips activos en un búfer masterizado de uno, dos, cuatro u ocho compases.",
  ],
  scratchImport: [
    "Import audio to Scratch Deck",
    "Importar audio al plato",
    "Load a local WAV, MP3, OGG, or other browser-decodable audio file into the temporary Scratch Deck buffer.",
    "Carga un WAV, MP3, OGG u otro archivo decodificable por el navegador en el búfer temporal del plato.",
  ],
  scratchPlatter: [
    "Bidirectional scratch platter",
    "Plato de scratch bidireccional",
    "Drag in either direction for sample-accurate scratching. Release to return smoothly to normal motor speed.",
    "Arrastra en ambas direcciones para hacer scratch con precisión de muestra. Suelta para recuperar suavemente la velocidad normal.",
  ],
  scratchSyncBtn: [
    "Beat sync",
    "Sincronía de pulso",
    "Move the deck to the nearest beat boundary and return to normal speed.",
    "Mueve el plato al pulso más cercano y recupera la velocidad normal.",
  ],
  scratchBrakeBtn: [
    "Motor brake",
    "Freno de motor",
    "Slow the deck to a stop with a progressive motor brake.",
    "Detiene el plato progresivamente con un freno de motor.",
  ],
  scratchSpinBtn: [
    "Spinback",
    "Retroceso",
    "Throw the record backwards and let it decelerate.",
    "Lanza el disco hacia atrás y deja que desacelere.",
  ],
  scratchStutterBtn: [
    "Beat stutter",
    "Repetición rítmica",
    "Loop a short tempo-derived fragment until this control is released.",
    "Repite un fragmento corto derivado del tempo hasta desactivar el control.",
  ],
  scratchMix: [
    "Deck crossfader",
    "Crossfader del plato",
    "Blend between the live program and the captured Scratch Deck with equal-power curves.",
    "Mezcla el programa en directo y el plato capturado con curvas de potencia constante.",
  ],
  scratchFilter: [
    "Deck filter",
    "Filtro del plato",
    "Darken the Scratch Deck with a smooth resonant-free low-pass filter.",
    "Oscurece el plato con un filtro paso bajo suave y sin resonancia.",
  ],
  scratchWaveform: [
    "Scratch waveform",
    "Forma de onda de scratch",
    "Shows the captured buffer and its live playback position.",
    "Muestra el búfer capturado y su posición de reproducción en directo.",
  ],
});
Object.assign(controlDescriptions, {
  exportBtn: [
    "Export",
    "Exportar",
    "Repeat the last export recipe and update its linked file. Shortcut: Ctrl or Command plus E.",
    "Repite la última exportación y actualiza su archivo vinculado. Atajo: Ctrl o Comando más E.",
  ],
  exportAsBtn: [
    "Export As",
    "Exportar como",
    "Choose a format and always select a new destination. Shortcut: Ctrl or Command plus Shift plus E.",
    "Elige un formato y selecciona siempre un destino nuevo. Atajo: Ctrl o Comando más Mayús más E.",
  ],
  globalPosition: [
    "Song start locator",
    "Localizador de inicio de canción",
    "Choose the exact arrangement step where global playback begins.",
    "Elige el paso exacto del arreglo donde comienza la reproducción global.",
  ],
  clipPosition: [
    "Clip start locator",
    "Localizador de inicio del clip",
    "Choose the exact step where active-clip playback begins.",
    "Elige el paso exacto donde comienza la reproducción del clip activo.",
  ],
  performanceRecordBtn: [
    "Record performance take",
    "Grabar toma de interpretación",
    "Capture the audible master in real time, including the Scratch Deck.",
    "Captura el master audible en tiempo real, incluido el plato de scratch.",
  ],
});
function applyLanguage(render = false): any {
  return workflow.applyLanguage(runtime, render);
}
function controlInfo(el: any): [string, string] {
  return workflow.controlInfo(runtime, el);
}
function installControlHelp(): any {
  return workflow.installControlHelp(runtime);
}
function showHelpIntro(): any {
  return workflow.showHelpIntro(runtime);
}
function toggleHelp(force?: boolean): any {
  return workflow.toggleHelp(runtime, force);
}
function showControlHelp(el: any): any {
  return workflow.showControlHelp(runtime, el);
}
const tutorialSteps = () => [
  {
    target: ".transport",
    view: "forge",
    title: msg("ui_e9b43f615739"),
    body: msg("ui_037454240759"),
  },
  {
    target: ".track-rail",
    view: "forge",
    title: msg("ui_8147d7cb07cd"),
    body: msg("ui_ebdf07546c6d"),
  },
  {
    target: "#synthRack",
    view: "forge",
    title: msg("ui_f1bd34c2cdfc"),
    body: msg("ui_f1eee9c6d0aa"),
  },
  {
    target: ".piano-shell",
    view: "forge",
    title: msg("ui_fa450dfcc9d4"),
    body: msg("ui_0c72e968d7d3"),
  },
  {
    target: "#arrangeView .section-title",
    view: "arrange",
    title: msg("ui_3c5cfc67663d"),
    body: msg("ui_db7970e0e1d5"),
  },
  {
    target: "#performView .performance",
    view: "perform",
    title: msg("ui_0f34bb074d3d"),
    body: msg("ui_e888522d73e2"),
  },
  {
    target: ".modebar",
    view: "forge",
    title: msg("ui_77c41d35d999"),
    body: msg("ui_dd7c8962262e"),
  },
];
function showTutorialStep(): any {
  return workflow.showTutorialStep(runtime);
}
function startTutorial(): any {
  return workflow.startTutorial(runtime);
}
function endTutorial(): any {
  return workflow.endTutorial(runtime);
}
function initLearning(): any {
  return workflow.initLearning(runtime);
}

function renderTracks(): any {
  return instruments.renderTracks(runtime);
}
function renderInspector(): any {
  return instruments.renderInspector(runtime);
}
function applyPreset(track: TrackId, name: string): any {
  return instruments.applyPreset(runtime, track, name);
}
function renderArp(): any {
  return instruments.renderArp(runtime);
}
function renderFx(): any {
  return instruments.renderFx(runtime);
}
function macroMarkup(container: any): any {
  return instruments.macroMarkup(runtime, container);
}

function renderClipControls(): any {
  return instruments.renderClipControls(runtime);
}
function updateDeleteClipDialog(): any {
  return workflow.updateDeleteClipDialog(runtime);
}
function requestClipDelete(id: string): any {
  return workflow.requestClipDelete(runtime, id);
}
function renderHarmony(): any {
  return instruments.renderHarmony(runtime);
}

function renderPiano(): any {
  return performanceFeature.renderPiano(runtime);
}
function bindMarqueeSelection(seq: any): any {
  return performanceFeature.bindMarqueeSelection(runtime, seq);
}
function bindNoteDrag(
  el: any,
  c: any,
  rows: number[],
  zoom: number,
  rowH: number,
): any {
  return workflow.bindNoteDrag(runtime, el, c, rows, zoom, rowH);
}
function syncSelectedClasses(): any {
  return performanceFeature.syncSelectedClasses(runtime);
}
function syncRollScroll(): any {
  return performanceFeature.syncRollScroll(runtime);
}
function setDefaultScroll(): any {
  return performanceFeature.setDefaultScroll(runtime);
}

function renderSelection(): any {
  return performanceFeature.renderSelection(runtime);
}
function editSelection(key: any, value: any): any {
  return performanceFeature.editSelection(runtime, key, value);
}
function deleteSelection(): any {
  return performanceFeature.deleteSelection(runtime);
}

function renderAutomation(): any {
  return audio_studio.renderAutomation(runtime);
}

const heldKeyPointers = new Map<number, { source: string; key: HTMLElement }>();
function releaseKeyPointer(pointerId: number): any {
  return performanceFeature.releaseKeyPointer(runtime, pointerId);
}
function releaseKeyPointers(): any {
  return performanceFeature.releaseKeyPointers(runtime);
}
window.addEventListener(
  "pointerup",
  (event) => releaseKeyPointer(event.pointerId),
  true,
);
window.addEventListener(
  "pointercancel",
  (event) => releaseKeyPointer(event.pointerId),
  true,
);
window.addEventListener("blur", releaseKeyPointers);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseKeyPointers();
});
let instrumentOctave = 0;
function renderKeyboard(): any {
  return performanceFeature.renderKeyboard(runtime);
}
function startPerformance(
  source: string,
  pitch: number,
  velocity = 0.8,
  el: any = null,
  expression: Partial<NoteExpression> = {},
  channel: number | null = null,
): any {
  return performanceFeature.startPerformance(
    runtime,
    source,
    pitch,
    velocity,
    el,
    expression,
    channel,
  );
}
function endPerformance(source: string, el: any = null): any {
  return performanceFeature.endPerformance(runtime, source, el);
}

function launcherSnapshot(name = "LIVE"): any {
  return workflow.launcherSnapshot(runtime, name);
}
async function launchClip(track: TrackId, clipId: string): Promise<any> {
  return launcher.launchClip(runtime, track, clipId);
}
function renderLauncher(): any {
  return launcher.renderLauncher(runtime);
}
function setupLauncher(): any {
  return launcher.setupLauncher(runtime);
}

function renderArrangement(): any {
  return arrangement.renderArrangement(runtime);
}
function sceneLength(scene: any): any {
  return workflow.sceneLength(runtime, scene);
}
function focusScene(i: number): any {
  return arrangement.focusScene(runtime, i);
}
function updatePlayheads(): any {
  return performanceFeature.updatePlayheads(runtime);
}
function updatePosition(): any {
  return performanceFeature.updatePosition(runtime);
}
function updateOrb(): any {
  return instruments.updateOrb(runtime);
}

function songLength(): any {
  return workflow.songLength(runtime);
}
function formatLocator(step: number): any {
  return instruments.formatLocator(runtime, step);
}
function setGlobalStart(value: number): any {
  return workflow.setGlobalStart(runtime, value);
}
function setClipStart(value: number, seek = true): any {
  return workflow.setClipStart(runtime, value, seek);
}
function renderLocators(): any {
  return performanceFeature.renderLocators(runtime);
}
function syncLocatorsFromPlayback(): any {
  return performanceFeature.syncLocatorsFromPlayback(runtime);
}

function renderMixer(): any {
  return mixer.renderMixer(runtime);
}
function animateMixer(): any {
  return mixer.animateMixer(runtime);
}

function setScratchControls(enabled: boolean): any {
  return scratch.setScratchControls(runtime, enabled);
}
function updateScratchPlayButton(): any {
  return scratch.updateScratchPlayButton(runtime);
}
function drawScratchWaveform(buffer: AudioBuffer): any {
  return scratch.drawScratchWaveform(runtime, buffer);
}
async function armScratchBuffer(
  buffer: AudioBuffer,
  label: string,
): Promise<any> {
  return scratch.armScratchBuffer(runtime, buffer, label);
}
async function importScratchFile(file: File): Promise<any> {
  return scratch.importScratchFile(runtime, file);
}
async function audioRegionScratchBuffer(
  lane: AudioLane,
  region: AudioRegion,
): Promise<any> {
  return scratch.audioRegionScratchBuffer(runtime, lane, region);
}
async function loadAudioRegionIntoScratch(
  lane: AudioLane,
  region: AudioRegion,
  button: HTMLButtonElement,
): Promise<any> {
  return scratch.loadAudioRegionIntoScratch(runtime, lane, region, button);
}
async function captureScratchMix(): Promise<any> {
  return scratch.captureScratchMix(runtime);
}
function animateScratchDeck(now = performance.now()): any {
  return scratch.animateScratchDeck(runtime, now);
}

function scratchMotorRate(): any {
  return scratch.scratchMotorRate(runtime);
}
function setupScratchPro(): any {
  return scratch.setupScratchPro(runtime);
}

function setupScratchDeck(): any {
  return scratch.setupScratchDeck(runtime);
}

const performanceEventThrottle = new Map<string, number>();
function performanceStep(): any {
  return workflow.performanceStep(runtime);
}
function recordPerformanceEvent(
  kind: PerformanceEvent["kind"],
  target: string,
  value: number | string | boolean,
): any {
  return performanceFeature.recordPerformanceEvent(
    runtime,
    kind,
    target,
    value,
  );
}
async function loadPerformanceAudio(take: PerformanceTake): Promise<any> {
  return performanceFeature.loadPerformanceAudio(runtime, take);
}
function applyPerformanceEvent(event: PerformanceEvent): any {
  return performanceFeature.applyPerformanceEvent(runtime, event);
}
async function playPerformanceTake(take: PerformanceTake): Promise<any> {
  return performanceFeature.playPerformanceTake(runtime, take);
}
function openTakeEditor(take: PerformanceTake): any {
  return workflow.openTakeEditor(runtime, take);
}
function renderPerformanceTakes(): any {
  return performanceFeature.renderPerformanceTakes(runtime);
}
async function togglePerformanceCapture(): Promise<any> {
  return performanceFeature.togglePerformanceCapture(runtime);
}
function mixSnapshot(): any {
  return workflow.mixSnapshot(runtime);
}
function captureMixerReference(): any {
  return mixer.captureMixerReference(runtime);
}
function toggleMixerReference(): any {
  return mixer.toggleMixerReference(runtime);
}
function setupArrangeTools(): any {
  return arrangement.setupArrangeTools(runtime);
}
type UserPreset = {
  id: string;
  name: string;
  track: TrackId;
  tags: string[];
  instrument: import("./model.js").InstrumentState;
  character: any;
};
const USER_PRESETS = "kiber-vengance-user-presets-v1",
  PRESET_FAVORITES = "kiber-vengance-preset-favorites-v1";
function userPresets(): UserPreset[] {
  return instruments.userPresets(runtime);
}
function saveUserPresets(items: UserPreset[]): any {
  return instruments.saveUserPresets(runtime, items);
}
function presetFavorites(): any {
  return workflow.presetFavorites(runtime);
}
function renderPresetLibrary(): any {
  return instruments.renderPresetLibrary(runtime);
}
function saveCurrentPreset(): any {
  return instruments.saveCurrentPreset(runtime);
}
async function loadLocalSample(asset: SampleAsset): Promise<any> {
  return instruments.loadLocalSample(runtime, asset);
}
async function loadLocalSamples(): Promise<any> {
  return instruments.loadLocalSamples(runtime);
}
function renderSampleSlots(): any {
  return instruments.renderSampleSlots(runtime);
}
function setupLibraries(): any {
  return workflow.setupLibraries(runtime);
}
function setupPrecisionControls(): any {
  return mixer.setupPrecisionControls(runtime);
}
function setupStudioExtensions(): any {
  return workflow.setupStudioExtensions(runtime);
}

type CommandAction = {
  label: string;
  labelEs: string;
  group: string;
  groupEs: string;
  shortcut: string;
  icon: string;
  keywords: string;
  run: () => void;
};
function readUiPrefs(): {
  focus: boolean;
  collapsed: string[];
  compact: boolean;
} {
  return workflow.readUiPrefs(runtime);
}
function writeUiPrefs(): any {
  return workflow.writeUiPrefs(runtime);
}
function setRackCollapsed(id: string, collapsed: boolean, persist = true): any {
  return workflow.setRackCollapsed(runtime, id, collapsed, persist);
}
function toggleFocus(force?: boolean, silent = false): any {
  return workflow.toggleFocus(runtime, force, silent);
}
function selectTrack(track: TrackId): any {
  return workflow.selectTrack(runtime, track);
}
const commands: CommandAction[] = [
  {
    label: "Play / stop transport",
    labelEs: "Reproducir / detener transporte",
    group: "TRANSPORT",
    groupEs: "TRANSPORTE",
    shortcut: "SPACE",
    icon: "▶",
    keywords: "play stop transport reproducir parar",
    run: () => togglePlay(),
  },
  {
    label: "Arm / disarm recording",
    labelEs: "Armar / desarmar grabación",
    group: "TRANSPORT",
    groupEs: "TRANSPORTE",
    shortcut: "R",
    icon: "●",
    keywords: "record arm grabar",
    run: () => $("#recordBtn").click(),
  },
  {
    label: "Toggle metronome",
    labelEs: "Activar metrónomo",
    group: "TRANSPORT",
    groupEs: "TRANSPORTE",
    shortcut: "",
    icon: "⌁",
    keywords: "metro click metrónomo",
    run: () => $("#metroBtn").click(),
  },
  {
    label: "Toggle Solo on active track",
    labelEs: "Activar o quitar Solo en la pista activa",
    group: "MIX",
    groupEs: "MEZCLA",
    shortcut: "SHIFT S",
    icon: "S",
    keywords:
      "solo isolate isolation aislar aislamiento restore mix mezcla instrument instrumento",
    run: () => $(`[data-solo="${selectedTrack}"]`)?.click(),
  },
  {
    label: "Toggle Mute on active track",
    labelEs: "Silenciar o restaurar la pista activa",
    group: "MIX",
    groupEs: "MEZCLA",
    shortcut: "SHIFT M",
    icon: "M",
    keywords:
      "mute silence silenciar restore restaurar mix mezcla instrument instrumento",
    run: () => $(`[data-mute="${selectedTrack}"]`)?.click(),
  },
  {
    label: "Open Forge",
    labelEs: "Abrir Forja",
    group: "VIEW",
    groupEs: "VISTA",
    shortcut: "SHIFT G",
    icon: "F",
    keywords: "forge forja editor piano",
    run: () => activateView("forge"),
  },
  {
    label: "Open Arrange",
    labelEs: "Abrir Arreglo",
    group: "VIEW",
    groupEs: "VISTA",
    shortcut: "SHIFT A",
    icon: "A",
    keywords: "arrange arreglo song scenes",
    run: () => activateView("arrange"),
  },
  {
    label: "Open Clip Launcher",
    labelEs: "Abrir Lanzador de clips",
    group: "VIEW",
    groupEs: "VISTA",
    shortcut: "SHIFT L",
    icon: "L",
    keywords: "launch launcher clips grid live lanzar matriz",
    run: () => activateView("launch"),
  },
  {
    label: "Open Mix Console",
    labelEs: "Abrir mesa de mezcla",
    group: "VIEW",
    groupEs: "VISTA",
    shortcut: "SHIFT X",
    icon: "X",
    keywords: "mix mixer mezcla console fader",
    run: () => activateView("mix"),
  },
  {
    label: "Open Perform",
    labelEs: "Abrir Interpretación",
    group: "VIEW",
    groupEs: "VISTA",
    shortcut: "SHIFT P",
    icon: "P",
    keywords: "perform interpretar live macros",
    run: () => activateView("perform"),
  },
  {
    label: "Toggle Focus mode",
    labelEs: "Activar modo Foco",
    group: "VIEW",
    groupEs: "VISTA",
    shortcut: "SHIFT F",
    icon: "⌖",
    keywords: "focus foco collapse fast editor",
    run: () => toggleFocus(),
  },
  {
    label: "New independent clip",
    labelEs: "Nuevo clip independiente",
    group: "CLIP",
    groupEs: "CLIP",
    shortcut: "SHIFT N",
    icon: "＋",
    keywords: "new nuevo clip create",
    run: () => $("#newClipBtn").click(),
  },
  {
    label: "Generate melody with local AI",
    labelEs: "Generar melodía con IA local",
    group: "CLIP",
    groupEs: "CLIP",
    shortcut: "",
    icon: "✦",
    keywords:
      "ai ia local prompt melody melodia melodía generar generador inteligencia artificial cpu gpu qwen smollm",
    run: () => studioBridge.openLocalAI(),
  },
  {
    label: "Duplicate active clip",
    labelEs: "Duplicar clip activo",
    group: "CLIP",
    groupEs: "CLIP",
    shortcut: "SHIFT D",
    icon: "⧉",
    keywords: "duplicate duplicar copy clip",
    run: () => $("#duplicateBtn").click(),
  },
  {
    label: "Delete active clip",
    labelEs: "Borrar clip activo",
    group: "CLIP",
    groupEs: "CLIP",
    shortcut: "",
    icon: "⌫",
    keywords: "delete remove borrar eliminar clip",
    run: () => $("#deleteClipBtn").click(),
  },
  {
    label: "Mutate active clip",
    labelEs: "Mutar clip activo",
    group: "CLIP",
    groupEs: "CLIP",
    shortcut: "SHIFT V",
    icon: "⌁",
    keywords: "mutate mutar variation clip",
    run: () => $("#mutateBtn").click(),
  },
  {
    label: "Quantize active clip",
    labelEs: "Cuantizar clip activo",
    group: "CLIP",
    groupEs: "CLIP",
    shortcut: "SHIFT Q",
    icon: "▦",
    keywords: "quantize cuantizar snap notes",
    run: () => $("#quantizeBtn").click(),
  },
  {
    label: "Add arrangement section",
    labelEs: "Añadir sección al arreglo",
    group: "SONG",
    groupEs: "CANCIÓN",
    shortcut: "",
    icon: "＋",
    keywords: "section sección scene arrangement arreglo",
    run: () => {
      activateView("arrange");
      $("#addSceneBtn").click();
    },
  },
  {
    label: "Export to current destination",
    labelEs: "Exportar al destino actual",
    group: "PROJECT",
    groupEs: "PROYECTO",
    shortcut: "CTRL E",
    icon: "⇧",
    keywords: "export save current destino actual wav midi",
    run: repeatLastExport,
  },
  {
    label: "Export As…",
    labelEs: "Exportar como…",
    group: "PROJECT",
    groupEs: "PROYECTO",
    shortcut: "CTRL SHIFT E",
    icon: "…",
    keywords: "export as save choose elegir formato destino",
    run: () => open("#exportDialog"),
  },
  {
    label: "Export song WAV",
    labelEs: "Exportar canción WAV",
    group: "PROJECT",
    groupEs: "PROYECTO",
    shortcut: "",
    icon: "W",
    keywords: "export wav render audio canción",
    run: () => quickExportWav(false),
  },
  {
    label: "Export song MIDI",
    labelEs: "Exportar canción MIDI",
    group: "PROJECT",
    groupEs: "PROYECTO",
    shortcut: "",
    icon: "M",
    keywords: "export midi canción",
    run: () => quickExportMidi(false),
  },
  {
    label: "Export project as JSON",
    labelEs: "Exportar proyecto como JSON",
    group: "PROJECT",
    groupEs: "PROYECTO",
    shortcut: "",
    icon: "J",
    keywords: "export project json backup proyecto copia",
    run: () => quickExportProject(true),
  },
  {
    label: "Project, versions & recovery",
    labelEs: "Proyecto, versiones y recuperación",
    group: "PROJECT",
    groupEs: "PROYECTO",
    shortcut: "",
    icon: "••",
    keywords: "project proyecto save import snapshot",
    run: () => $("#menuBtn").click(),
  },
  ...TRACKS.map((track, index) => ({
    label: `Select ${TRACK_META[track].label}`,
    labelEs: `Seleccionar ${TRACK_META[track].label}`,
    group: "TRACK",
    groupEs: "PISTA",
    shortcut: String(index + 1),
    icon: String(index + 1),
    keywords: `track pista ${track} instrument instrumento`,
    run: () => selectTrack(track),
  })),
];
function matchingCommands(query: string): any {
  return workflow.matchingCommands(runtime, query);
}
function renderCommands(query = ""): any {
  return workflow.renderCommands(runtime, query);
}
function runCommand(command: CommandAction | undefined): any {
  return workflow.runCommand(runtime, command);
}
function openCommands(): any {
  return workflow.openCommands(runtime);
}
function initWorkflowUi(): any {
  return workflow.initWorkflowUi(runtime);
}

function renderVersions(): any {
  return storage.renderVersions(runtime);
}
function loadVersions(): any {
  return storage.loadVersions(runtime);
}
function saveVersion(): any {
  return storage.saveVersion(runtime);
}

let inputRecorder: MediaRecorder | null = null,
  inputStream: MediaStream | null = null,
  inputChunks: Blob[] = [],
  midiLearnTarget: string | null = null;
function applyMidiMapping(mapping: MidiMapping, normalized: number): any {
  return performanceFeature.applyMidiMapping(runtime, mapping, normalized);
}
function audioBufferWav(buffer: AudioBuffer): any {
  return workflow.audioBufferWav(runtime, buffer);
}
async function addAudioBlob(
  blob: Blob,
  name = "",
  lane?: AudioLane,
): Promise<any> {
  return audio_studio.addAudioBlob(runtime, blob, name, lane);
}
async function loadAudioAssets(): Promise<any> {
  return storage.loadAudioAssets(runtime);
}
function renderAudioStudio(): any {
  return audio_studio.renderAudioStudio(runtime);
}
function renderGlobalAutomation(): any {
  return audio_studio.renderGlobalAutomation(runtime);
}
function renderMixGroups(): any {
  return mixer.renderMixGroups(runtime);
}
function renderTempoMap(): any {
  return arrangement.renderTempoMap(runtime);
}
function samplerSettings(): SamplerInstrument {
  return sampler.samplerSettings(runtime);
}
function setupSamplerOctaveControls(): any {
  return sampler.setupSamplerOctaveControls(runtime);
}
function samplerNoteName(pitch: number): any {
  return sampler.samplerNoteName(runtime, pitch);
}
function drawSamplerWaveform(): any {
  return sampler.drawSamplerWaveform(runtime);
}
function startSamplerPerformance(
  source: string,
  pitch: number,
  velocity = 0.85,
  element?: HTMLElement | null,
): any {
  return sampler.startSamplerPerformance(
    runtime,
    source,
    pitch,
    velocity,
    element,
  );
}
function endSamplerPerformance(
  source: string,
  element?: HTMLElement | null,
): any {
  return sampler.endSamplerPerformance(runtime, source, element);
}
function renderSamplerKeyboard(): any {
  return sampler.renderSamplerKeyboard(runtime);
}
async function loadSamplerAsset(): Promise<any> {
  return sampler.loadSamplerAsset(runtime);
}
function setupSamplerKeyboard(): any {
  return sampler.setupSamplerKeyboard(runtime);
}
function setupV6Studio(): any {
  return audio_studio.setupV6Studio(runtime);
}
function setupMidiLearnUi(): any {
  return performanceFeature.setupMidiLearnUi(runtime);
}
function setupV6Copy(): any {
  return audio_studio.setupV6Copy(runtime);
}
function setupV6Safety(): any {
  return audio_studio.setupV6Safety(runtime);
}
function setupSampleSlicing(): any {
  return instruments.setupSampleSlicing(runtime);
}
function setupProjectTemplates(): any {
  return workflow.setupProjectTemplates(runtime);
}
function renderAll() {
  renderTracks();
  renderClipControls();
  renderHarmony();
  renderLocators();
  if (soundPanel) {
    renderInspector();
    renderArp();
    renderFx();
    macroMarkup($("#macros"));
  }
  if (activeView === "forge") {
    renderPiano();
    renderAutomation();
    renderKeyboard();
  }
  if (activeView === "launch") renderLauncher();
  if (activeView === "arrange") {
    renderArrangement();
    renderTempoMap();
  }
  if (activeView === "mix") {
    renderMixer();
    renderMixGroups();
  }
  if (activeView === "audio") {
    renderAudioStudio();
    renderSamplerKeyboard();
  }
  if (activeView === "perform") {
    renderKeyboard();
    macroMarkup($("#performMacros"));
    renderPerformanceTakes();
  }
  $("#title").value = project.title;
  $("#tempo").value = project.tempo;
  $("#meterSelect").value = `${project.meter.beats}/${project.meter.unit}`;
  $("#recordMode").value = project.editor.recordMode || "quantized";
  $("#swing").value = Math.round(project.swing * 100);
  $("#masterVolume").value = project.master;
  $("#masterValue").textContent = Math.round(project.master * 100);
  updateOrb();
  installControlHelp();
  syncStudioUi();
}
function syncTransportButtons(running = engine.playing): any {
  return workflow.syncTransportButtons(runtime, running);
}
function pausePlayback(): any {
  return performanceFeature.pausePlayback(runtime);
}
async function togglePlay(forceSong?: boolean): Promise<any> {
  return performanceFeature.togglePlay(runtime, forceSong);
}
function animateMeter(): any {
  return performanceFeature.animateMeter(runtime);
}
function wavOptions(): any {
  return workflow.wavOptions(runtime);
}
function setExportProgress(value: number, status?: string): any {
  return storage.setExportProgress(runtime, value, status);
}
async function exportWav(song: boolean, target?: QuickTarget): Promise<any> {
  return storage.exportWav(runtime, song, target);
}
function crc32(bytes: Uint8Array): any {
  return storage.crc32(runtime, bytes);
}
async function zipFiles(
  files: Array<{ name: string; data: Blob }>,
): Promise<any> {
  return storage.zipFiles(runtime, files);
}
async function readStoreZip(blob: Blob): Promise<any> {
  return storage.readStoreZip(runtime, blob);
}
async function importProjectFile(file: File): Promise<any> {
  return storage.importProjectFile(runtime, file);
}
async function renderStems(): Promise<any> {
  return workflow.renderStems(runtime);
}
async function renderProjectBundle(): Promise<any> {
  return workflow.renderProjectBundle(runtime);
}
const exportMeta: Record<
  QuickExportKind,
  { extension: string; type: string; description: string }
> = {
  wav: { extension: ".wav", type: "audio/wav", description: "Wave audio" },
  midi: { extension: ".mid", type: "audio/midi", description: "MIDI song" },
  project: {
    extension: ".json",
    type: "application/json",
    description: "КИБЕР VENGANCE project",
  },
  "clip-wav": {
    extension: ".wav",
    type: "audio/wav",
    description: "Wave audio",
  },
  "clip-midi": {
    extension: ".mid",
    type: "audio/midi",
    description: "MIDI clips",
  },
  stems: {
    extension: ".zip",
    type: "application/zip",
    description: "КИБЕР VENGANCE stems",
  },
  bundle: {
    extension: ".zip",
    type: "application/zip",
    description: "КИБЕР VENGANCE project package",
  },
  performance: {
    extension: ".webm",
    type: "audio/webm",
    description: "Live performance",
  },
};
function exportName(kind: QuickExportKind): any {
  return storage.exportName(runtime, kind);
}
async function performExport(
  kind: QuickExportKind,
  forcePicker = false,
): Promise<any> {
  return storage.performExport(runtime, kind, forcePicker);
}
async function quickExportWav(forcePicker = false): Promise<any> {
  return storage.quickExportWav(runtime, forcePicker);
}
async function quickExportMidi(forcePicker = false): Promise<any> {
  return storage.quickExportMidi(runtime, forcePicker);
}
function repeatLastExport(): any {
  return storage.repeatLastExport(runtime);
}

$("#playBtn").onclick = () => togglePlay();
$("#pauseBtn").onclick = pausePlayback;
$("#rewindBtn").onclick = () => {
  engine.stop();
  currentStep = -1;
  currentScene = -1;
  transportPosition = 0;
  setGlobalStart(0);
  setClipStart(0);
  updatePlayheads();
  syncTransportButtons(false);
  $("#pauseBtn").classList.remove("active");
};
$("#recordBtn").onclick = () => {
  recordArmed = !recordArmed;
  $("#recordBtn").classList.toggle("active", recordArmed);
  toast(
    recordArmed
      ? `RECORD ARMED · ${$("#countIn").value} BAR COUNT-IN`
      : "RECORD SAFE",
  );
  syncStudioUi();
};
$("#metroBtn").onclick = () => {
  metronome = !metronome;
  engine.metronome = metronome;
  $("#metroBtn").setAttribute("aria-pressed", metronome);
};
$("#tempo").onchange = () => {
  snapshot();
  project.tempo = Math.max(50, Math.min(220, +$("#tempo").value));
  changed();
};
$("#meterSelect").onchange = () => {
  snapshot();
  const [beats, unit] = $("#meterSelect").value.split("/").map(Number);
  setProjectMeter(project, beats, unit);
  selectedNotes.clear();
  changed(true);
};
$("#recordMode").onchange = () => {
  snapshot();
  project.editor.recordMode = $("#recordMode").value;
  changed();
  toast(
    project.editor.recordMode === "free"
      ? "FREE MICROTIMING RECORDING"
      : "QUANTIZED RECORDING",
  );
};
$("#swing").onchange = () => {
  snapshot();
  project.swing = Math.max(0, Math.min(0.6, +$("#swing").value / 100));
  changed();
};
$("#title").onchange = () => {
  snapshot();
  project.title = $("#title").value.trim() || "Untitled Signal";
  changed();
};
$("#masterVolume").onpointerdown = snapshot;
$("#masterVolume").oninput = () => {
  project.master = +$("#masterVolume").value;
  $("#masterValue").textContent = Math.round(project.master * 100);
  $("#mixerMaster").value = project.master;
  $("#mixerMasterValue").textContent = `${Math.round(project.master * 100)}%`;
  engine.setProject(project);
};
$("#masterVolume").onchange = () => changed();
$("#undoBtn").onclick = () => {
  releaseAllKeyboards();
  project = history.undo(project);
  void loadLocalSamples();
  void loadAudioAssets();
  engine.project = project;
  selectedNotes.clear();
  changed(true);
};
$("#redoBtn").onclick = () => {
  releaseAllKeyboards();
  project = history.redo(project);
  void loadLocalSamples();
  void loadAudioAssets();
  engine.project = project;
  selectedNotes.clear();
  changed(true);
};
$("#newClipBtn").onclick = () => {
  snapshot();
  const source = clip(),
    c = createClip(
      selectedTrack,
      `${TRACK_META[selectedTrack].label} ${clipsForTrack(project, selectedTrack).length + 1}`,
      2,
      meterSteps(project.meter),
    );
  c.character = structuredClone(source.character);
  c.instrument = structuredClone(source.instrument);
  project.clips.push(c);
  project.activeClipIds[selectedTrack] = c.id;
  selectedNotes.clear();
  changed(true);
  toast(msg("ui_5c0b75942c31"), true);
};
$("#duplicateBtn").onclick = () => {
  snapshot();
  duplicateClip(project, clip().id);
  selectedNotes.clear();
  changed(true);
  toast(msg("ui_5872d1663485"), true);
};
$("#mutateBtn").onclick = () => {
  snapshot();
  varyClip(project, clip(), clip().character.macros.tension);
  selectedNotes.clear();
  changed(true);
  toast(msg("ui_350b42aa6d46"), true);
};
$("#noteLength").onchange = () =>
  editSelection("length", $("#noteLength").value);
$("#noteVelocity").onpointerdown = () => {
  if (selectedNotes.size) snapshot();
};
$("#noteVelocity").oninput = () => {
  for (const n of clip().notes.filter((n) => selectedNotes.has(n.id)))
    n.velocity = +$("#noteVelocity").value;
  renderPiano();
};
$("#noteVelocity").onchange = () => changed();
$("#deleteNotesBtn").onclick = deleteSelection;
$("#automationParam").onchange = () => {
  project.editor.automationParam = $("#automationParam").value;
  changed();
  renderAutomation();
};
$("#clearAutomationBtn").onclick = () => {
  snapshot();
  (clip().automation as any)[project.editor.automationParam] = {};
  changed();
  renderAutomation();
  toast(msg("ui_714477b33131"), true);
};
$("#addSceneBtn").onclick = () => {
  snapshot();
  addArrangementScene(project);
  changed(true);
  focusScene(project.arrangement.length - 1);
};
$("#autoArrangeBtn").onclick = () => {
  snapshot();
  distributeArrangementPatterns(project);
  changed(true);
  toast("CLIPS DISTRIBUTED ACROSS SONG");
};
function activateView(view: string) {
  if (!["forge", "arrange", "audio", "launch", "perform", "mix"].includes(view))
    return;
  releaseAllKeyboards();
  activeView = view;
  $$("[data-view]").forEach((x) =>
    x.classList.toggle("active", x.dataset.view === view),
  );
  $$(".view").forEach((v) =>
    v.classList.toggle("active", v.id === `${view}View`),
  );
  if (!engine.playing)
    engine.songMode = ["audio", "arrange", "mix"].includes(view);
  if (view === "forge") {
    renderPiano();
    renderAutomation();
    renderKeyboard();
    renderClipControls();
  }
  if (view === "launch") renderLauncher();
  if (view === "audio") {
    renderAudioStudio();
    renderSamplerKeyboard();
  }
  if (view === "arrange") {
    renderArrangement();
    renderTempoMap();
  }
  if (view === "mix") {
    renderMixer();
    renderMixGroups();
    requestAnimationFrame(animateMixer);
  }
  if (view === "perform") {
    renderKeyboard();
    macroMarkup($("#performMacros"));
    renderPerformanceTakes();
    animateScratchDeck();
  }
  syncStudioUi();
}
$$("[data-view]").forEach(
  (b: any) => (b.onclick = () => activateView(b.dataset.view)),
);
function compatibility(): any {
  return workflow.compatibility(runtime);
}
function showCompatibility(): any {
  return workflow.showCompatibility(runtime);
}
const open = (id: string) => $(id).showModal(),
  replaceProject = (next: Project) => {
    snapshot();
    project = next;
    engine.project = project;
    selectedNotes.clear();
    globalStartStep = 0;
    clipStartSteps.clear();
    changed(true);
    $("#projectMenu").close();
  };
$("#menuBtn").onclick = () => {
  renderVersions();
  renderExportTargets();
  open("#projectMenu");
};
$("#exportBtn").onclick = repeatLastExport;
$("#exportAsBtn").onclick = () => open("#exportDialog");
$("#helpBtn").onclick = () => open("#helpDialog");
$("#aboutBtn").onclick = () => open("#aboutDialog");
$$("[data-close]").forEach(
  (b: any) => (b.onclick = () => b.closest("dialog").close()),
);
$("#newBtn").onclick = async () => {
  if (
    await requestConfirmation(
      L("New demo project", "Nuevo proyecto demo"),
      L(
        "Replace the current project? You can undo this action.",
        "¿Reemplazar el proyecto actual? Puedes deshacer esta acción.",
      ),
    )
  )
    replaceProject(createProject());
};
$("#emptyBtn").onclick = async () => {
  if (
    await requestConfirmation(
      L("New empty project", "Nuevo proyecto vacío"),
      L(
        "Replace the current project? You can undo this action.",
        "¿Reemplazar el proyecto actual? Puedes deshacer esta acción.",
      ),
    )
  )
    replaceProject(createEmptyProject());
};
$("#duplicateProjectBtn").onclick = () => {
  const copy = migrateProject(structuredClone(project));
  copy.id = crypto.randomUUID();
  copy.title = `${project.title} Copy`;
  replaceProject(copy);
  toast("PROJECT DUPLICATED");
};
$("#saveBtn").onclick = saveVersion;
$("#exportProjectBtn").onclick = () => performExport("project", true);
$("#compatBtn").onclick = () => {
  $("#projectMenu").close();
  showCompatibility();
};
$("#copyCompatBtn").onclick = async () => {
  const text = JSON.stringify(compatibility(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    toast("COMPATIBILITY REPORT COPIED");
  } catch {
    download(text, "kiber-vengance-compatibility.json", "application/json");
  }
};
$("#importProject").onchange = async (e: any) => {
  try {
    snapshot();
    project = await importProjectFile(e.target.files[0]);
    engine.project = project;
    await loadLocalSamples();
    selectedNotes.clear();
    changed(true);
    $("#projectMenu").close();
    toast("PROJECT IMPORTED");
  } catch (err) {
    toast(`IMPORT ERROR: ${err instanceof Error ? err.message : String(err)}`);
  }
};
$("#backingBtn").onclick = () => open("#backingDialog");
$("#backingIntensity").oninput = () =>
  ($("#backingIntensityValue").textContent = Math.round(
    +$("#backingIntensity").value * 100,
  ));
$("#generateBackingBtn").onclick = () => {
  snapshot();
  generateBacking(project, {
    sections: +$("#backingSections").value,
    intensity: +$("#backingIntensity").value,
    style: $("#backingStyle").value,
  });
  selectedNotes.clear();
  changed(true);
  $("#backingDialog").close();
  activateView("arrange");
  toast(msg("ui_144560ac18a5"), true);
};
$("#deleteClipDialog").onclose = () => (pendingDeleteClipId = null);
$("#confirmDeleteClipBtn").onclick = () => {
  if (!pendingDeleteClipId) return;
  const target = project.clips.find((c: any) => c.id === pendingDeleteClipId);
  if (!target) return;
  const name = target.name;
  snapshot();
  if (!deleteClip(project, pendingDeleteClipId)) {
    toast(msg("ui_49594184d6c0"));
    return;
  }
  pendingDeleteClipId = null;
  selectedNotes.clear();
  $("#deleteClipDialog").close();
  changed(true);
  toast(msg("ui_dabefe4930a0", { arg0: name }), true);
};

document.addEventListener(
  "keydown",
  (e) => {
    const target = e.target as HTMLElement,
      typing = Boolean(
        target?.closest?.(
          'textarea,[contenteditable="true"],input:not([type]),input[type="text"],input[type="search"],input[type="number"],input[type="email"],input[type="password"],input[type="url"],input[type="tel"]',
        ),
      ),
      blocked = $$("dialog").some((dialog) => dialog.open) || typing,
      key =
        e.code === "KeyS" || e.key.toLowerCase() === "s"
          ? "solo"
          : e.code === "KeyM" || e.key.toLowerCase() === "m"
            ? "mute"
            : e.code === "KeyV" || e.key.toLowerCase() === "v"
              ? "mutate"
              : null;
    if (
      !blocked &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      e.shiftKey &&
      key
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      (key === "mutate"
        ? $("#mutateBtn")
        : $(`[data-${key}="${selectedTrack}"]`)
      )?.click();
    }
  },
  { capture: true },
);

document.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openCommands();
    return;
  }
  if (mod && e.key.toLowerCase() === "e") {
    e.preventDefault();
    if (e.shiftKey) open("#exportDialog");
    else repeatLastExport();
    return;
  }
  if ($("#commandDialog").open) return;
  if (
    ["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
  )
    return;
  if (e.shiftKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    toggleFocus();
    return;
  }
  if (e.shiftKey && e.key.toLowerCase() === "g") {
    e.preventDefault();
    activateView("forge");
    return;
  }
  if (e.shiftKey && e.key.toLowerCase() === "a") {
    e.preventDefault();
    activateView("arrange");
    return;
  }
  if (e.shiftKey && e.key.toLowerCase() === "l") {
    e.preventDefault();
    activateView("launch");
    return;
  }
  if (e.shiftKey && e.key.toLowerCase() === "x") {
    e.preventDefault();
    activateView("mix");
    return;
  }
  if (e.shiftKey && e.key.toLowerCase() === "p") {
    e.preventDefault();
    activateView("perform");
    return;
  }
  if (e.shiftKey && e.key.toLowerCase() === "n") {
    e.preventDefault();
    $("#newClipBtn").click();
    return;
  }
  if (e.shiftKey && e.key.toLowerCase() === "d") {
    e.preventDefault();
    $("#duplicateBtn").click();
    return;
  }
  if (e.shiftKey && e.key.toLowerCase() === "v") {
    e.preventDefault();
    $("#mutateBtn").click();
    return;
  }
  if (e.shiftKey && e.key.toLowerCase() === "q") {
    e.preventDefault();
    $("#quantizeBtn").click();
    return;
  }
  if (e.key.toLowerCase() === "r" && !mod) {
    e.preventDefault();
    $("#recordBtn").click();
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
    return;
  }
  if (/^Digit[1-5]$/.test(e.code)) {
    selectedTrack = TRACKS[+e.code.at(-1)! - 1] ?? "lead";
    selectedNotes.clear();
    renderAll();
    setDefaultScroll();
    return;
  }
  if (mod && e.key.toLowerCase() === "z") {
    e.preventDefault();
    releaseAllKeyboards();
    project = e.shiftKey ? history.redo(project) : history.undo(project);
    void loadLocalSamples();
    void loadAudioAssets();
    engine.project = project;
    selectedNotes.clear();
    changed(true);
    return;
  }
  if (mod && e.key.toLowerCase() === "a") {
    e.preventDefault();
    selectedNotes = new Set(clip().notes.map((n) => n.id));
    syncSelectedClasses();
    renderSelection();
    return;
  }
  if (mod && e.key.toLowerCase() === "c") {
    clipboard = clip()
      .notes.filter((n) => selectedNotes.has(n.id))
      .map((n) => structuredClone(n));
    toast(`${clipboard.length} NOTES COPIED`);
    return;
  }
  if (mod && e.key.toLowerCase() === "v" && clipboard.length) {
    e.preventDefault();
    snapshot();
    const min = Math.min(...clipboard.map((n) => n.step)),
      offset = Math.min(clipLengthSteps(clip()) - 1, min + 4) - min,
      newNotes = clipboard.map((n) => ({
        ...n,
        id: crypto.randomUUID(),
        step: Math.min(clipLengthSteps(clip()) - n.length, n.step + offset),
      }));
    clip().notes.push(...newNotes);
    selectedNotes = new Set(newNotes.map((n) => n.id));
    changed();
    renderPiano();
    return;
  }
  if (["Delete", "Backspace"].includes(e.key)) {
    e.preventDefault();
    deleteSelection();
    return;
  }
  if (selectedNotes.size && e.key.startsWith("Arrow")) {
    e.preventDefault();
    snapshot();
    const delta = e.shiftKey ? 4 : project.editor.snap;
    for (const n of clip().notes.filter((n) => selectedNotes.has(n.id))) {
      if (e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft"))
        n.length = Math.max(
          project.editor.snap,
          Math.min(
            clipLengthSteps(clip()) - n.step,
            n.length + (e.key === "ArrowRight" ? delta : -delta),
          ),
        );
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft")
        n.step = Math.max(
          0,
          Math.min(
            clipLengthSteps(clip()) - n.length,
            n.step + (e.key === "ArrowRight" ? delta : -delta),
          ),
        );
      else if (selectedTrack !== "drums")
        n.pitch = Math.max(
          TRACK_META[selectedTrack].low,
          Math.min(
            TRACK_META[selectedTrack].high,
            n.pitch + (e.key === "ArrowUp" ? 1 : -1),
          ),
        );
    }
    changed();
    renderPiano();
    return;
  }
  const source = e.key.toLowerCase(),
    activeKeyMap = selectedTrack === "drums" ? drumKeyMap : keyMap,
    i = activeKeyMap.indexOf(source);
  if (
    i >= 0 &&
    !e.repeat &&
    !e.shiftKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    !recording.has(source)
  ) {
    const keyboardId =
        activeView === "perform" ? "performanceKeyboard" : "keyboard",
      key = $(`#${keyboardId} .key[data-source="${source}"]`);
    if (key) startPerformance(source, +key.dataset.pitch, 0.82, key);
  }
});
document.addEventListener("keyup", (e) => {
  const source = e.key.toLowerCase(),
    activeKeyMap = selectedTrack === "drums" ? drumKeyMap : keyMap,
    keyboardId = activeView === "perform" ? "performanceKeyboard" : "keyboard";
  if (activeKeyMap.includes(source))
    endPerformance(source, $(`#${keyboardId} .key[data-source="${source}"]`));
});
async function initMidi(): Promise<any> {
  return performanceFeature.initMidi(runtime);
}
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
if (query.get("view")) activateView(query.get("view")!);
$("#app").hidden = false;
$("#boot")?.remove();
setDefaultScroll();
initMidi();
if ("serviceWorker" in navigator && !query.has("qa"))
  navigator.serviceWorker.register("./sw.js").catch(() => {});

function syncStudioUi() {
  workflow.syncClipTransportButton(runtime);
  if (!copyQueued) {
    copyQueued = true;
    queueMicrotask(() => {
      copyQueued = false;
      translateDOM();
    });
  }
  studioBridge.update({
    view: activeView as StudioView,
    language,
    context: TRACK_META[selectedTrack].label,
    inspector: soundPanel,
    playing: Boolean(engine.playing),
    paused: studioBridge.getSnapshot().paused,
    songMode: Boolean(engine.songMode),
    armed: recordArmed,
  });
  const context = $("#clipContext");
  if (!context) return;
  const c = clip();
  context.textContent = `${TRACK_META[selectedTrack].label} → ${c.name} · ${c.bars} ${msg("ui_5a599b482fc1")}`;
  document.body.classList.toggle("sound-panel", soundPanel);
  document.body.dataset.editorTool = editorTool;
  $$("[data-studio-tab]").forEach((b: any) => {
    const tab = b.dataset.studioTab;
    const active =
      tab === "sound"
        ? activeView === "forge" && soundPanel
        : tab === "clips"
          ? activeView === "forge" && !soundPanel
          : activeView === tab;
    b.setAttribute("aria-pressed", String(active));
  });
  $$("button[data-editor-tool]").forEach((b: any) =>
    b.setAttribute("aria-pressed", String(b.dataset.editorTool === editorTool)),
  );
  const hint = $("#recordHint");
  hint.textContent = recordArmed
    ? msg("ui_bef5cb5becd0")
    : msg("ui_401015e021e1");
}
function duplicateSelectedNotes(): any {
  return performanceFeature.duplicateSelectedNotes(runtime);
}
function quantizeSelectedNotes(): any {
  return performanceFeature.quantizeSelectedNotes(runtime);
}
function setupStudioUi(): any {
  return workflow.setupStudioUi(runtime);
}
setupStudioUi();

function setupConsistentControls(): any {
  return workflow.setupConsistentControls(runtime);
}
setupConsistentControls();
syncTransportButtons();

studioBridge.navigate = (view) => activateView(view);
studioBridge.melodyTarget = () =>
  selectedTrack === "drums"
    ? null
    : {
        projectId: project.id,
        clipId: clip().id,
        track: selectedTrack,
        key: project.key,
        scale: project.scale,
        stepsPerBar: meterSteps(project.meter),
        tempo: project.tempo,
        context: captureMusicalContext(project, selectedTrack),
      };
studioBridge.applyMelody = (target, name, bars, notes, options = {}) => {
  const generated = buildPresetClip(
    project,
    target,
    name,
    bars,
    notes,
    options,
  );
  snapshot();
  commitPresetClip(project, generated, options.tempo);
  selectedTrack = target.track;
  selectedNotes.clear();
  changed(true);
  activateView("forge");
  toast(
    translate(
      "AI melody added as a new clip",
      "Melodía IA añadida como clip nuevo",
    ),
    true,
  );
};
studioBridge.storeSoundPreset = (value) => {
  const preset = validateSoundPreset(value);
  saveUserPresets([...userPresets(), { ...preset, id: crypto.randomUUID() }]);
};
studioBridge.auditionMelody = (
  target,
  notes,
  onEnd,
  sound,
  options = { bars: 4, loop: false },
) => {
  let cancelled = false;
  let pending: typeof notes | null = null;
  let ending: ReturnType<typeof setTimeout> | undefined;
  const previewProject = structuredClone(project);
  const previewClip = buildPresetClip(
    previewProject,
    target,
    "Preview",
    options.bars,
    notes,
    sound ? { sound } : {},
  );
  previewProject.clips.push(previewClip);
  previewProject.activeClipIds[target.track] = previewClip.id;
  previewProject.tempo = target.tempo;
  previewProject.tempoMap = [
    { id: "preview-tempo", step: 0, bpm: target.tempo, curve: "jump" },
  ];
  previewProject.automationLanes = [];
  previewProject.modulationRoutes = [];
  for (const track of TRACKS) {
    previewProject.tracks[track].mute = track !== target.track;
    previewProject.tracks[track].solo = false;
    const active = activeClip(previewProject, track);
    if (active !== previewClip) {
      active.bars = options.bars;
      active.stepsPerBar = target.stepsPerBar;
    }
  }
  const previewEngine = new AudioEngine();
  const total = options.bars * target.stepsPerBar;
  const stop = () => {
    cancelled = true;
    clearTimeout(ending);
    previewEngine.stop();
    if (previewEngine.ctx && previewEngine.ctx.state !== "closed")
      void previewEngine.ctx.close().catch(() => {});
  };
  previewEngine.onStep = (step, time) => {
    if (cancelled || step < 0 || step % total !== total - 1) return;
    if (options.loop) {
      if (pending) {
        previewClip.notes = pending;
        pending = null;
      }
    } else if (!ending) {
      ending = setTimeout(
        () => {
          stop();
          onEnd();
        },
        Math.max(
          0,
          (time - previewEngine.ctx.currentTime + 60 / target.tempo / 4) * 1000,
        ),
      );
    }
  };
  void previewEngine
    .init()
    .then(async () => {
      if (cancelled) {
        stop();
        return;
      }
      if (project.id !== target.projectId)
        throw new Error("The project changed.");
      await previewEngine.start(previewProject);
      if (cancelled) stop();
    })
    .catch((error) => {
      if (cancelled) return;
      stop();
      onEnd(String(error));
    });
  return {
    stop,
    replace: (next) => {
      pending = structuredClone(next);
    },
  };
};
studioBridge.toggleFocus = () => toggleFocus();
studioBridge.toggleInspector = () => {
  soundPanel = !soundPanel;
  if (soundPanel) {
    renderInspector();
    renderArp();
    renderFx();
    macroMarkup($("#macros"));
    installControlHelp();
  }
  syncStudioUi();
};
studioBridge.release = () => {
  releaseKeyPointers();
  releaseAllKeyboards();
  for (const key of keyMap) endPerformance(key);
  for (const source of samplerHeld.keys()) endSamplerPerformance(source);
};
window.addEventListener("blur", () => studioBridge.release());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) studioBridge.release();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    if (activeView === "perform") animateScratchDeck();
    if (activeView === "mix") animateMixer();
  }
});
