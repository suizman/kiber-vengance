import {
  DEFAULT_COMPOSITION,
  type CompositionOptions,
  type MusicalContext,
} from "../ai/composer";

export function CompositionControls({
  es,
  options,
  context,
  busy,
  onChange,
}: {
  es: boolean;
  options: CompositionOptions;
  context: MusicalContext | undefined;
  busy: boolean;
  onChange: (options: CompositionOptions) => void;
}) {
  const set = <K extends keyof CompositionOptions>(
    key: K,
    value: CompositionOptions[K],
  ) => onChange({ ...options, [key]: value });
  const source = !!context?.source.notes.length;
  return (
    <section
      class="ai-composition"
      aria-label={es ? "Dirección musical" : "Musical direction"}
    >
      <div class="ai-musical-settings ai-direction">
        <label>
          {es ? "Qué quieres crear" : "What to create"}
          <select
            id="aiMode"
            value={options.mode}
            disabled={busy}
            onChange={(e) =>
              set("mode", e.currentTarget.value as CompositionOptions["mode"])
            }
          >
            {[
              ["new", "New idea", "Idea nueva"],
              ["continue", "Continue this clip", "Continuar este clip"],
              ["answer", "Answer this clip", "Responder a este clip"],
              ["variation", "Vary this clip", "Variar este clip"],
              ["rhythm", "Same motif, new rhythm", "Mismo motivo, nuevo ritmo"],
            ].map(([id, en, spanish]) => (
              <option value={id} disabled={id !== "new" && !source}>
                {es ? spanish : en}
              </option>
            ))}
          </select>
        </label>
        <label>
          {es ? "Forma" : "Form"}
          <select
            id="aiStructure"
            value={options.structure}
            disabled={busy}
            onChange={(e) =>
              set(
                "structure",
                e.currentTarget.value as CompositionOptions["structure"],
              )
            }
          >
            <option value="phrase">
              {es ? "Frase con cierre" : "Phrase with ending"}
            </option>
            <option value="loop">{es ? "Bucle" : "Loop"}</option>
            <option value="free">{es ? "Libre" : "Free"}</option>
          </select>
        </label>
      </div>
      <label class="ai-tempo-apply">
        <input
          id="aiUseContext"
          type="checkbox"
          checked={options.context}
          disabled={busy}
          onChange={(e) => set("context", e.currentTarget.checked)}
        />
        {es ? "Encajar con los clips activos" : "Fit the active clips"}
      </label>
      <p class="ai-context" id="aiContextSummary">
        {context
          ? `${es ? "Referencia" : "Reference"}: ${context.source.name} · ${context.source.notes.length} ${es ? "notas" : "notes"}. `
          : ""}
        {options.context && context?.voices.length
          ? `${es ? "Acompañamiento" : "Accompaniment"}: ${context.voices.map((v) => v.track).join(" · ")}.`
          : es
            ? "La tonalidad y la escala siempre se respetan."
            : "Key and scale are always respected."}
        {options.mode !== "new" && (
          <span>
            {" "}
            {es
              ? "Se crea una frase nueva; el clip original se conserva."
              : "Creates a new phrase; your original clip is preserved."}
          </span>
        )}
      </p>
      <details class="ai-catalog" id="aiCompositionControls">
        <summary>
          {es ? "Afinar la composición" : "Shape the composition"}
        </summary>
        <p>
          {es
            ? "Estos límites se aplican a las notas. Tras generar, puedes ajustarlos sin volver a esperar al modelo."
            : "These limits control the notes. After generating, adjust them without waiting for the model again."}
        </p>
        <div class="ai-musical-settings">
          <label>
            {es ? "Notas por compás" : "Notes per bar"}
            <select
              id="aiDensity"
              value={options.density}
              disabled={busy}
              onChange={(e) => set("density", +e.currentTarget.value)}
            >
              <option value="0">
                {es ? "Según motivo / ritmo" : "Follow motif / rhythm"}
              </option>
              {[2, 4, 8, 12].map((n) => (
                <option value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            {es ? "Registro" : "Register"}
            <select
              id="aiRegister"
              value={options.register}
              disabled={busy}
              onChange={(e) =>
                set(
                  "register",
                  e.currentTarget.value as CompositionOptions["register"],
                )
              }
            >
              <option value="low">{es ? "Grave" : "Low"}</option>
              <option value="middle">{es ? "Medio" : "Middle"}</option>
              <option value="high">{es ? "Agudo" : "High"}</option>
            </select>
          </label>
          <label>
            {es ? "Salto máximo" : "Maximum leap"}
            <select
              id="aiMaxLeap"
              value={options.maxLeap}
              disabled={busy}
              onChange={(e) => set("maxLeap", +e.currentTarget.value)}
            >
              {[2, 5, 7, 12].map((n) => (
                <option value={n}>
                  {n} {es ? "semitonos" : "semitones"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div class="ai-musical-settings ai-direction">
          <label>
            {es ? "Repetición" : "Repetition"}{" "}
            <output>{options.repetition}%</output>
            <input
              id="aiRepetition"
              type="range"
              min="0"
              max="100"
              value={options.repetition}
              disabled={busy}
              onInput={(e) => set("repetition", +e.currentTarget.value)}
            />
          </label>
          <label>
            {es ? "Variación" : "Variation"}{" "}
            <output>{options.variation}%</output>
            <input
              id="aiVariation"
              type="range"
              min="0"
              max="100"
              value={options.variation}
              disabled={busy || options.mode === "rhythm"}
              onInput={(e) => set("variation", +e.currentTarget.value)}
            />
          </label>
        </div>
        <p>
          {es
            ? "Los saltos y el registro tienen prioridad sobre el cierre armónico. Un clip polifónico aporta su línea superior."
            : "Leap and register limits take priority over harmonic endings. Polyphonic clips contribute their top melody."}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onChange({
              ...DEFAULT_COMPOSITION,
              mode: options.mode,
              context: options.context,
            })
          }
        >
          {es ? "Restablecer ajustes" : "Reset shaping"}
        </button>
      </details>
    </section>
  );
}
