import type { Project, TrackId } from "../model";
import type { DeckId, DeckProcessor } from "../audio/deck";
export interface DeckAudio {
  readonly drumSamples: import("../audio").AudioEngine["drumSamples"];
  ctx: AudioContext;
  init(): Promise<AudioContext>;
  deck(id: DeckId): DeckProcessor;
  setProject(project: Project): void;
  loadScratchBuffer(buffer: AudioBuffer, id?: DeckId): Promise<void>;
  setScratchPlaying(value: boolean, id?: DeckId): void;
  setScratchSpeed(value: number, ramp?: number, id?: DeckId): void;
  setScratchFilter(value: number, id?: DeckId): void;
  setScratchStutter(frames: number, id?: DeckId): void;
  syncScratch(frames: number, id?: DeckId, speed?: number): void;
}
export interface DeckContext {
  readonly project: Project;
  readonly activeView: string;
  readonly engine: DeckAudio;
  $(selector: string): HTMLInputElement;
  L(en: string, es: string): string;
  toast(message: string): void;
  audioBufferWav(buffer: AudioBuffer): Blob;
  addAudioBlob(blob: Blob, name: string): Promise<unknown>;
}
export interface NoteEditorContext {
  readonly project: Project;
  selectedTrack: TrackId;
  selectedNotes: Set<string>;
  beginProjectEdit(): import("./project-session").ProjectEdit;
  editorTool: "draw" | "select" | "navigate";
  syncSelectedClasses(): void;
  renderSelection(): void;
  renderPiano(): void;
  changed(render?: boolean): void;
}

export interface DeckMixerContext extends DeckContext {
  snapshot(): void;
  changed(render?: boolean): void;
  scratchBuffer: AudioBuffer | null;
  readonly engine: DeckAudio & {
    scratchCueDestination: MediaStreamAudioDestinationNode;
    scratchCrossfade: number;
    setScratchMix(value: number): void;
    setScratchCrossfade(value: number): void;
    setScratchCue(deck: DeckId | null): void;
  };
}
