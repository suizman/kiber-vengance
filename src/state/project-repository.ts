import type { Project } from "../model";
import { applyChanges, changesBetween, type Change } from "./history";

export interface SavedVersion {
  id: string;
  label: string;
  date: number;
}
interface StoredProject {
  revision: string;
  project: Project | null;
}
interface Journal {
  bases: Array<{ revision: string; changes: Change[] }>;
}
const JOURNAL_KEY = "kiber-vengance-journal-v7";

/** Browser project data stays separate from audio blobs and model downloads. */
export class ProjectRepository {
  private worker: Worker | undefined;
  private failure: Error | undefined;
  readonly recoveryNotices: string[] = [];
  private requests = new Map<
    number,
    { resolve(value: unknown): void; reject(reason: Error): void }
  >();
  private sequence = 0;
  private snapshots = new Map<string, Project | null>([["empty", null]]);
  private durable = "empty";
  constructor() {
    try {
      this.worker = new Worker(
        new URL("./project-store-worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch (error) {
      this.failure = error instanceof Error ? error : new Error(String(error));
      return;
    }
    this.worker.onmessage = ({
      data,
    }: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const pending = this.requests.get(data.id);
      if (!pending) return;
      this.requests.delete(data.id);
      if (data.error) pending.reject(new Error(data.error));
      else pending.resolve(data.result);
    };
    this.worker.onerror = () => {
      this.failure = new Error(
        "Project storage worker failed. Export the project and reload to retry.",
      );
      for (const request of this.requests.values())
        request.reject(this.failure);
      this.requests.clear();
    };
  }
  private request<T>(action: string, payload?: unknown): Promise<T> {
    if (this.failure || !this.worker)
      return Promise.reject(
        this.failure || new Error("Project worker is unavailable"),
      );
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.requests.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      try {
        this.worker!.postMessage({ id, action, payload });
      } catch (error) {
        this.requests.delete(id);
        reject(error);
      }
    });
  }
  async load(): Promise<Project | null> {
    const stored = await this.request<StoredProject | null>("load");
    this.durable = stored?.revision || "empty";
    this.snapshots.clear();
    this.snapshots.set(this.durable, stored?.project || null);
    let result = stored?.project || null;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(JOURNAL_KEY);
    } catch {
      this.recoveryNotices.push(
        "The emergency journal is unavailable; IndexedDB remains the canonical project store.",
      );
    }
    if (raw) {
      try {
        const journal = JSON.parse(raw) as Journal;
        if (!Array.isArray(journal.bases))
          throw new Error("Invalid emergency journal");
        const base = journal.bases.find(
          (item) => item.revision === this.durable,
        );
        if (base) result = applyChanges(result, base.changes, "after");
      } catch {
        localStorage.setItem(`${JOURNAL_KEY}-unreadable-${Date.now()}`, raw);
        localStorage.removeItem(JOURNAL_KEY);
        this.recoveryNotices.push(
          "An unreadable emergency journal was preserved. The last completed save was restored.",
        );
      }
    }
    return result;
  }
  async save(project: Project): Promise<void> {
    const revision = crypto.randomUUID();
    const snapshot = structuredClone(project);
    this.snapshots.set(revision, snapshot);
    try {
      await this.request("save", { revision, project: snapshot });
      this.snapshots.delete(this.durable);
      this.durable = revision;
    } catch (error) {
      this.snapshots.delete(revision);
      throw error;
    }
  }
  /** Small inverse-safe journal covers both sides of an in-flight IDB commit. */
  preservePending(project: Project): void {
    const bases = [...this.snapshots].map(([revision, snapshot]) => ({
      revision,
      changes: changesBetween(snapshot, project),
    }));
    localStorage.setItem(JOURNAL_KEY, JSON.stringify({ bases }));
  }
  listVersions(): Promise<SavedVersion[]> {
    return this.request("list-versions");
  }
  getVersion(id: string): Promise<Project | null> {
    return this.request("get-version", id);
  }
  saveVersion(project: Project, label: string): Promise<void> {
    return this.request("save-version", {
      id: crypto.randomUUID(),
      label,
      date: Date.now(),
      project,
    });
  }
  deleteVersion(id: string): Promise<void> {
    return this.request("delete-version", id);
  }
  importLegacyVersions(raw: string): Promise<void> {
    return this.request("import-versions", raw);
  }
  quarantineCurrent(): Promise<void> {
    return this.request("quarantine");
  }
}
