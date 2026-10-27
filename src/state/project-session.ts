import type { Project } from "../model";
import type { History } from "../core";
export type SaveState = "pending" | "saved" | "failed";
export class ProjectEdit {
  private dirty = false;
  constructor(
    private before: Project,
    private history: History<Project>,
    private notify: () => void,
  ) {}
  markChanged() {
    if (!this.dirty) {
      this.history.push(this.before);
      this.dirty = true;
    }
  }
  commit() {
    if (this.dirty) {
      this.dirty = false;
      this.notify();
    }
  }
}
/** Persistence owns its timer; one completed edit produces one history entry and notification. */
export class ProjectSession {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastRecovery = 0;
  constructor(
    private getProject: () => Project,
    readonly history: History<Project>,
    private options: {
      storage: Pick<Storage, "setItem">;
      key: string;
      status: (state: SaveState) => void;
      recovery: (project: Project) => void;
      recoveryFailed: () => void;
    },
  ) {}
  checkpoint() {
    this.history.push(this.getProject());
  }
  beginEdit(notify: () => void) {
    return new ProjectEdit(
      structuredClone(this.getProject()),
      this.history,
      notify,
    );
  }
  changed() {
    this.getProject().modifiedAt = Date.now();
    this.options.status("pending");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 350);
  }
  flush() {
    clearTimeout(this.timer);
    this.timer = undefined;
    const project = this.getProject();
    try {
      this.options.storage.setItem(this.options.key, JSON.stringify(project));
      this.options.status("saved");
    } catch {
      this.options.status("failed");
      return;
    }
    if (Date.now() - this.lastRecovery > 60000) {
      try {
        this.options.recovery(project);
        this.lastRecovery = Date.now();
      } catch {
        this.options.recoveryFailed();
      }
    }
  }
  dispose() {
    clearTimeout(this.timer);
  }
}
