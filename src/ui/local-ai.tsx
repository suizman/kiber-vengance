import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { KEYS, SCALES } from "../core";
import {
  parseMelodyPlan,
  type MelodyPlan,
  type MelodyTarget,
} from "../ai/melody";
import {
  loadLocalModel,
  generateLocalPlan,
  stopLocalModel,
  deleteLocalModelCache,
  isLocalModelReady,
  type LocalBackend,
} from "../ai/local-model";
import { getLanguage, subscribeLanguage } from "./i18n";
import { studioBridge, type MelodyAudition } from "./bridge";
import type { NoteEvent } from "../model";
import {
  STYLES,
  enrichMelodyPrompt,
  enforceMelodyChoices,
  type StyleId,
  type RhythmChoice,
  type SoundPreset,
} from "../ai/presets";
import { PresetCatalog } from "./preset-catalog";
import { CompositionControls } from "./ai-composition";
import { RecipeLibrary } from "./ai-recipes";
import {
  DEFAULT_COMPOSITION,
  composeMelody,
  composeAlternatives,
  selectDiverseMelodies,
  compositionPrompt,
  replaceMelodyBars,
  type CompositionOptions,
} from "../ai/composer";
import type { SavedRecipe } from "../ai/recipes";

interface Proposal {
  plan: MelodyPlan;
  notes: NoteEvent[];
  seconds: number;
  seed: number;
}

