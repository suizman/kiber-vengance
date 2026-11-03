import { AudioEngine } from "../audio";
import { createEmptyProject, projectSeconds } from "../core";
import { insertScore } from "./insert";
import type { ScoreDocument } from "./model";

/** A separate, bounded preview never mutates the composition or leaves delayed voices alive. */
export class ScoreAudition {
  private engine = new AudioEngine();
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  async play(
    document: ScoreDocument,
    sectionIndex: number,
    partIndex: number,
    signal: AbortSignal,
    ended: () => void,
  ) {
    const selected = structuredClone(document.sections[sectionIndex]!);
    selected.parts = [selected.parts[partIndex]!];
    const project = createEmptyProject();
    insertScore(
      project,
      { ...document, sections: [selected] },
      {
        id: "preview",
        name: document.title,
        format: document.format,
        assetId: "preview",
        partTracks: [],
      },
    );
    project.outputMix!.master = 0.7;
    this.engine.songMode = true;
    const abort = () => this.stop();
    signal.addEventListener("abort", abort, { once: true });
    try {
      signal.throwIfAborted();
      await this.engine.start(project);
      if (this.stopped || signal.aborted) {
        this.stop();
        return;
      }
      this.timer = setTimeout(
        () => {
          this.stop();
          ended();
        },
        Math.min(30, projectSeconds(project, selected.durationSteps, false)) *
          1000,
      );
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.engine.stop();
    if (this.engine.ctx && this.engine.ctx.state !== "closed")
      void this.engine.ctx.close();
  }
}
