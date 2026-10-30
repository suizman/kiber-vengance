import { voiceGenerationUnavailable } from "../ai/voice-safety";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  activeClip,
  createAudioLane,
  createAudioRegion,
  cryptoId,
  projectSeconds,
} from "../core";
import type { AudioEngine } from "../audio";
import { processAudio } from "../audio/effects";
import { normalizeEffects } from "../audio/effects-model";
import type { AudioEffects, Project, TrackId } from "../model";
import {
  capturedSingingNotes,
  DesktopVocalsClient,
  type CompanionJob,
  type CompanionStatus,
  type SingingNote,
  type VocalEngine,
  type VocalDevice,
  type VocalResult,
} from "../ai/desktop-vocals";
import { mountAudioEffects } from "./audio-effects";
import { getLanguage, subscribeLanguage } from "./i18n";
import "./styles/desktop-vocals.css";

interface Context {
  project: Project;
  selectedTrack: TrackId;
  transportPosition: number;
  globalStartStep: number;
  engine: AudioEngine;
  putAsset(id: string, blob: Blob): Promise<void>;
  snapshot(): void;
  changed(render?: boolean): void;
  loadAudioAssets(): Promise<void>;
  renderAudioStudio(): void;
  toast(message: string, undo?: boolean): void;
}
interface Target {
  project: string;
  lane: string;
  step: number;
  clip: string;
}
interface DownloadManifest {
  releasePage: string;
  requiresRepositoryAccess?: boolean;
  assets: {
    platform: string;
    label: string;
    url: string;
    available: boolean;
  }[];
}

export function openDesktopVocals() {
  if (voiceGenerationUnavailable(navigator)) return;
  window.dispatchEvent(new Event("kv-open-desktop-vocals"));
}