export let openLocalAI = () => {};
const scaleLabels: Record<string, [string, string]> = {
  minor: ["Minor", "Menor"],
  major: ["Major", "Mayor"],
  dorian: ["Dorian", "Dórica"],
  phrygian: ["Phrygian", "Frigia"],
  harmonicMinor: ["Harmonic minor", "Menor armónica"],
};
function describeFailure(failure: unknown, es: boolean): string {
  const message = String(failure);
  if (!es) return message;
  if (message.includes("WebGPU is unavailable"))
    return "WebGPU no está disponible. Selecciona CPU compatible para generar localmente sin WebGPU.";
  if (message.includes("No compatible WebGPU adapter"))
    return "No se detectó un adaptador WebGPU compatible. Selecciona CPU compatible.";
  if (message.includes("timed out"))
    return "El modelo tardó demasiado. Libera memoria y vuelve a intentarlo.";
  if (
    message.includes("Invalid musical plan") ||
    failure instanceof SyntaxError
  )
    return "El modelo no devolvió un plan musical válido. Prueba con un prompt más sencillo.";
  if (message.includes("did not finish"))
    return "El modelo no terminó el plan. Prueba con un prompt más corto.";
  if (message.includes("Cannot connect these bars"))
    return "Estos compases no se pueden conectar dentro del salto máximo. Selecciona más compases para regenerar.";
  if (message.includes("A protected note crosses"))
    return "Una nota que quieres conservar cruza estos compases. Selecciona también el compás donde empieza.";
  if (message.includes("selected clip has no notes"))
    return "El clip seleccionado no tiene notas. Selecciona otro clip o crea una idea nueva.";
  if (message.includes("project changed"))
    return "El proyecto ha cambiado. Abre de nuevo el generador.";
  return message;
}
export function setupLocalAI() {
  const host = document.createElement("div");
  document.body.append(host);
  let updateLanguage = () => {};
  let stopPreview = () => {};
  function LocalAI() {
    const [es, setEs] = useState(getLanguage() === "es");
    updateLanguage = () => setEs(getLanguage() === "es");
    const [target, setTarget] = useState<MelodyTarget | null>(null);
    const [bars, setBars] = useState(4);
    const [quality, setQuality] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [style, setStyle] = useState<StyleId>("prompt");
    const [rhythm, setRhythm] = useState<RhythmChoice>("auto");
    const [tempo, setTempo] = useState("120");
    const [applyTempo, setApplyTempo] = useState(false);
    const [sound, setSound] = useState<SoundPreset | null>(null);
    const [composition, setComposition] = useState<CompositionOptions>({
      ...DEFAULT_COMPOSITION,
    });
    const sourceRhythm =
      composition.mode === "variation" && composition.density === 0;
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [selected, setSelected] = useState(0);
    const [selectedBars, setSelectedBars] = useState<number[]>([]);
    const [loop, setLoop] = useState(true);
    const [elapsed, setElapsed] = useState(0);
    const runSeed = useRef(1);
    const idea =
      prompt.trim() ||
      (composition.mode !== "new"
        ? "Develop the selected clip into a musical phrase."
        : style !== "prompt"
          ? "Create a melodic motif."
          : "");
    const validTempo =
      tempo.trim() !== "" &&
      Number.isFinite(+tempo) &&
      +tempo >= 50 &&
      +tempo <= 220;
    const [status, setStatus] = useState<
      "idle" | "loading" | "ready" | "generating" | "deleting"
    >("idle");
    const [mode, setMode] = useState<LocalBackend>(() => {
      try {
        const value = localStorage.getItem("kv-local-ai-backend-v1");
        return value === "cpu" || value === "gpu" ? value : "auto";
      } catch {
        return "auto";
      }
    });
    const [loadedBackend, setLoadedBackend] = useState<"gpu" | "cpu" | null>(
      null,
    );
    const [error, setError] = useState("");
    const [detail, setDetail] = useState("");
    const [progress, setProgress] = useState(0);
    const result = proposals[selected] ?? null;
    const clearResults = () => {
      setProposals([]);
      setSelected(0);
      setSelectedBars([]);
    };
    const [listening, setListening] = useState(false);
    const audition = useRef<MelodyAudition | null>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    const attempt = useRef(0);
    const busy =
      status === "loading" || status === "generating" || status === "deleting";
    useEffect(() => {
      if (!busy) return;
      const started = performance.now();
      setElapsed(0);
      const timer = setInterval(
        () => setElapsed(Math.floor((performance.now() - started) / 1000)),
        1000,
      );
      return () => clearInterval(timer);
    }, [status]);
    const lowPitch = result
      ? Math.min(...proposals.flatMap((p) => p.notes.map((note) => note.pitch)))
      : 0;
    const pitchSpan = result
      ? Math.max(
          1,
          Math.max(
            ...proposals.flatMap((p) => p.notes.map((note) => note.pitch)),
          ) - lowPitch,
        )
      : 1;
    const stopAudition = () => {
      audition.current?.stop();
      audition.current = null;
      setListening(false);
    };
    stopPreview = stopAudition;
    const cancel = () => {
      attempt.current++;
      stopLocalModel();
      stopAudition();
      setStatus("idle");
      setLoadedBackend(null);
      setDetail("");
      setProgress(0);
    };
    const close = () => {
      stopAudition();
      if (busy) cancel();
      returnFocus.current?.focus({ preventScroll: true });
    };
    openLocalAI = () => {
      const origin = document.activeElement as HTMLElement | null;
      returnFocus.current = origin?.closest("#projectMenu")
        ? document.querySelector<HTMLElement>("#menuBtn")
        : origin?.closest("#appearanceDialog")
          ? document.querySelector<HTMLElement>("#settingsBtn")
          : origin;
      studioBridge.release();
      document.querySelector<HTMLDialogElement>("#appearanceDialog")?.close();
      document.querySelector<HTMLDialogElement>("#projectMenu")?.close();
      const nextTarget = studioBridge.melodyTarget();
      setTarget(nextTarget);
      if (!nextTarget?.context?.source.notes.length)
        setComposition({ ...composition, mode: "new" });
      setTempo(String(nextTarget?.tempo ?? 120));
      setApplyTempo(false);
      setSound(null);
      clearResults();
      setError("");
      document.querySelector<HTMLDialogElement>("#localAIDialog")?.showModal();
    };
    const load = async () => {
      const token = ++attempt.current;
      setStatus("loading");
      setError("");
      setDetail("");
      setProgress(0);
      try {
        const activeBackend = await loadLocalModel((fraction, text) => {
          if (token === attempt.current) {
            setProgress(Math.max(0, Math.min(1, fraction)));
            setDetail(text);
          }
        }, mode);
        if (token === attempt.current) {
          setStatus("ready");
          setLoadedBackend(activeBackend);
          setDetail("");
        }
      } catch (failure) {
        if (token === attempt.current) {
          stopLocalModel();
          setStatus("idle");
          setError(describeFailure(failure, es));
        }
      }
    };
    const generate = async (partial = false) => {
      if (!target || !idea || !validTempo) return;
      stopAudition();
      setError("");
      setDetail("");
      setStatus("generating");
      const token = ++attempt.current,
        started = performance.now();
      try {
        const candidates: Proposal[] = [];
        const passes = quality ? 3 : 1;
        for (let pass = 0; pass < passes; pass++) {
          if (token !== attempt.current) return;
          const plan = enforceMelodyChoices(
            parseMelodyPlan(
              await generateLocalPlan(
                `${enrichMelodyPrompt(idea, style, rhythm, +tempo)}\n${compositionPrompt(target, composition)}`,
                target.key,
                target.scale,
                bars,
                (_fraction, text) => {
                  if (token === attempt.current) setDetail(text);
                },
              ),
            ),
            rhythm,
          );
          if (token !== attempt.current) return;
          const seed = (runSeed.current += 3);
          candidates.push(
            ...composeAlternatives(plan, target, bars, composition, seed).map(
              (candidate) => ({
                ...candidate,
                plan,
                seconds: (performance.now() - started) / 1000,
              }),
            ),
          );
        }
        const ranked = quality ? selectDiverseMelodies(candidates) : candidates;
        const best = ranked[0]!;
        const plan = best.plan;
        if (token === attempt.current) {
          const seconds = (performance.now() - started) / 1000;
          const seed = best.seed;
          if (partial && result && selectedBars.length) {
            const notes = replaceMelodyBars(
              result.notes,
              composeMelody(plan, target, bars, composition, seed),
              selectedBars,
              target,
              composition,
            );
            setProposals(
              proposals.map((proposal, i) =>
                i === selected ? { ...proposal, notes, seconds } : proposal,
              ),
            );
          } else {
            setProposals(
              ranked.map((candidate) => ({ ...candidate, seconds })),
            );
            setSelected(0);
            setSelectedBars([]);
          }
          setDetail("");
          setStatus("ready");
          requestAnimationFrame(() => {
            if (
              token !== attempt.current ||
              !document.querySelector<HTMLDialogElement>("#localAIDialog")?.open
            )
              return;
            const preview = document.querySelector<HTMLElement>(".ai-result");
            preview?.focus({ preventScroll: true });
            preview?.scrollIntoView({ block: "start" });
          });
        }
      } catch (failure) {
        if (token === attempt.current) {
          setStatus(isLocalModelReady() ? "ready" : "idle");
          setDetail("");
          setError(describeFailure(failure, es));
        }
      }
    };
    const shape = (next: CompositionOptions) => {
      stopAudition();
      setError("");
      try {
        if (target && proposals.length) {
          const first = proposals[0]!;
          const nextProposals = composeAlternatives(
            first.plan,
            target,
            bars,
            next,
            first.seed,
          ).map((candidate) => ({
            ...candidate,
            plan: first.plan,
            seconds: first.seconds,
          }));
          const displayed = quality
            ? selectDiverseMelodies(
                proposals.map((proposal) => ({
                  ...proposal,
                  notes: composeMelody(
                    proposal.plan,
                    target,
                    bars,
                    next,
                    proposal.seed,
                  ),
                })),
              )
            : nextProposals;
          setProposals(displayed);
          setSelected(Math.min(selected, displayed.length - 1));
        }
        setComposition(next);
        setSelectedBars([]);
      } catch (failure) {
        setError(describeFailure(failure, es));
      }
    };
    const useRecipe = (saved: SavedRecipe) => {
      stopAudition();
      clearResults();
      setError("");
      const recipe = saved.recipe;
      setStyle(recipe.style);
      setRhythm(recipe.rhythm);
      setTempo(String(recipe.tempo));
      setBars(recipe.bars);
      setPrompt(recipe.prompt);
      setComposition({
        ...saved.composition,
        mode: target?.context?.source.notes.length
          ? saved.composition.mode
          : "new",
      });
      setSound(
        saved.sound?.track === target?.track ? (saved.sound ?? null) : null,
      );
      if (target)
        setTarget({ ...target, key: recipe.key, scale: recipe.scale });
    };
    const remove = async () => {
      cancel();
      const token = ++attempt.current;
      setStatus("deleting");
      setError("");
      try {
        await deleteLocalModelCache();
        if (token === attempt.current) {
          setStatus("idle");
          setDetail(
            es ? "Modelo descargado eliminado." : "Downloaded model deleted.",
          );
        }
      } catch (failure) {
        if (token === attempt.current) {
          setStatus("idle");
          setError(describeFailure(failure, es));
        }
      }
    };
    return (
      <dialog
        id="localAIDialog"
        class="appearance-dialog local-ai-dialog"
        aria-labelledby="localAITitle"
        data-no-translate
        onClose={close}
      >
        <header class="appearance-header">
          <div>
            <span class="eyebrow">LOCAL SIGNAL // ON-DEVICE AI</span>
            <h2 id="localAITitle">
              {es ? "Melodía por prompt" : "Prompt to melody"}
            </h2>
          </div>
          <button
            type="button"
            class="appearance-close"
            aria-label={es ? "Cerrar generador" : "Close generator"}
            onClick={() =>
              document
                .querySelector<HTMLDialogElement>("#localAIDialog")
                ?.close()
            }
          >
            ×
          </button>
        </header>
        <p class="appearance-intro">
          {es
            ? "Describe una idea y conviértela en notas editables. La IA propone el motivo; el motor musical lo ajusta a tu escala."
            : "Describe an idea and turn it into editable notes. AI proposes the motif; the music engine fits it to your scale."}
        </p>
        <section
          class="ai-model"
          aria-label={es ? "Modelo local" : "Local model"}
        >
          <details class="ai-model-info">
            <summary>
              {es
                ? "Sobre los modelos y la descarga"
                : "About the models and download"}
            </summary>
            <b>GPU · Qwen3 0.6B / CPU · SmolLM2 135M</b>
            <p>
              {es
                ? "GPU usa Qwen3 0.6B y WebGPU (~1,4–2 GB de memoria GPU). CPU usa SmolLM2 135M (~136 MB de pesos), funciona sin WebGPU y puede tardar minutos. CPU interpreta mejor prompts sencillos en inglés. Cada modo necesita su propia descarga. Los prompts se procesan en tu equipo."
                : "GPU uses Qwen3 0.6B and WebGPU (~1.4–2 GB GPU memory). CPU uses SmolLM2 135M (~136 MB of weights), works without WebGPU and may take minutes. CPU works best with simple English prompts. Each mode needs its own download. Prompts are processed on your device."}
            </p>
          </details>
          <label class="ai-backend">
            {es ? "Motor local" : "Local engine"}
            <select
              id="localAIBackend"
              value={mode}
              disabled={busy}
              onChange={(event) => {
                cancel();
                const next = event.currentTarget.value as LocalBackend;
                setMode(next);
                try {
                  localStorage.setItem("kv-local-ai-backend-v1", next);
                } catch {
                  /* Session choice remains usable. */
                }
              }}
            >
              <option value="auto">
                {es
                  ? "Automático: GPU o CPU compatible"
                  : "Automatic: GPU or compatible CPU"}
              </option>
              <option value="gpu">
                {es
                  ? "GPU · rápido · requiere WebGPU"
                  : "GPU · fast · requires WebGPU"}
              </option>
              <option value="cpu">
                {es
                  ? "CPU · compatible · más lento"
                  : "CPU · compatible · slower"}
              </option>
            </select>
          </label>
          <div class="ai-actions">
            <button
              type="button"
              id="loadLocalAI"
              disabled={busy || status === "ready"}
              onClick={() => void load()}
            >
              {status === "ready"
                ? es
                  ? "Modelo listo"
                  : "Model ready"
                : es
                  ? "Descargar y cargar modelo"
                  : "Download & load model"}
            </button>
            <button
              type="button"
              id="unloadLocalAI"
              disabled={status === "idle" || status === "deleting"}
              onClick={cancel}
            >
              {busy
                ? es
                  ? "Cancelar"
                  : "Cancel"
                : es
                  ? "Liberar memoria"
                  : "Free memory"}
            </button>
            <button
              type="button"
              id="deleteLocalAI"
              disabled={busy}
              onClick={() => void remove()}
            >
              {es ? "Eliminar descarga" : "Delete download"}
            </button>
          </div>
          <p
            id="localAIStatus"
            role="status"
            aria-live={status === "generating" ? "off" : "polite"}
          >
            {status === "loading"
              ? `${es ? "Cargando" : "Loading"} ${Math.round(progress * 100)}% · ${elapsed} s`
              : status === "generating"
                ? es
                  ? `Interpretando el prompt en tu equipo… ${elapsed} s`
                  : `Interpreting the prompt on your device… ${elapsed} s`
                : status === "ready"
                  ? es
                    ? `Listo · ${loadedBackend === "cpu" ? "CPU / WASM" : "GPU / WebGPU"} · inferencia local`
                    : `Ready · ${loadedBackend === "cpu" ? "CPU / WASM" : "GPU / WebGPU"} · local inference`
                  : status === "deleting"
                    ? es
                      ? "Eliminando descarga…"
                      : "Deleting download…"
                    : es
                      ? "Modelo sin cargar"
                      : "Model not loaded"}
          </p>
          {status === "loading" && (
            <progress
              max={1}
              value={progress}
              aria-label={es ? "Carga del modelo" : "Model loading"}
            />
          )}
          {detail && <p class="ai-detail">{detail}</p>}
        </section>
        <PresetCatalog
          es={es}
          busy={busy}
          track={target?.track}
          onRecipe={(recipe) => {
            stopAudition();
            clearResults();
            setComposition({ ...DEFAULT_COMPOSITION });
            setError("");
            setStyle(recipe.style);
            setRhythm(recipe.rhythm);
            setTempo(String(recipe.tempo));
            setBars(recipe.bars);
            setPrompt(recipe.prompt);
            if (target)
              setTarget({ ...target, key: recipe.key, scale: recipe.scale });
          }}
          onSound={(preset) => {
            stopAudition();
            setSound(preset);
            setError("");
          }}
        />
        {!target ? (
          <p role="status">
            {es
              ? "Selecciona una pista melódica (lead, guitarra, bajo o pad) y abre de nuevo el generador."
              : "Select a melodic track (lead, guitar, bass or pad) and reopen the generator."}
          </p>
        ) : (
          <>
            <p class="ai-target">
              {es ? "Destino" : "Target"}: <b>{target.track.toUpperCase()}</b> ·{" "}
              {es ? "clip nuevo" : "new clip"} ·{" "}
              {sound?.name ?? (es ? "sonido actual" : "current sound")}
              {sound && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    stopAudition();
                    setSound(null);
                  }}
                >
                  {es ? "Restaurar sonido actual" : "Restore current sound"}
                </button>
              )}
            </p>
            <CompositionControls
              es={es}
              options={composition}
              context={target.context}
              busy={busy}
              onChange={shape}
            />
            <div class="ai-musical-settings">
              <label>
                {es ? "Estilo musical" : "Musical style"}
                <select
                  id="aiStyle"
                  value={style}
                  disabled={busy}
                  onChange={(e) => {
                    stopAudition();
                    clearResults();
                    setStyle(e.currentTarget.value as StyleId);
                  }}
                >
                  {STYLES.map((s) => (
                    <option value={s[0]}>{s[es ? 2 : 1]}</option>
                  ))}
                </select>
              </label>
              <label>
                {es ? "Ritmo" : "Rhythm"}
                <select
                  id="aiRhythm"
                  value={sourceRhythm ? "source" : rhythm}
                  disabled={busy || sourceRhythm}
                  onChange={(e) => {
                    stopAudition();
                    clearResults();
                    setRhythm(e.currentTarget.value as RhythmChoice);
                  }}
                >
                  {sourceRhythm && (
                    <option value="source">
                      {es ? "Del clip original" : "From source clip"}
                    </option>
                  )}
                  {[
                    ["auto", "From prompt", "Del prompt"],
                    ["sparse", "Sparse", "Espaciado"],
                    ["steady", "Steady", "Regular"],
                    ["driving", "Driving", "Intenso"],
                    ["syncopated", "Syncopated", "Sincopado"],
                  ].map((r) => (
                    <option value={r[0]}>{r[es ? 2 : 1]}</option>
                  ))}
                </select>
              </label>
              <label>
                {es ? "Tempo de escucha · BPM" : "Preview tempo · BPM"}
                <input
                  id="aiTempo"
                  type="number"
                  min={50}
                  max={220}
                  step="any"
                  value={tempo}
                  disabled={busy}
                  aria-invalid={!validTempo}
                  onInput={(e) => {
                    stopAudition();
                    setTempo(e.currentTarget.value);
                  }}
                />
              </label>
            </div>
            {!validTempo && (
              <p role="alert">
                {es
                  ? "El tempo debe estar entre 50 y 220 BPM."
                  : "Tempo must be between 50 and 220 BPM."}
              </p>
            )}
            <label class="ai-tempo-apply">
              <input
                id="aiApplyTempo"
                type="checkbox"
                checked={applyTempo}
                disabled={busy}
                onChange={(e) => setApplyTempo(e.currentTarget.checked)}
              />
              {es
                ? "Aplicar este BPM al tempo base del proyecto al añadir el clip (conserva cambios posteriores del mapa de tempo)."
                : "Apply this BPM to the project’s base tempo when adding the clip (keeps later tempo-map changes)."}
            </label>
            <div class="ai-musical-settings">
              <label>
                {es ? "Tonalidad" : "Key"}
                <select
                  id="aiKey"
                  value={target.key}
                  disabled={busy}
                  onChange={(event) => {
                    stopAudition();
                    clearResults();
                    setTarget({ ...target, key: event.currentTarget.value });
                  }}
                >
                  {KEYS.map((key) => (
                    <option>{key}</option>
                  ))}
                </select>
              </label>
              <label>
                {es ? "Escala" : "Scale"}
                <select
                  id="aiScale"
                  value={target.scale}
                  disabled={busy}
                  onChange={(event) => {
                    stopAudition();
                    clearResults();
                    setTarget({ ...target, scale: event.currentTarget.value });
                  }}
                >
                  {Object.keys(SCALES).map((scale) => (
                    <option value={scale}>
                      {scaleLabels[scale]?.[es ? 1 : 0] ?? scale}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {es ? "Compases" : "Bars"}
                <select
                  id="aiBars"
                  value={bars}
                  disabled={busy}
                  onChange={(event) => {
                    stopAudition();
                    clearResults();
                    setBars(+event.currentTarget.value);
                  }}
                >
                  {[1, 2, 4, 8].map((value) => (
                    <option>{value}</option>
                  ))}
                </select>
              </label>
            </div>
            <label class="ai-prompt">
              {es ? "Tu idea" : "Your idea"}
              <textarea
                id="aiPrompt"
                maxLength={600}
                rows={3}
                value={prompt}
                disabled={busy}
                placeholder={
                  es
                    ? "Melodía synthwave oscura, notas cortas y un final ascendente"
                    : "A dark synthwave melody, short notes and a rising ending"
                }
                onInput={(event) => {
                  setPrompt(event.currentTarget.value);
                  clearResults();
                  stopAudition();
                }}
              />
            </label>
            <RecipeLibrary
              es={es}
              busy={busy}
              onUse={useRecipe}
              current={
                idea && validTempo
                  ? {
                      recipe: {
                        kind: "melody",
                        id: "draft",
                        name: "Draft",
                        tags: [],
                        style,
                        rhythm,
                        tempo: +tempo,
                        bars,
                        key: target.key,
                        scale: target.scale,
                        prompt: idea,
                      },
                      composition,
                      ...(sound ? { sound } : {}),
                    }
                  : null
              }
            />
            <label class="ai-tempo-apply">
              <input
                id="aiQuality"
                type="checkbox"
                checked={quality}
                disabled={status === "generating" || status === "loading"}
                onChange={(e) => setQuality(e.currentTarget.checked)}
              />
              {es
                ? "Modo Calidad · tres inferencias y selección local"
                : "Quality mode · three inferences and local selection"}
            </label>
            <button
              type="button"
              id="generateLocalAI"
              class="primary"
              disabled={status !== "ready" || !idea || !validTempo}
              onClick={() => void generate()}
            >
              {es ? "Generar propuestas" : "Generate proposals"}
            </button>
            {status === "generating" && (
              <div class="ai-generation-progress">
                <p role="status">
                  {es
                    ? "Generando en tu equipo…"
                    : "Generating on your device…"}{" "}
                  <span aria-hidden="true">{elapsed} s</span>
                </p>
                <button id="cancelAIGeneration" type="button" onClick={cancel}>
                  {es ? "Cancelar generación" : "Cancel generation"}
                </button>
              </div>
            )}
            <p class="ai-context">
              {quality
                ? es
                  ? "Tres inferencias secuenciales; selección heurística por ritmo y contorno. La preferencia musical requiere escucha."
                  : "Three sequential inferences; heuristic selection by rhythm and contour. Musical preference requires listening."
                : es
                  ? "Una inferencia crea el motivo; el motor musical prepara hasta tres variantes distintas. Ajustar y comparar no requiere otra descarga ni inferencia."
                  : "One inference creates the motif; the music engine arranges up to three distinct variants. Shaping and comparing require no further download or inference."}
            </p>
          </>
        )}
        {error && (
          <p class="ai-error" role="alert">
            {es
              ? "No se pudo completar la operación: "
              : "Could not complete the operation: "}
            {error}
          </p>
        )}
        {result && target && (
          <section
            class="ai-result"
            tabIndex={-1}
            aria-label={es ? "Melodía generada" : "Generated melody"}
          >
            <div
              class="ai-proposals"
              role="group"
              aria-label={es ? "Comparar propuestas" : "Compare proposals"}
            >
              {proposals.map((proposal, i) => (
                <button
                  type="button"
                  data-ai-proposal={i}
                  aria-pressed={selected === i}
                  disabled={busy}
                  onClick={() => {
                    setSelected(i);
                    setSelectedBars([]);
                    if (listening) {
                      if (loop) audition.current?.replace(proposal.notes);
                      else stopAudition();
                    }
                  }}
                >
                  {["A", "B", "C"][i]} · {proposal.notes.length}{" "}
                  {es ? "notas" : "notes"}
                </button>
              ))}
            </div>
            <h3>{result.plan.title}</h3>
            {proposals.length < 3 && (
              <p>
                {es
                  ? "Los límites actuales producen menos variantes distintas."
                  : "The current limits produce fewer distinct variants."}
              </p>
            )}
            <p>
              {result.notes.length} {es ? "notas" : "notes"} · {bars}{" "}
              {es ? "compases" : "bars"} · {result.seconds.toFixed(1)} s ·{" "}
              {target.key} {target.scale} · {tempo} BPM
            </p>
            <div
              class="ai-note-preview"
              aria-hidden="true"
              style={{ backgroundSize: `${100 / bars}% 100%` }}
            >
              {result.notes.map((note) => (
                <i
                  data-ai-onset={note.step + note.offset}
                  data-ai-pitch={note.pitch}
                  data-ai-length={note.length}
                  style={{
                    left: `${((note.step + note.offset) / (bars * target.stepsPerBar)) * 100}%`,
                    width: `${Math.max(0.4, (note.length / (bars * target.stepsPerBar)) * 100)}%`,
                    bottom: `${8 + ((note.pitch - lowPitch) / pitchSpan) * 76}%`,
                  }}
                />
              ))}
            </div>
            <div
              class="ai-bar-selection"
              role="group"
              aria-label={es ? "Compases a regenerar" : "Bars to regenerate"}
            >
              {Array.from({ length: bars }, (_, bar) => (
                <button
                  type="button"
                  data-ai-bar={bar}
                  aria-pressed={selectedBars.includes(bar)}
                  disabled={busy}
                  onClick={() =>
                    setSelectedBars(
                      selectedBars.includes(bar)
                        ? selectedBars.filter((v) => v !== bar)
                        : [...selectedBars, bar],
                    )
                  }
                >
                  {es ? "Compás" : "Bar"} {bar + 1}
                </button>
              ))}
            </div>
            <p class="ai-context">
              {es
                ? "Selecciona compases y regenera solo esa parte de la propuesta actual. Los demás se conservan. Cambiar los ajustes recompone la frase completa."
                : "Select bars to regenerate just that part of the current proposal. Other bars are kept. Changing shaping controls rebuilds the whole phrase."}
            </p>
            <button
              id="regenerateAIBars"
              type="button"
              disabled={status !== "ready" || !selectedBars.length}
              onClick={() => void generate(true)}
            >
              {es
                ? "Regenerar compases seleccionados"
                : "Regenerate selected bars"}
            </button>
            <label class="ai-tempo-apply ai-loop">
              <input
                id="aiLoop"
                type="checkbox"
                checked={loop}
                disabled={busy}
                onChange={(e) => {
                  stopAudition();
                  setLoop(e.currentTarget.checked);
                }}
              />
              {es
                ? "Escuchar en bucle · A/B/C cambia en la siguiente vuelta"
                : "Loop preview · A/B/C switches on the next loop"}
            </label>
            <div class="ai-actions">
              <button
                type="button"
                id="auditionLocalAI"
                disabled={busy || !validTempo}
                onClick={() => {
                  if (listening) stopAudition();
                  else
                    try {
                      setListening(true);
                      audition.current = studioBridge.auditionMelody(
                        { ...target, tempo: +tempo },
                        result.notes,
                        (failure) => {
                          setListening(false);
                          if (failure) setError(failure);
                        },
                        sound ?? undefined,
                        { bars, loop },
                      );
                    } catch (failure) {
                      setListening(false);
                      setError(describeFailure(failure, es));
                    }
                }}
              >
                {listening
                  ? es
                    ? "Detener escucha"
                    : "Stop preview"
                  : es
                    ? "Escuchar"
                    : "Listen"}
              </button>
              <button
                type="button"
                id="applyLocalAI"
                class="primary"
                disabled={busy || !validTempo}
                onClick={() => {
                  try {
                    stopAudition();
                    studioBridge.applyMelody(
                      target,
                      result.plan.title,
                      bars,
                      result.notes,
                      {
                        sound: sound ?? undefined,
                        tempo: applyTempo ? +tempo : undefined,
                      },
                    );
                    clearResults();
                    document
                      .querySelector<HTMLDialogElement>("#localAIDialog")
                      ?.close();
                  } catch (failure) {
                    setError(describeFailure(failure, es));
                  }
                }}
              >
                {es ? "Añadir como clip nuevo" : "Add as new clip"}
              </button>
            </div>
          </section>
        )}
        <p class="ai-footnote">
          {es
            ? "Experimental: un modelo pequeño puede interpretar mal instrucciones complejas. Puedes generar otra variante; ningún clip cambia hasta que lo añadas."
            : "Experimental: a small model may misinterpret complex instructions. Generate another variation; clips stay unchanged until you add the result."}
        </p>
      </dialog>
    );
  }
  render(<LocalAI />, host);
  studioBridge.openLocalAI = () => openLocalAI();
  subscribeLanguage(updateLanguage);
  const button = document.createElement("button");
  button.type = "button";
  button.id = "aiMelodyBtn";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-controls", "localAIDialog");
  button.onclick = () => openLocalAI();
  document.querySelector(".generators")?.append(button);
  const menuButton = document.createElement("button");
  menuButton.id = "menuAIMelodyBtn";
  menuButton.type = "button";
  menuButton.dataset.noTranslate = "";
  menuButton.setAttribute("aria-haspopup", "dialog");
  menuButton.setAttribute("aria-controls", "localAIDialog");
  menuButton.onclick = () => openLocalAI();
  document.querySelector("#menuSettingsBtn")?.after(menuButton);
  const label = () => {
    button.textContent = getLanguage() === "es" ? "MELODÍA IA" : "AI MELODY";
    menuButton.textContent =
      getLanguage() === "es"
        ? "Generar melodía con IA local"
        : "Generate melody with local AI";
  };
  label();
  subscribeLanguage(label);
  window.addEventListener("blur", () => stopPreview());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPreview();
  });
}
