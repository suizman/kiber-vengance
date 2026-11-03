import type { Project } from "../model";
import type { History } from "../core";
export type SaveState = "pending" | "saved" | "failed";
export class ProjectEdit {
  private dirty = false;
  constructor(
    private current: () => Project,
    private history: History<Project>,
    private notify: () => void,
  ) {}
  markChanged() {
    if (!this.dirty) {
      this.history.push(this.current());
      this.dirty = true;
    }
  }
  commit() {
    if (this.dirty) {
      this.dirty = false;
      this.history.finish?.(this.current());
      this.notify();
    }
  }
}
/** Persistence owns its timer; one completed edit produces one history entry and notification. */
export class ProjectSession {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastRecovery = 0;
  private pending = false;
  private revision = 0;
  constructor(
    private getProject: () => Project,
    readonly history: History<Project>,
    private options: {
      storage?: Pick<Storage, "setItem">;
      save?: (project: Project) => Promise<void>;
      key: string;
      status: (state: SaveState) => void;
      recovery: (project: Project) => void | Promise<void>;
      recoveryFailed: () => void;
    },
  ) {}
  checkpoint() {
    this.history.push(this.getProject());
  }
  beginEdit(notify: () => void) {
    return new ProjectEdit(this.getProject, this.history, notify);
  }
  changed() {
    this.revision++;
    this.pending = true;
    this.getProject().modifiedAt = Date.now();
    this.options.status("pending");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 350);
  }
  flush() {
    if (!this.pending) return;
    this.pending = false;
    clearTimeout(this.timer);
    this.timer = undefined;
    const project = this.getProject(),
      revision = this.revision;
    const succeeded = () => {
      if (revision === this.revision) this.options.status("saved");
      if (Date.now() - this.lastRecovery > 60000) {
        this.lastRecovery = Date.now();
        try {
          const result = this.options.recovery(project);
          if (result instanceof Promise)
            void result.catch(() => this.options.recoveryFailed());
        } catch {
          this.options.recoveryFailed();
        }
      }
    };
    const failed = () => {
      if (revision !== this.revision) return;
      this.pending = true;
      this.options.status("failed");
    };
    if (this.options.save)
      return this.options.save(project).then(succeeded, failed);
    try {
      if (!this.options.storage) throw new Error("Project storage unavailable");
      this.options.storage.setItem(this.options.key, JSON.stringify(project));
      succeeded();
    } catch {
      failed();
    }
  }
  dispose() {
    clearTimeout(this.timer);
  }
}
