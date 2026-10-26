import { useRef, useState } from "preact/hooks";
import factory from "../../public/presets/catalog-v1.json";
import {
  fetchPresetCatalog,
  OFFICIAL_PRESET_URL,
  parsePresetCatalog,
  type CatalogPreset,
  type MelodyRecipe,
  type SoundPreset,
} from "../ai/presets";
import { studioBridge } from "./bridge";

const included = parsePresetCatalog(factory);
const providers = [
  {
    name: "Vital",
    url: "https://vital.audio/",
    domain: "vital.audio",
    format: ".vital",
  },
  {
    name: "Surge XT",
    url: "https://surge-synthesizer.github.io/",
    domain: "surge-synthesizer.github.io",
    format: ".fxp",
  },
  {
    name: "Serum 2",
    url: "https://xferrecords.com/products/serum-2",
    domain: "xferrecords.com",
    format: ".SerumPreset / .fxp",
  },
];
export function PresetCatalog({
  es,
  busy,
  track,
  onRecipe,
  onSound,
}: {
  es: boolean;
  busy: boolean;
  track: string | undefined;
  onRecipe: (recipe: MelodyRecipe) => void;
  onSound: (sound: SoundPreset) => void;
}) {
  const [extra, setExtra] = useState<CatalogPreset[]>([]);
  const [factoryPresets, setFactoryPresets] = useState(included);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [url, setUrl] = useState(OFFICIAL_PRESET_URL);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const accept = (
    presets: CatalogPreset[],
    source: string,
    official = false,
  ) => {
    // Remote data cannot replace the included factory collection or claim its identity.
    const reserved = new Set(factoryPresets.map((p) => p.id));
    if (official) {
      setFactoryPresets(presets);
      setExtra((previous) =>
        previous.filter((p) => !presets.some((f) => f.id === p.id)),
      );
    } else
      setExtra((previous) =>
        [
          ...new Map(
            [...previous, ...presets.filter((p) => !reserved.has(p.id))].map(
              (p) => [p.id, p],
            ),
          ).values(),
        ].slice(-256),
      );
    setMessage(
      `${presets.length} ${es ? "presets validados" : "validated presets"} · ${source}`,
    );
    setError("");
  };
  const load = async (location: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const result = await fetchPresetCatalog(location, controller.signal);
      if (!controller.signal.aborted)
        accept(
          result.presets,
          result.official
            ? es
              ? "catálogo oficial"
              : "official catalog"
            : es
              ? "URL externa"
              : "external URL",
          result.official,
        );
    } catch (failure) {
      if (!controller.signal.aborted) setError(String(failure));
    } finally {
      if (request.current === controller) {
        setLoading(false);
        request.current = null;
      }
    }
  };
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = [...factoryPresets, ...extra].filter(
    (p) =>
      (kind === "all" || p.kind === kind) &&
      terms.every((term) =>
        `${p.name} ${p.tags.join(" ")} ${p.kind === "sound" ? p.track : p.style}`
          .toLowerCase()
          .includes(term),
      ),
  );
  return (
    <details class="ai-catalog" id="aiPresetCatalog">
      <summary>
        {es ? "Presets de melodía y sonido" : "Melody & sound presets"}
      </summary>
      <p>
        {es
          ? "Recetas originales y sonidos compatibles de КИБЕР VENGANCE. Elegir prepara la propuesta; los clips actuales no cambian."
          : "Original recipes and compatible КИБЕР VENGANCE sounds. Selecting prepares your proposal; existing clips stay unchanged."}
      </p>
      <div class="ai-catalog-filters">
        <label>
          {es ? "Buscar presets" : "Search presets"}
          <input
            id="aiPresetSearch"
            type="search"
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
        </label>
        <label>
          {es ? "Tipo" : "Type"}
          <select
            id="aiPresetKind"
            value={kind}
            onChange={(e) => setKind(e.currentTarget.value)}
          >
            <option value="all">{es ? "Ambos" : "Both"}</option>
            <option value="melody">{es ? "Melodía" : "Melody"}</option>
            <option value="sound">{es ? "Sonido" : "Sound"}</option>
          </select>
        </label>
      </div>
      <ul
        class="ai-preset-list"
        aria-label={es ? "Presets compatibles" : "Compatible presets"}
      >
        {visible.map((p) => (
          <li key={p.id} data-ai-preset={p.id}>
            <div>
              <b>{p.name}</b>
              <small>
                {p.kind === "melody"
                  ? `${es ? "Melodía" : "Melody"} · ${p.tempo} BPM · ${p.style}`
                  : `${es ? "Sonido" : "Sound"} · ${p.track.toUpperCase()}`}{" "}
                ·{" "}
                {factoryPresets.some((f) => f.id === p.id)
                  ? es
                    ? "oficial"
                    : "official"
                  : es
                    ? "importado"
                    : "imported"}
              </small>
            </div>
            <div class="ai-actions">
              <button
                type="button"
                disabled={
                  busy || !track || (p.kind === "sound" && p.track !== track)
                }
                onClick={() => (p.kind === "melody" ? onRecipe(p) : onSound(p))}
              >
                {p.kind === "melody"
                  ? es
                    ? "Usar receta"
                    : "Use recipe"
                  : es
                    ? "Usar sonido"
                    : "Use sound"}
              </button>
              {p.kind === "sound" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    try {
                      studioBridge.storeSoundPreset(p);
                      setMessage(
                        es
                          ? `Guardado en Preset Vault: ${p.name}`
                          : `Saved to Preset Vault: ${p.name}`,
                      );
                      setError("");
                    } catch (failure) {
                      setError(String(failure));
                    }
                  }}
                >
                  {es ? "Guardar en Vault" : "Save to Vault"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!visible.length && (
        <p>{es ? "No hay coincidencias." : "No matching presets."}</p>
      )}
      <p>
        {es
          ? "Los sonidos deben coincidir con la pista destino. También puedes guardarlos en Preset Vault y aplicarlos allí, sin generar con IA."
          : "Sounds must match the target track. You can also save them to Preset Vault and apply them there without AI generation."}
      </p>
      <label class="ai-prompt">
        {es
          ? "Importar catálogo o banco JSON (máx. 1 MB)"
          : "Import JSON catalog or bank (max. 1 MB)"}
        <input
          id="aiPresetFile"
          type="file"
          accept=".json,application/json"
          disabled={busy || loading}
          onChange={async (e) => {
            const input = e.currentTarget,
              file = input.files?.[0];
            if (!file) return;
            try {
              if (file.size > 1024 * 1024)
                throw new Error(
                  es ? "El catálogo supera 1 MB." : "Catalog exceeds 1 MB.",
                );
              accept(
                parsePresetCatalog(JSON.parse(await file.text())),
                file.name,
              );
            } catch (failure) {
              setError(String(failure));
            } finally {
              input.value = "";
            }
          }}
        />
      </label>
      <label class="ai-prompt">
        {es
          ? "URL de catálogo compatible (HTTPS)"
          : "Compatible catalog URL (HTTPS)"}
        <input
          id="aiPresetURL"
          type="url"
          value={url}
          disabled={loading || busy}
          onInput={(e) => setUrl(e.currentTarget.value)}
        />
      </label>
      <div class="ai-actions">
        <button
          id="aiPresetFetch"
          type="button"
          disabled={loading || busy || !url.trim()}
          onClick={() => void load(url.trim())}
        >
          {es ? "Cargar URL" : "Load URL"}
        </button>
        <button
          id="aiPresetOfficial"
          type="button"
          disabled={loading || busy}
          onClick={() => {
            setUrl(OFFICIAL_PRESET_URL);
            void load(OFFICIAL_PRESET_URL);
          }}
        >
          {es
            ? "Consultar catálogo oficial online"
            : "Check official online catalog"}
        </button>
        {loading && (
          <button
            type="button"
            onClick={() => {
              request.current?.abort();
              setLoading(false);
            }}
          >
            {es ? "Cancelar consulta" : "Cancel request"}
          </button>
        )}
      </div>
      {loading && (
        <p role="status">
          {es ? "Consultando catálogo…" : "Fetching catalog…"}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p class="ai-error" role="alert">
          {error}
        </p>
      )}
      <details class="ai-external-presets">
        <summary>
          {es
            ? "Buscar en fuentes oficiales de otros sintetizadores"
            : "Search other synthesizers’ official sources"}
        </summary>
        <p>
          {es
            ? "Estos formatos requieren su propio sintetizador y no se pueden importar en el motor de КИБЕР VENGANCE. Los enlaces abren sus fuentes oficiales; la búsqueda se limita a su dominio."
            : "These formats require their own synthesizer and cannot be imported into the КИБЕР VENGANCE engine. Links open official sources; search is restricted to their domain."}
        </p>
        <ul>
          {providers.map((p) => (
            <li key={p.name}>
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                {p.name}
              </a>{" "}
              · {p.format} ·{" "}
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(`site:${p.domain} presets ${query.trim()}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {es ? "Buscar presets oficiales" : "Search official presets"}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </details>
  );
}
