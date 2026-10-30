import type { Project, Clip } from "../model";
import { projectSeconds } from "../core";

export type VocalEngine = "diffsinger" | "acestep";
export type VocalDevice = "auto" | "cpu" | "gpu";
export interface SingingNote {
  start: number;
  duration: number;
  pitch: number;
  lyric: string;
  phonemes: string;
  velocity: number;
}
export interface DesktopVoice {
  id: string;
  name: string;
  speakers: string[];
  languages: string[];
  expression: string[];
  license: string;
  licenseUrl: string;
  attribution: string;
  commercial: boolean | null;
  phonemes?: string[];
}
export interface VocalResult {
  engine: VocalEngine;
  model: string;
  revision: string;
  device: string;
  outputKind: "score-vocal" | "musical-proposal";
  settings: Record<string, unknown>;
  audioId: string;
  seconds: number;
  elapsedSeconds: number;
  sha256: string;
  attribution?: string;
  licenseUrl?: string;
}
export interface CompanionJob {
  id: string;
  kind: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  message: string;
  progress: number;
  error: string | null;
  result: VocalResult | null;
}
export interface CompanionStatus {
  version: string;
  protocol: number;
  hardware: {
    os: string;
    architecture: string;
    distribution: string;
    memoryGB: number;
    freeDiskGB: number;
    gpuDetected: string;
    recommended: string;
    profiles: string[];
  };
  runtimes: {
    engine: VocalEngine;
    profile: string;
    probe: Record<string, unknown>;
  }[];
  voices: DesktopVoice[];
  acestep: { model: string; revision: string } | null;
  jobs: CompanionJob[];
}
const CONNECTION_KEY = "kv-desktop-vocals-connection-v1";

export function capturedSingingNotes(
  project: Project,
  clip: Clip,
  atStep: number,
): SingingNote[] {
  const origin = projectSeconds(project, atStep);
  const notes = [...clip.notes].sort(
    (a, b) => a.step + a.offset - b.step - b.offset || a.pitch - b.pitch,
  );
  if (!notes.length || notes.length > 256)
    throw new Error(
      "Choose a clip containing 1–256 notes / Elige un clip con 1–256 notas",
    );
  let end = -Infinity;
  return notes.map((note) => {
    const start =
      projectSeconds(project, atStep + Math.max(0, note.step + note.offset)) -
      origin;
    const finish =
      projectSeconds(
        project,
        atStep + Math.max(0, note.step + note.offset) + note.length,
      ) - origin;
    if (start < end - 0.0001)
      throw new Error(
        "Singing requires a monophonic clip: notes overlap / El canto requiere un clip monofónico: hay notas solapadas",
      );
    if (finish > 120 || finish - start < 0.03)
      throw new Error(
        "Notes must last at least 30 ms; maximum phrase 120 seconds / Notas de al menos 30 ms; frase máxima 120 segundos",
      );
    end = finish;
    return {
      start,
      duration: finish - start,
      pitch: note.pitch,
      velocity: note.velocity,
      lyric: "la",
      phonemes: "",
    };
  });
}

export function desktopVocalsMobile(): boolean {
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

export class DesktopVocalsClient {
  port = 19738;
  token = "";
  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONNECTION_KEY) || "null");
      if (
        saved &&
        Number.isInteger(saved.port) &&
        saved.port >= 1024 &&
        saved.port <= 65535 &&
        typeof saved.token === "string"
      ) {
        this.port = saved.port;
        this.token = saved.token;
      }
    } catch {
      /* A corrupt connection must not prevent the studio from opening. */
    }
  }
  async request<T>(
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const response = await fetch(`http://127.0.0.1:${this.port}/api/${path}`, {
      ...(body === undefined
        ? {}
        : { method: "POST", body: JSON.stringify(body) }),
      headers: {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      signal: signal ?? AbortSignal.timeout(15000),
      credentials: "omit",
      cache: "no-store",
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      throw new Error(failure.error || `Companion HTTP ${response.status}`);
    }
    if (response.headers.get("content-type")?.startsWith("audio/"))
      return (await response.blob()) as T;
    return (await response.json()) as T;
  }
  async pair(code: string) {
    if (!/^\d{6}$/.test(code))
      throw new Error(
        "Enter the six-digit companion code / Introduce el código de seis cifras",
      );
    const result = await this.request<{ token: string; protocol: number }>(
      "pair",
      { code },
    );
    if (result.protocol !== 1 || typeof result.token !== "string")
      throw new Error("Update the companion / Actualiza el asistente");
    this.token = result.token;
    localStorage.setItem(
      CONNECTION_KEY,
      JSON.stringify({ port: this.port, token: this.token }),
    );
  }
  disconnect() {
    this.token = "";
    localStorage.removeItem(CONNECTION_KEY);
  }
  async status() {
    const result = await this.request<CompanionStatus>("status");
    if (result.protocol !== 1)
      throw new Error("Update the companion / Actualiza el asistente");
    return result;
  }
  async submit(kind: string, payload: unknown) {
    return this.request<CompanionJob>("jobs", { kind, payload });
  }
  async cancel(id: string) {
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("Invalid job ID");
    return this.request<CompanionJob>(`jobs/${id}/cancel`, {});
  }
  async wait(
    id: string,
    progress: (job: CompanionJob) => void,
    signal: AbortSignal,
  ): Promise<CompanionJob> {
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("Invalid job ID");
    while (true) {
      signal.throwIfAborted();
      const job = await this.request<CompanionJob>(
        `jobs/${id}`,
        undefined,
        signal,
      );
      progress(job);
      if (job.status === "failed") throw new Error(job.error || job.message);
      if (job.status === "cancelled")
        throw new DOMException("Cancelled", "AbortError");
      if (job.status === "succeeded") return job;
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(new DOMException("Cancelled", "AbortError"));
        };
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", abort);
          resolve();
        }, 1000);
        signal.addEventListener("abort", abort, { once: true });
      });
    }
  }
  async audio(id: string): Promise<Blob> {
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("Invalid audio ID");
    return this.request<Blob>(
      `audio/${id}`,
      undefined,
      AbortSignal.timeout(120000),
    );
  }
}