export function setupDesktopVocals(ctx: Context) {
  if (voiceGenerationUnavailable(navigator)) return;
  const host = document.createElement("div");
  document.body.append(host);
  const launcher = document.createElement("button");
  launcher.id = "desktopVocalsBtn";
  launcher.textContent =
    getLanguage() === "es" ? "Canto · Desktop" : "Singing · Desktop";
  subscribeLanguage((language) => {
    launcher.textContent =
      language === "es" ? "Canto · Desktop" : "Singing · Desktop";
  });
  launcher.onclick = openDesktopVocals;
  document.querySelector(".audio-actions")?.append(launcher);
  function DesktopVocals() {
    const [open, setOpen] = useState(false),
      [es, setEs] = useState(getLanguage() === "es");
    const [status, setStatus] = useState<CompanionStatus | null>(null),
      [message, setMessage] = useState("");
    const [engine, setEngine] = useState<VocalEngine>("diffsinger"),
      [device, setDevice] = useState<VocalDevice>("auto");
    const [profile, setProfile] = useState("cpu"),
      [code, setCode] = useState(""),
      [busy, setBusy] = useState(false);
    const [voice, setVoice] = useState(""),
      [speaker, setSpeaker] = useState(""),
      [language, setLanguage] = useState<"es" | "en">("es");
    const [lyrics, setLyrics] = useState(""),
      [style, setStyle] = useState(
        "Industrial electro-rock, expressive powerful vocals, dark cinematic atmosphere",
      );
    const [duration, setDuration] = useState(30),
      [seed, setSeed] = useState(-1),
      [vibrato, setVibrato] = useState(0.18);
    const [portamentoMs, setPortamentoMs] = useState(35),
      [expression, setExpression] = useState<Record<string, number>>({}),
      [inventory, setInventory] = useState("");
    const [notes, setNotes] = useState<SingingNote[]>([]),
      [clipName, setClipName] = useState("");
    const [lane, setLane] = useState(""),
      [job, setJob] = useState<CompanionJob | null>(null);
    const [result, setResult] = useState<VocalResult | null>(null),
      [raw, setRaw] = useState<Blob | null>(null);
    const [url, setUrl] = useState(""),
      [processedUrl, setProcessedUrl] = useState(""),
      [processed, setProcessed] = useState(false);
    const [effects, setEffects] = useState<AudioEffects>(normalizeEffects()),
      [downloads, setDownloads] = useState<DownloadManifest | null>(null);
    const client = useRef(new DesktopVocalsClient()),
      dialog = useRef<HTMLDialogElement>(null),
      audio = useRef<HTMLAudioElement>(null);
    const effectHost = useRef<HTMLDivElement>(null),
      controller = useRef<AbortController | null>(null),
      pending = useRef<string>("");
    const epoch = useRef(0),
      target = useRef<Target | null>(null),
      sourceClip = useRef(""),
      sourceProject = useRef("");
    const L = (en: string, spanish: string) => (es ? spanish : en);
    const selectedVoice = status?.voices.find((item) => item.id === voice);
    const selectedRuntime = status?.runtimes.find(
      (item) => item.engine === engine && item.profile === profile,
    );
    const installed =
      !!selectedRuntime &&
      (engine === "diffsinger" ? !!selectedVoice : !!status?.acestep);
    useEffect(() => {
      const show = () => {
        setEs(getLanguage() === "es");
        setLane(ctx.project.audioLanes[0]?.id || "");
        setOpen(true);
      };
      window.addEventListener("kv-open-desktop-vocals", show);
      return () => window.removeEventListener("kv-open-desktop-vocals", show);
    }, []);
    useEffect(() => {
      if (open) {
        dialog.current?.showModal();
        void fetch(new URL("desktop-companion.json", document.baseURI))
          .then((response) => {
            if (!response.ok) throw new Error("Download manifest unavailable");
            return response.json();
          })
          .then(setDownloads)
          .catch(() => {});
      } else dialog.current?.close();
    }, [open]);
    useEffect(() => {
      if (!raw) return;
      const next = URL.createObjectURL(raw);
      setUrl(next);
      return () => URL.revokeObjectURL(next);
    }, [raw]);
    useEffect(() => {
      if (!raw) return;
      let active = true,
        next = "";
      const context = new AudioContext();
      void (async () => {
        try {
          const buffer = await context.decodeAudioData(await raw.arrayBuffer());
          const output = await processAudio(
            buffer,
            effects,
            effects.delay || effects.reverb ? 2.5 : 0,
          );
          if (!active) return;
          // Preserve stereo generated proposals. The original WAV is never overwritten.
          const channels = output.numberOfChannels,
            frames = output.length;
          const data = new ArrayBuffer(44 + frames * channels * 2),
            view = new DataView(data);
          const str = (at: number, text: string) =>
            [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
          str(0, "RIFF");
          view.setUint32(4, data.byteLength - 8, true);
          str(8, "WAVEfmt ");
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, channels, true);
          view.setUint32(24, output.sampleRate, true);
          view.setUint32(28, output.sampleRate * channels * 2, true);
          view.setUint16(32, channels * 2, true);
          view.setUint16(34, 16, true);
          str(36, "data");
          view.setUint32(40, frames * channels * 2, true);
          const samples = Array.from({ length: channels }, (_, i) =>
            output.getChannelData(i),
          );
          for (let i = 0; i < frames; i++)
            for (let channel = 0; channel < channels; channel++) {
              const sample = Math.max(-1, Math.min(1, samples[channel]![i]!));
              view.setInt16(
                44 + (i * channels + channel) * 2,
                Math.round(sample * (sample < 0 ? 32768 : 32767)),
                true,
              );
            }
          next = URL.createObjectURL(new Blob([data], { type: "audio/wav" }));
          setProcessedUrl(next);
        } catch (error) {
          if (active) setMessage(String(error));
        } finally {
          await context.close();
        }
      })();
      return () => {
        active = false;
        if (next) URL.revokeObjectURL(next);
        setProcessedUrl("");
      };
    }, [raw, effects]);
    useEffect(() => {
      if (!open || !effectHost.current) return;
      effectHost.current.replaceChildren();
      const owner = { effects };
      mountAudioEffects(
        effectHost.current,
        owner,
        {
          project: ctx.project,
          snapshot: () => {},
          changed: () => setEffects({ ...owner.effects }),
          engine: { setProject: () => {} },
        },
        L("Vocal treatment", "Tratamiento vocal"),
      );
    }, [open, es]);
    const captureTarget = (): Target => ({
      project: ctx.project.id,
      lane,
      step: Math.max(
        0,
        ctx.engine.playing ? ctx.transportPosition : ctx.globalStartStep,
      ),
      clip: engine === "diffsinger" ? sourceClip.current : "",
    });
    const refresh = async () => {
      const next = await client.current.status();
      setStatus(next);
      if (!voice && next.voices[0]) setVoice(next.voices[0].id);
      const runtime =
        next.runtimes.find(
          (item) =>
            item.engine === engine &&
            item.profile === next.hardware.recommended,
        ) ?? next.runtimes.find((item) => item.engine === engine);
      if (runtime) setProfile(runtime.profile);
      return next;
    };
    const action = async (fn: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      try {
        await fn();
      } catch (error) {
        setMessage(String(error));
      } finally {
        setBusy(false);
      }
    };
    const stop = async () => {
      epoch.current++;
      controller.current?.abort();
      controller.current = null;
      const id = pending.current;
      pending.current = "";
      let cancelled = true;
      if (id) {
        try {
          await client.current.cancel(id);
        } catch (error) {
          cancelled = false;
          setMessage(
            L(
              "Cancellation could not reach the companion. Check its Jobs panel. ",
              "No se pudo enviar la cancelación. Comprueba los trabajos del asistente. ",
            ) + String(error),
          );
        }
      }
      setBusy(false);
      if (cancelled)
        setMessage(
          L(
            "Cancelled. Previous audio is retained.",
            "Cancelado. Se conserva el audio anterior.",
          ),
        );
    };
    const close = () => {
      if (busy) void stop();
      audio.current?.pause();
      setOpen(false);
    };
    const capture = () => {
      try {
        if (ctx.selectedTrack === "drums")
          throw new Error(
            L("Choose a melodic track", "Elige una pista melódica"),
          );
        const clip = activeClip(ctx.project, ctx.selectedTrack);
        const next = capturedSingingNotes(
          ctx.project,
          clip,
          Math.max(0, ctx.globalStartStep),
        );
        setNotes(next);
        setClipName(clip.name);
        sourceClip.current = clip.id;
        sourceProject.current = ctx.project.id;
        setMessage(
          L(
            "Notes captured. Assign a syllable/word to each note.",
            "Notas capturadas. Asigna una sílaba o palabra a cada nota.",
          ),
        );
      } catch (error) {
        setMessage(String(error));
      }
    };
    const generate = async () => {
      const current = ++epoch.current,
        destination = captureTarget(),
        abort = new AbortController();
      controller.current = abort;
      audio.current?.pause();
      setBusy(true);
      setJob(null);
      try {
        if (!installed)
          throw new Error(
            L(
              "Install and select an engine runtime/model first",
              "Instala y selecciona primero el runtime y modelo",
            ),
          );
        if (engine === "diffsinger" && !notes.length)
          throw new Error(
            L(
              "Capture a monophonic clip first",
              "Captura primero un clip monofónico",
            ),
          );
        if (engine === "diffsinger" && sourceProject.current !== ctx.project.id)
          throw new Error(
            L(
              "Project changed. Capture its notes again.",
              "El proyecto ha cambiado. Captura sus notas de nuevo.",
            ),
          );
        const settings =
          engine === "diffsinger"
            ? {
                language,
                device,
                voice,
                speaker,
                notes: structuredClone(notes),
                vibrato,
                portamentoMs,
                expression,
              }
            : {
                language,
                device,
                lyrics,
                style,
                duration,
                seed,
                bpm: ctx.project.tempo,
              };
        const created = await client.current.submit("generate", {
          engine,
          profile,
          settings,
        });
        if (current !== epoch.current) {
          await client.current.cancel(created.id);
          return;
        }
        pending.current = created.id;
        setJob(created);
        const completed = await client.current.wait(
          created.id,
          setJob,
          abort.signal,
        );
        if (!completed.result) throw new Error("Engine returned no result");
        const blob = await client.current.audio(completed.result.audioId);
        if (current !== epoch.current) return;
        target.current = destination;
        setResult(completed.result);
        setRaw(blob);
        setProcessed(false);
        setMessage(
          L(
            "Ready to audition. Listen before inserting.",
            "Listo para escuchar. Escucha antes de insertar.",
          ),
        );
      } catch (error) {
        if (current === epoch.current) setMessage(String(error));
      } finally {
        if (current === epoch.current) {
          pending.current = "";
          setBusy(false);
        }
      }
    };
    const insert = async () => {
      const destination = target.current;
      if (!raw || !result || !destination) return;
      if (ctx.project.id !== destination.project)
        throw new Error(
          L(
            "Project changed. Generate or recover again.",
            "El proyecto ha cambiado. Genera o recupera de nuevo.",
          ),
        );
      let lane = ctx.project.audioLanes.find(
        (item) => item.id === destination.lane,
      );
      if (destination.lane && !lane)
        throw new Error(
          L(
            "The captured lane was removed",
            "La pista capturada se ha eliminado",
          ),
        );
      const id = "singing-" + cryptoId();
      await ctx.putAsset(id, raw);
      if (ctx.project.id !== destination.project)
        throw new Error(L("Project changed", "El proyecto ha cambiado"));
      ctx.snapshot();
      if (!lane) {
        lane = createAudioLane(L("Generated vocals", "Voz cantada"));
        ctx.project.audioLanes.push(lane);
      }
      const origin = projectSeconds(ctx.project, destination.step);
      let low = destination.step,
        high = low + (result.seconds * 220) / 15 + 16;
      for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2;
        if (projectSeconds(ctx.project, mid) - origin < result.seconds)
          low = mid;
        else high = mid;
      }
      const region = createAudioRegion(
        id,
        `${result.engine} · ${result.model}`,
        destination.step,
        Math.max(0.25, high - destination.step),
        result.seconds,
      );
      region.effects = { ...effects };
      region.generation = {
        kind: "singing",
        engine: result.engine,
        model: result.model,
        revision: result.revision,
        device: result.device,
        outputKind: result.outputKind,
        settings: structuredClone(result.settings),
        sha256: result.sha256,
        attribution: result.attribution ?? "",
        licenseUrl: result.licenseUrl ?? "",
        sourceClipId: destination.clip,
        createdAt: Date.now(),
      };
      lane.regions.push(region);
      ctx.changed();
      await ctx.loadAudioAssets();
      ctx.renderAudioStudio();
      ctx.toast(L("Vocals inserted", "Voz cantada insertada"), true);
    };
    const recover = async (item: CompanionJob) => {
      if (!item.result) return;
      const blob = await client.current.audio(item.result.audioId);
      target.current = { ...captureTarget(), clip: "" };
      setResult(item.result);
      setRaw(blob);
      setProcessed(false);
      setMessage(
        L(
          "Recovered audio; insertion uses the current lane and cursor.",
          "Audio recuperado; se insertará en la pista y cursor actuales.",
        ),
      );
    };
    if (!open) return null;
    return (
      <dialog
        id="desktopVocalsDialog"
        class="appearance-dialog local-ai-dialog desktop-vocals-dialog"
        ref={dialog}
        aria-labelledby="desktopVocalsTitle"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <header class="appearance-header">
          <h2 id="desktopVocalsTitle">
            {L("Desktop vocals", "Canto de escritorio")}
          </h2>
          <button onClick={close} aria-label={L("Close", "Cerrar")}>
            ×
          </button>
        </header>
        <p>
          {L(
            "Singing is generated by an optional local companion. Your lyrics/audio stay on your computer. Model downloads are separate from the musical project.",
            "El canto se genera con un asistente local opcional. Tus letras y audio permanecen en tu ordenador. Los modelos se descargan por separado del proyecto musical.",
          )}
        </p>
        <>
            <details class="ai-catalog" open={!status}>
              <summary>
                {L("1 · Install and connect", "1 · Instalar y conectar")}
              </summary>
              <p>
                {L(
                  "Install the companion, open it and enter its six-digit code. Allow local-network access if your browser requests it.",
                  "Instala el asistente, ábrelo e introduce su código de seis cifras. Permite el acceso a la red local si tu navegador lo solicita.",
                )}
              </p>
              {downloads?.requiresRepositoryAccess && (
                <p>
                  {L(
                    "These installers are in a private GitHub release. Sign in with an account that has access to the repository.",
                    "Los instaladores están en una release privada de GitHub. Inicia sesión con una cuenta que tenga acceso al repositorio.",
                  )}
                </p>
              )}
              <div class="ai-actions">
                {downloads?.assets.map((asset) =>
                  asset.available ? (
                    <a
                      class="desktop-download"
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {asset.label}
                    </a>
                  ) : (
                    <span class="desktop-download-pending">
                      {asset.label} ·{" "}
                      {L("build pending", "compilación pendiente")}
                    </span>
                  ),
                )}
              </div>
              {downloads && (
                <a
                  href={downloads.releasePage}
                  target="_blank"
                  rel="noreferrer"
                >
                  {L(
                    "Downloads and installation guide",
                    "Descargas y guía de instalación",
                  )}
                </a>
              )}
              <div class="ai-actions">
                <a href="kibervengance://open" class="desktop-download">
                  {L("Open installed companion", "Abrir asistente instalado")}
                </a>
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await refresh();
                      setMessage(L("Connected", "Conectado"));
                    })
                  }
                >
                  {L("Check connection", "Comprobar conexión")}
                </button>
              </div>
              <div class="ai-musical-settings">
                <label>
                  {L("Connection code", "Código de conexión")}
                  <input
                    id="desktopPairCode"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    disabled={busy}
                    onInput={(event) =>
                      setCode(event.currentTarget.value.replace(/\D/g, ""))
                    }
                  />
                </label>
                <button
                  id="desktopPair"
                  disabled={busy || code.length !== 6}
                  onClick={() =>
                    void action(async () => {
                      await client.current.pair(code);
                      setCode("");
                      await refresh();
                      setMessage(L("Studio paired", "Estudio vinculado"));
                    })
                  }
                >
                  {L("Connect studio", "Conectar estudio")}
                </button>
                <button
                  disabled={busy || !client.current.token}
                  onClick={() => {
                    client.current.disconnect();
                    setStatus(null);
                    setMessage(L("Disconnected", "Desconectado"));
                  }}
                >
                  {L("Disconnect", "Desconectar")}
                </button>
              </div>
            </details>
            {status && (
              <section class="ai-model">
                <b>
                  {status.hardware.gpuDetected} · RAM {status.hardware.memoryGB}{" "}
                  GB · {status.hardware.os} {status.hardware.distribution}
                </b>
                <p>
                  {L(
                    "Manage model downloads, voice licenses and runtime installation in the companion window. After installation, refresh this connection.",
                    "Gestiona descargas, licencias de voces e instalación de runtimes en la ventana del asistente. Después de instalar, actualiza esta conexión.",
                  )}
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await refresh();
                      setMessage(
                        L(
                          "Model status updated",
                          "Estado de modelos actualizado",
                        ),
                      );
                    })
                  }
                >
                  {L("Refresh engines", "Actualizar motores")}
                </button>
              </section>
            )}
            <div class="ai-musical-settings">
              <label>
                {L("Engine", "Motor")}
                <select
                  id="desktopVocalEngine"
                  value={engine}
                  disabled={busy}
                  onChange={(event) => {
                    setEngine(event.currentTarget.value as VocalEngine);
                    const runtime = status?.runtimes.find(
                      (item) => item.engine === event.currentTarget.value,
                    );
                    if (runtime) setProfile(runtime.profile);
                  }}
                >
                  <option value="diffsinger">
                    DiffSinger · {L("Sing my notes", "Cantar mis notas")}
                  </option>
                  <option value="acestep">
                    ACE-Step · {L("Musical proposal", "Propuesta musical")}
                  </option>
                </select>
              </label>
              <label>
                {L("Processing", "Procesamiento")}
                <select
                  id="desktopVocalDevice"
                  value={device}
                  disabled={busy}
                  onChange={(event) =>
                    setDevice(event.currentTarget.value as VocalDevice)
                  }
                >
                  <option value="auto">{L("Automatic", "Automático")}</option>
                  <option value="gpu">GPU</option>
                  <option value="cpu">CPU</option>
                </select>
              </label>
              <label>
                {L("Installed runtime", "Runtime instalado")}
                <select
                  id="desktopVocalProfile"
                  value={profile}
                  disabled={busy}
                  onChange={(event) => setProfile(event.currentTarget.value)}
                >
                  {status?.runtimes
                    .filter((item) => item.engine === engine)
                    .map((item) => (
                      <option value={item.profile}>{item.profile}</option>
                    ))}
                  {!status?.runtimes.some((item) => item.engine === engine) && (
                    <option value="cpu">
                      {L("Not installed", "Sin instalar")}
                    </option>
                  )}
                </select>
              </label>
              <label>
                {L("Language", "Idioma")}
                <select
                  id="desktopVocalLanguage"
                  value={language}
                  disabled={busy}
                  onChange={(event) =>
                    setLanguage(event.currentTarget.value as "es" | "en")
                  }
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label>
                {L("Insert in lane", "Insertar en pista")}
                <select
                  id="desktopVocalLane"
                  value={lane}
                  disabled={busy}
                  onChange={(event) => setLane(event.currentTarget.value)}
                >
                  <option value="">
                    {L("New vocal lane", "Nueva pista vocal")}
                  </option>
                  {ctx.project.audioLanes.map((item) => (
                    <option value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
            </div>
            {engine === "diffsinger" ? (
              <section class="desktop-score">
                <div class="ai-musical-settings">
                  <label>
                    {L("Voicebank", "Banco vocal")}
                    <select
                      id="desktopVocalVoice"
                      value={voice}
                      disabled={busy}
                      onChange={(event) => {
                        setVoice(event.currentTarget.value);
                        setSpeaker("");
                        setExpression({});
                        setInventory("");
                      }}
                    >
                      <option value="">
                        {L(
                          "Choose an installed voice",
                          "Elige una voz instalada",
                        )}
                      </option>
                      {status?.voices.map((item) => (
                        <option value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {L("Voice color", "Color de voz")}
                    <select
                      value={speaker}
                      disabled={busy || !selectedVoice?.speakers.length}
                      onChange={(event) =>
                        setSpeaker(event.currentTarget.value)
                      }
                    >
                      <option value="">{L("Default", "Predeterminado")}</option>
                      {selectedVoice?.speakers.map((value) => (
                        <option value={value}>{value.split("/").at(-1)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {L("Vibrato · semitones", "Vibrato · semitonos")}
                    <input
                      id="desktopVocalVibrato"
                      type="number"
                      min="0"
                      max="1"
                      step=".05"
                      value={vibrato}
                      disabled={busy}
                      onInput={(event) =>
                        setVibrato(+event.currentTarget.value)
                      }
                    />
                  </label>
                </div>
                <div class="ai-musical-settings">
                  <label>
                    {L("Pitch transition · ms", "Transición de tono · ms")}
                    <input
                      type="number"
                      min="0"
                      max="120"
                      step="5"
                      value={portamentoMs}
                      disabled={busy}
                      onInput={(event) =>
                        setPortamentoMs(+event.currentTarget.value)
                      }
                    />
                  </label>
                  {selectedVoice?.expression.map((name) => (
                    <label>
                      {name === "breathiness"
                        ? L("Breathiness", "Aire")
                        : name === "tension"
                          ? L("Tension", "Tensión")
                          : name === "energy"
                            ? L("Energy", "Energía")
                            : L("Voicing", "Sonoridad")}
                      <input
                        type="number"
                        min={name === "tension" ? -10 : -96}
                        max={name === "tension" ? 10 : 0}
                        step="1"
                        value={
                          expression[name] ??
                          {
                            tension: 0,
                            energy: -20,
                            breathiness: -35,
                            voicing: -15,
                          }[name as "tension"] ??
                          0
                        }
                        disabled={busy}
                        onInput={(event) =>
                          setExpression({
                            ...expression,
                            [name]: +event.currentTarget.value,
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                {selectedVoice && (
                  <p role="note">
                    {selectedVoice.license}{" "}
                    {selectedVoice.licenseUrl && (
                      <a
                        href={selectedVoice.licenseUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {L("Creator terms", "Condiciones del autor")}
                      </a>
                    )}
                  </p>
                )}
                {selectedVoice && (
                  <details>
                    <summary>
                      {L(
                        "Voice phoneme inventory",
                        "Inventario de fonemas de la voz",
                      )}
                    </summary>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          const next = await client.current.request<{
                            phonemes: string[];
                          }>(`voices/${voice}`);
                          setInventory(next.phonemes.join(" · "));
                        })
                      }
                    >
                      {L(
                        "Show supported phonemes",
                        "Mostrar fonemas disponibles",
                      )}
                    </button>
                    <p>{inventory}</p>
                  </details>
                )}
                <button
                  id="captureVocalNotes"
                  disabled={busy}
                  onClick={capture}
                >
                  {L(
                    "Capture active clip notes",
                    "Capturar notas del clip activo",
                  )}
                </button>
                <p>
                  {clipName} · {notes.length} {L("notes", "notas")}.{" "}
                  {L(
                    "One syllable or word per note. Use + to sustain the previous vowel; _ for silence. Overlapping notes must be edited before capture.",
                    "Una sílaba o palabra por nota. Usa + para prolongar la vocal anterior; _ para silencio. Edita las notas solapadas antes de capturar.",
                  )}
                </p>
                <label class="ai-prompt">
                  {L(
                    "Distribute lyrics across notes",
                    "Repartir letra entre las notas",
                  )}
                  <textarea
                    id="desktopScoreLyrics"
                    value={lyrics}
                    maxLength={4096}
                    disabled={busy}
                    onInput={(event) => setLyrics(event.currentTarget.value)}
                  />
                </label>
                <button
                  disabled={busy || !notes.length}
                  onClick={() => {
                    const words = lyrics.trim().split(/\s+/).filter(Boolean);
                    if (words.length !== notes.length) {
                      setMessage(
                        L(
                          "The number of lyric tokens must match the number of notes.",
                          "La cantidad de sílabas/palabras debe coincidir con las notas.",
                        ),
                      );
                      return;
                    }
                    setNotes(
                      notes.map((note, index) => ({
                        ...note,
                        lyric: words[index]!,
                        phonemes: "",
                      })),
                    );
                  }}
                >
                  {L("Apply lyrics", "Aplicar letra")}
                </button>
                {!!notes.length && (
                  <div class="desktop-note-list">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{L("Pitch", "Nota")}</th>
                          <th>{L("Seconds", "Segundos")}</th>
                          <th>{L("Lyric", "Letra")}</th>
                          <th>
                            {L("Phonemes · optional", "Fonemas · opcionales")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {notes.map((note, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{note.pitch}</td>
                            <td>
                              {note.start.toFixed(2)} ·{" "}
                              {note.duration.toFixed(2)}
                            </td>
                            <td>
                              <input
                                aria-label={`${L("Lyric for note", "Letra de la nota")} ${index + 1}`}
                                value={note.lyric}
                                maxLength={80}
                                disabled={busy}
                                onInput={(event) =>
                                  setNotes(
                                    notes.map((n, i) =>
                                      i === index
                                        ? {
                                            ...n,
                                            lyric: event.currentTarget.value,
                                          }
                                        : n,
                                    ),
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                aria-label={`${L("Phonemes for note", "Fonemas de la nota")} ${index + 1}`}
                                value={note.phonemes}
                                maxLength={200}
                                disabled={busy}
                                onInput={(event) =>
                                  setNotes(
                                    notes.map((n, i) =>
                                      i === index
                                        ? {
                                            ...n,
                                            phonemes: event.currentTarget.value,
                                          }
                                        : n,
                                    ),
                                  )
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : (
              <section>
                <p>
                  {L(
                    "ACE-Step proposes an interpretation from lyrics and style. It can include accompaniment; exact note alignment and isolated vocals are not guaranteed.",
                    "ACE-Step propone una interpretación a partir de letra y estilo. Puede incluir acompañamiento; no garantiza notas exactas ni voz aislada.",
                  )}
                </p>
                <label class="ai-prompt">
                  {L("Lyrics", "Letra")}
                  <textarea
                    id="desktopAceLyrics"
                    value={lyrics}
                    maxLength={4096}
                    rows={5}
                    disabled={busy}
                    onInput={(event) => setLyrics(event.currentTarget.value)}
                  />
                </label>
                <label class="ai-prompt">
                  {L("Music and vocal style", "Estilo musical y vocal")}
                  <textarea
                    id="desktopAceStyle"
                    value={style}
                    maxLength={512}
                    rows={3}
                    disabled={busy}
                    onInput={(event) => setStyle(event.currentTarget.value)}
                  />
                </label>
                <div class="ai-musical-settings">
                  <label>
                    {L("Duration · seconds", "Duración · segundos")}
                    <input
                      id="desktopAceDuration"
                      type="number"
                      min="10"
                      max="120"
                      value={duration}
                      disabled={busy}
                      onInput={(event) =>
                        setDuration(+event.currentTarget.value)
                      }
                    />
                  </label>
                  <label>
                    {L("Seed · −1 random", "Semilla · −1 aleatoria")}
                    <input
                      type="number"
                      min="-1"
                      max="2147483647"
                      value={seed}
                      disabled={busy}
                      onInput={(event) => setSeed(+event.currentTarget.value)}
                    />
                  </label>
                  <p>BPM · {ctx.project.tempo}</p>
                </div>
              </section>
            )}
            <div ref={effectHost} />
            <div class="ai-actions">
              <button
                id="generateDesktopVocals"
                disabled={busy || !installed}
                onClick={() => void generate()}
              >
                {L("Generate singing", "Generar canto")}
              </button>
              <button disabled={!busy} onClick={() => void stop()}>
                {L("Cancel", "Cancelar")}
              </button>
            </div>
            {job && (
              <div role="status">
                <p>
                  {job.status} · {job.message}
                </p>
                {["queued", "running"].includes(job.status) && (
                  <progress
                    max={1}
                    {...(job.progress > 0 ? { value: job.progress } : {})}
                    aria-label={L(
                      "Generation progress",
                      "Progreso de generación",
                    )}
                  />
                )}
              </div>
            )}
            <p id="desktopVocalsStatus" role="status">
              {message}
            </p>
            {!!status?.jobs.some(
              (item) => item.kind === "generate" && item.result,
            ) && (
              <details>
                <summary>
                  {L("Recover generated audio", "Recuperar audio generado")}
                </summary>
                {status.jobs
                  .filter((item) => item.kind === "generate" && item.result)
                  .reverse()
                  .map((item) => (
                    <button
                      disabled={busy}
                      onClick={() => void action(() => recover(item))}
                    >
                      {item.result!.engine} · {item.result!.seconds.toFixed(1)}{" "}
                      s · {L("Recover", "Recuperar")}
                    </button>
                  ))}
              </details>
            )}
        </>
        {raw && result && (
          <section class="ai-result">
            <h3>
              {result.outputKind === "score-vocal"
                ? L("Sung score", "Partitura cantada")
                : L("Musical proposal", "Propuesta musical")}
            </h3>
            <p>
              {result.model} · {result.device} · {result.seconds.toFixed(1)} s
            </p>
            <p>{result.attribution}</p>
            <button
              aria-pressed={processed}
              disabled={!processedUrl}
              onClick={() => {
                audio.current?.pause();
                setProcessed(!processed);
              }}
            >
              {processed
                ? L("Processed", "Procesado")
                : L("Original", "Original")}
            </button>
            <audio
              id="desktopVocalPreview"
              controls
              src={processed ? processedUrl : url}
              ref={audio}
              onLoadedMetadata={() => {
                if (audio.current)
                  void ctx.engine
                    .routePreview(audio.current)
                    .catch((error) => setMessage(String(error)));
              }}
            />
            <div class="ai-actions">
              <button
                id="insertDesktopVocals"
                disabled={busy}
                onClick={() => void action(insert)}
              >
                {L("Insert as audio region", "Insertar como región de audio")}
              </button>
              <a href={url} download="vocals-original.wav">
                WAV · Original
              </a>
              {processedUrl && (
                <a href={processedUrl} download="vocals-processed.wav">
                  WAV · {L("Processed", "Procesado")}
                </a>
              )}
            </div>
          </section>
        )}
      </dialog>
    );
  }
  render(<DesktopVocals />, host);
}
