import { AudioEngine } from "../audio";
import { processAudio } from "../audio/effects";
import { normalizeEffects } from "../audio/effects-model";
import { mountAudioEffects } from "./audio-effects";
import type { AudioEffects } from "../model";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  createAudioLane,
  createAudioRegion,
  projectSeconds,
  cryptoId,
} from "../core";
import {
  loadVoice,
  generateSpeech,
  freeVoice,
  deleteVoiceCache,
  speechWav,
  type SpeechResult,
  type SpeechSettings,
} from "../ai/voice";
import { getLanguage } from "./i18n";
import type { Project } from "../model";
interface Context {
  project: Project;
  transportPosition: number;
  globalStartStep: number;
  engine: AudioEngine;
  putAsset(id: string, blob: Blob): Promise<void>;
  snapshot(): void;
  changed(render?: boolean): void;
  loadAudioAssets(): Promise<void>;
  renderAudioStudio(): void;
  toast(text: string, undo?: boolean): void;
}
export function setupLocalVoice(ctx: Context) {
  const host = document.createElement("div");
  document.body.append(host);
  const launcher = document.createElement("button");
  launcher.id = "localVoiceBtn";
  launcher.textContent = "VOICE · ES/EN";
  document.querySelector(".audio-actions")?.append(launcher);
  function Voice() {
    const [open, setOpen] = useState(false),
      [es, setEs] = useState(false),
      [busy, setBusy] = useState(false),
      [ready, setReady] = useState(false);
    const [text, setText] = useState(""),
      [language, setLanguage] = useState<"es" | "en">("en"),
      [voice, setVoice] = useState("af_heart"),
      [speed, setSpeed] = useState(1),
      [dtype, setDtype] = useState<"fp32" | "q8">("q8");
    const [engine, setEngine] = useState<"kokoro" | "chatterbox">("kokoro"),
      [intensity, setIntensity] = useState(0.5),
      [pauseMs] = useState(250),
      [fragments, setFragments] = useState<
        Record<number, { speed: number; pauseMs: number }>
      >({}),
      [effects, setEffects] = useState<AudioEffects>(normalizeEffects()),
      [processed, setProcessed] = useState(false),
      [processedUrl, setProcessedUrl] = useState("");
    const effectsHost = useRef<HTMLDivElement>(null);
    const [lane, setLane] = useState(""),
      [status, setStatus] = useState(""),
      [result, setResult] = useState<SpeechResult | null>(null),
      [url, setUrl] = useState("");
    const dialog = useRef<HTMLDialogElement>(null),
      audio = useRef<HTMLAudioElement>(null),
      epoch = useRef(0);
    const captured = useRef<{
      project: string;
      lane: string;
      step: number;
    } | null>(null);
    const L = (en: string, spanish: string) => (es ? spanish : en);
    const settings = (): SpeechSettings => ({
      engine,
      device: "wasm",
      intensity,
      pauseMs,
      segments: text
        .split(/\n+/)
        .filter((line) => line.trim())
        .map((line, i) => ({
          text: line,
          speed: fragments[i]?.speed ?? speed,
          pauseMs: fragments[i]?.pauseMs ?? pauseMs,
        })),
      text,
      language,
      voice,
      speed,
      dtype,
    });
    launcher.onclick = () => {
      setEs(getLanguage() === "es");
      setLane(ctx.project.audioLanes[0]?.id || "");
      setOpen(true);
    };
    useEffect(() => {
      if (open) dialog.current?.showModal();
      else dialog.current?.close();
    }, [open]);
    useEffect(() => {
      if (!result) return;
      const next = URL.createObjectURL(speechWav(result));
      setUrl(next);
      return () => URL.revokeObjectURL(next);
    }, [result]);
    useEffect(() => {
      if (!open || !effectsHost.current) return;
      effectsHost.current.replaceChildren();
      const owner = { effects };
      mountAudioEffects(
        effectsHost.current,
        owner,
        {
          project: ctx.project,
          snapshot: () => {},
          changed: () => setEffects({ ...owner.effects }),
          engine: { setProject: () => {} },
        },
        L("Voice treatment", "Tratamiento de voz"),
      );
    }, [open, es]);
    useEffect(() => {
      if (!result) return;
      let cancelled = false,
        next = "";
      void (async () => {
        const audioContext = new AudioContext();
        try {
          const buffer = audioContext.createBuffer(
            1,
            result.pcm.length,
            result.sampleRate,
          );
          buffer.copyToChannel(new Float32Array(result.pcm), 0);
          const output = await processAudio(
            buffer,
            effects,
            effects.delay || effects.reverb ? 2.5 : 0,
          );
          if (cancelled) return;
          next = URL.createObjectURL(
            speechWav({
              ...result,
              pcm: output.getChannelData(0),
              sampleRate: output.sampleRate,
            }),
          );
          setProcessedUrl(next);
        } catch (error) {
          if (!cancelled) setStatus(String(error));
        } finally {
          await audioContext.close();
        }
      })();
      return () => {
        cancelled = true;
        if (next) URL.revokeObjectURL(next);
        setProcessedUrl("");
      };
    }, [result, effects]);
    const stop = () => {
      epoch.current++;
      freeVoice();
      setBusy(false);
      setReady(false);
      setStatus(L("Cancelled", "Cancelado"));
      audio.current?.pause();
    };
    const close = () => {
      if (busy) stop();
      audio.current?.pause();
      setOpen(false);
    };
    const load = async () => {
      const token = ++epoch.current;
      setBusy(true);
      setReady(false);
      setStatus(
        L("Loading voice on this device…", "Cargando voz en este equipo…"),
      );
      try {
        await loadVoice(settings(), setStatus);
        if (token === epoch.current) {
          setReady(true);
          setStatus(L("Model ready", "Modelo listo"));
        }
      } catch (error) {
        if (token === epoch.current) setStatus(String(error));
      } finally {
        if (token === epoch.current) setBusy(false);
      }
    };
    const generate = async () => {
      const token = ++epoch.current;
      const target = {
        project: ctx.project.id,
        lane,
        step: Math.max(
          0,
          ctx.engine.playing ? ctx.transportPosition : ctx.globalStartStep,
        ),
      };
      audio.current?.pause();
      setBusy(true);
      setStatus(L("Generating locally…", "Generando localmente…"));
      try {
        const next = await generateSpeech(settings(), setStatus);
        if (token === epoch.current) {
          captured.current = target;
          setProcessed(false);
          setResult(next);
          setStatus(
            L("Ready to listen and insert", "Listo para escuchar e insertar"),
          );
        }
      } catch (error) {
        if (token === epoch.current) setStatus(String(error));
      } finally {
        if (token === epoch.current) setBusy(false);
      }
    };
    const insert = async () => {
      const target = captured.current;
      if (!result || !target) return;
      if (ctx.project.id !== target.project) {
        setStatus(
          L(
            "Project changed. Generate again.",
            "El proyecto ha cambiado. Genera de nuevo.",
          ),
        );
        return;
      }
      let destination = ctx.project.audioLanes.find(
        (item) => item.id === target.lane,
      );
      if (target.lane && !destination) {
        setStatus(
          L(
            "The captured lane was removed. Generate again.",
            "La pista capturada fue eliminada. Genera de nuevo.",
          ),
        );
        return;
      }
      const operation = ++epoch.current;
      setBusy(true);
      try {
        const id = `voice-${cryptoId()}`,
          blob = speechWav(result);
        await ctx.putAsset(id, blob);
        if (operation !== epoch.current) return;
        if (ctx.project.id !== target.project)
          throw new Error(L("Project changed", "El proyecto ha cambiado"));
        ctx.snapshot();
        if (!destination) {
          destination = createAudioLane(L("Generated voice", "Voz generada"));
          ctx.project.audioLanes.push(destination);
        }
        const duration = result.pcm.length / result.sampleRate,
          origin = projectSeconds(ctx.project, target.step);
        let low = target.step,
          high = target.step + (duration * 220) / 15 + 16;
        for (let i = 0; i < 40; i++) {
          const mid = (low + high) / 2;
          if (projectSeconds(ctx.project, mid) - origin < duration) low = mid;
          else high = mid;
        }
        const region = createAudioRegion(
          id,
          `${result.settings.voice} · ${result.settings.text.slice(0, 32)}`,
          target.step,
          Math.max(0.25, high - target.step),
          duration,
        );
        region.effects = { ...effects };
        region.generation = {
          kind: "speech",
          model: result.model,
          ...result.settings,
          revision: result.revision ?? "",
          precision:
            result.settings.engine === "chatterbox"
              ? "q4-lm/q4-decoder/fp32-embeddings"
              : result.settings.dtype,
          phonemes: result.phonemes,
          createdAt: Date.now(),
        };
        destination.regions.push(region);
        ctx.changed();
        await ctx.loadAudioAssets();
        ctx.renderAudioStudio();
        ctx.toast(L("Voice inserted", "Voz insertada"), true);
      } catch (error) {
        setStatus(String(error));
      } finally {
        setBusy(false);
      }
    };
    return (
      <dialog
        id="localVoiceDialog"
        class="appearance-dialog local-ai-dialog"
        aria-labelledby="localVoiceTitle"
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <header class="appearance-header">
          <h2 id="localVoiceTitle">{L("Local voice", "Voz local")}</h2>
          <button onClick={close} aria-label={L("Close", "Cerrar")}>
            ×
          </button>
        </header>
        <p>
          {L(
            "Speech is generated in your browser. Kokoro: q8 ≈90 MB or FP32 ≈330 MB; Chatterbox ≈570 MB, plus runtime and voices. Downloads are explicit. Audition Spanish pronunciation before inserting.",
            "Voz generada en tu navegador. Kokoro: q8 ≈90 MB o FP32 ≈330 MB; Chatterbox ≈570 MB, más runtime y voces. Las descargas son voluntarias. Escucha la pronunciación en español antes de insertar.",
          )}
        </p>
        <label>
          {L("Text", "Texto")}
          <textarea
            rows={4}
            id="voiceText"
            value={text}
            maxLength={500}
            disabled={busy}
            onInput={(e) => setText(e.currentTarget.value)}
          />
        </label>
        <div class="ai-musical-settings">
          <label>
            {L("Voice engine", "Motor de voz")}
            <select
              id="voiceEngine"
              value={engine}
              disabled={busy}
              onChange={(e) => {
                setEngine(e.currentTarget.value as "kokoro" | "chatterbox");
                setVoice(
                  e.currentTarget.value === "chatterbox"
                    ? "default"
                    : language === "es"
                      ? "ef_dora"
                      : "af_heart",
                );
                setReady(false);
              }}
            >
              <option value="kokoro">Kokoro · CPU</option>
              <option value="chatterbox">
                Chatterbox · CPU ·{" "}
                {L("Expressive · experimental", "Expresivo · experimental")}
              </option>
            </select>
          </label>
          {engine === "chatterbox" && (
            <>
              <label>
                {L("Expression intensity", "Intensidad expresiva")}
                <input
                  id="voiceIntensity"
                  type="range"
                  min=".1"
                  max="1"
                  step=".05"
                  value={intensity}
                  disabled={busy}
                  onInput={(e) => setIntensity(+e.currentTarget.value)}
                />
                <output>{intensity.toFixed(2)}</output>
              </label>
              <label>
                {L("Interpretation", "Interpretación")}
                <select
                  disabled={busy}
                  onChange={(e) => setIntensity(+e.currentTarget.value)}
                  value={intensity}
                >
                  <option value="0.3">{L("Restrained", "Contenida")}</option>
                  <option value="0.5">{L("Natural", "Natural")}</option>
                  <option value="0.8">{L("Emphatic", "Enfática")}</option>
                </select>
              </label>
              <p>
                {L(
                  "Optional download ≈570 MB plus runtime. No free-form style instructions. CPU can take several minutes.",
                  "Descarga opcional ≈570 MB más runtime. Sin instrucciones libres de estilo. CPU puede tardar varios minutos.",
                )}
              </p>
            </>
          )}

          <label>
            {L("Language", "Idioma")}
            <select
              id="voiceLanguage"
              value={language}
              disabled={busy}
              onChange={(e) => {
                const next = e.currentTarget.value as "es" | "en";
                setLanguage(next);
                setVoice(
                  engine === "chatterbox"
                    ? "default"
                    : next === "es"
                      ? "ef_dora"
                      : "af_heart",
                );
                setReady(false);
              }}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </label>
          <label>
            {L("Voice", "Voz")}
            <select
              id="voiceName"
              value={voice}
              disabled={busy}
              onChange={(e) => {
                setVoice(e.currentTarget.value);
                setReady(false);
              }}
            >
              {(engine === "chatterbox"
                ? ["default"]
                : language === "es"
                  ? ["ef_dora", "em_alex"]
                  : ["af_heart", "am_michael"]
              ).map((name) => (
                <option value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label hidden={engine !== "kokoro"}>
            {L("Speed · Kokoro", "Velocidad · Kokoro")}
            <input
              id="voiceSpeed"
              hidden={engine !== "kokoro"}
              type="number"
              min=".6"
              max="1.5"
              step=".05"
              value={speed}
              disabled={busy}
              onInput={(e) => setSpeed(+e.currentTarget.value)}
            />
          </label>
          <label hidden={engine !== "kokoro"}>
            {L("Precision", "Precisión")}
            <select
              id="voicePrecision"
              value={dtype}
              disabled={busy}
              onChange={(e) => {
                setDtype(e.currentTarget.value as "q8" | "fp32");
                setReady(false);
              }}
            >
              <option value="q8">q8</option>
              <option value="fp32">FP32</option>
            </select>
          </label>
          <label>
            {L("Insert in lane", "Insertar en pista")}
            <select
              id="voiceLane"
              value={lane}
              disabled={busy}
              onChange={(e) => setLane(e.currentTarget.value)}
            >
              <option value="">
                {L("New voice lane", "Nueva pista de voz")}
              </option>
              {ctx.project.audioLanes.map((item) => (
                <option value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        </div>
        <p>
          {L(
            "Insertion captures the selected lane and song cursor when generation starts. Each insertion creates a new audio region.",
            "La inserción captura la pista elegida y el cursor de canción al iniciar la generación. Cada inserción crea una región de audio nueva.",
          )}
        </p>
        {engine === "kokoro" && (
          <details>
            <summary>
              {L(
                "Phrasing · one fragment per line",
                "Fraseo · un fragmento por línea",
              )}
            </summary>
            {text
              .split(/\n+/)
              .filter((line) => line.trim())
              .map((line, i) => (
                <div class="ai-musical-settings">
                  <span>{line}</span>
                  <label>
                    {L("Speed", "Velocidad")}
                    <input
                      aria-label={`${L("Fragment speed", "Velocidad del fragmento")} ${i + 1}`}
                      type="number"
                      min=".6"
                      max="1.5"
                      step=".05"
                      value={fragments[i]?.speed ?? speed}
                      disabled={busy}
                      onChange={(e) =>
                        setFragments({
                          ...fragments,
                          [i]: {
                            speed: +e.currentTarget.value,
                            pauseMs: fragments[i]?.pauseMs ?? pauseMs,
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    {L("Pause after · ms", "Pausa al final · ms")}
                    <input
                      type="number"
                      min="0"
                      max="2000"
                      step="50"
                      value={fragments[i]?.pauseMs ?? pauseMs}
                      disabled={busy}
                      onChange={(e) =>
                        setFragments({
                          ...fragments,
                          [i]: {
                            speed: fragments[i]?.speed ?? speed,
                            pauseMs: +e.currentTarget.value,
                          },
                        })
                      }
                    />
                  </label>
                </div>
              ))}
          </details>
        )}
        <div ref={effectsHost} />
        <div class="ai-actions">
          <button
            id="loadLocalVoice"
            disabled={busy}
            onClick={() => void load()}
          >
            {L("Download / load model", "Descargar / cargar modelo")}
          </button>
          <button
            id="generateLocalVoice"
            disabled={
              busy ||
              !ready ||
              !text.trim() ||
              !Number.isFinite(speed) ||
              speed < 0.6 ||
              speed > 1.5
            }
            onClick={() => void generate()}
          >
            {L("Generate speech", "Generar voz hablada")}
          </button>
          <button disabled={!busy} onClick={stop}>
            {L("Cancel", "Cancelar")}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              stop();
              setStatus(L("Memory released", "Memoria liberada"));
            }}
          >
            {L("Free memory", "Liberar memoria")}
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void deleteVoiceCache()
                .then(() => {
                  setReady(false);
                  setStatus(
                    L("Voice downloads deleted", "Descargas de voz borradas"),
                  );
                })
                .catch((error) => setStatus(String(error)))
            }
          >
            {L("Delete downloads", "Borrar descargas")}
          </button>
        </div>
        <p role="status">{status}</p>
        {result && (
          <section>
            <button
              disabled={!processedUrl}
              aria-pressed={processed}
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
              id="voicePreview"
              controls
              src={processed ? processedUrl : url}
              ref={audio}
              onLoadedMetadata={() => {
                if (audio.current)
                  void ctx.engine
                    .routePreview(audio.current)
                    .catch((error) => setStatus(String(error)));
              }}
            />
            <p>
              {result.settings.language.toUpperCase()} · {result.settings.voice}{" "}
              ·{" "}
              {result.settings.engine === "chatterbox"
                ? "q4"
                : result.settings.dtype}{" "}
              · {(result.pcm.length / result.sampleRate).toFixed(1)} s
            </p>
            <button
              id="insertLocalVoice"
              disabled={busy}
              onClick={() => void insert()}
            >
              {L("Insert as audio region", "Insertar como región de audio")}
            </button>
            <a href={url} download="voice-original.wav">
              WAV · {L("Original", "Original")}
            </a>
            {processedUrl && (
              <a href={processedUrl} download="voice-processed.wav">
                WAV · {L("Processed", "Procesado")}
              </a>
            )}
          </section>
        )}
      </dialog>
    );
  }
  render(<Voice />, host);
}
