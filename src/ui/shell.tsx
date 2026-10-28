import { render } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { studioBridge, type StudioView } from "./bridge";
const destinations = [
  ["compose", "Compose", "Componer", "01"],
  ["arrange", "Arrange", "Arreglar", "02"],
  ["live", "Live", "Directo", "03"],
  ["mix", "Mix", "Mezclar", "04"],
] as const;
const viewSpace = (view: StudioView) =>
  view === "forge"
    ? "compose"
    : view === "audio" || view === "arrange"
      ? "arrange"
      : view === "launch" || view === "perform"
        ? "live"
        : "mix";
const titles: Record<StudioView, [string, string, string, string]> = {
  forge: [
    "Compose",
    "Componer",
    "A phrase. A sound. Your next idea.",
    "Una frase. Un sonido. Tu próxima idea.",
  ],
  arrange: [
    "Arrangement",
    "Arreglo",
    "Build the shape of your track.",
    "Dale forma a tu canción.",
  ],
  audio: [
    "Audio & sampler",
    "Audio y sampler",
    "Record, edit and transform your sound.",
    "Graba, edita y transforma tu sonido.",
  ],
  launch: [
    "Clip launcher",
    "Lanzador de clips",
    "Bring your clips to the stage.",
    "Lleva tus clips al directo.",
  ],
  perform: [
    "Performance deck",
    "Mesa de directo",
    "Play, capture and reshape the moment.",
    "Toca, captura y transforma el momento.",
  ],
  mix: [
    "Mix & master",
    "Mezcla y master",
    "Give every element its place.",
    "Dale a cada elemento su lugar.",
  ],
};
function Slot({
  nodes,
  className = "",
}: {
  nodes: Element[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const target = ref.current!;
    nodes.forEach((node) => target.append(node));
    return () => {
      nodes.forEach((node) => node.remove());
    };
  }, [nodes]);
  return <div class={className} ref={ref} />;
}
export function mountStudioShell() {
  const old = document.querySelector("#app")!;
  const take = (selector: string) => Array.from(old.querySelectorAll(selector));
  const brand = take(".brand"),
    project = take(".project-head"),
    transport = Array.from(document.querySelectorAll(".transport")),
    actions = take(".top-actions"),
    tracks = take(".track-rail"),
    modeActions = take(".mode-actions"),
    global = take(".global-locator"),
    footer = take("footer"),
    saveWarnings = take("#saveWarning");
  const inspector = ["synthRack", "motionRack", "effectsRack", "macroRack"].map(
    (id) => document.getElementById(id)!,
  );
  const transportElement = transport[0]!;
  const settings = document.createElement("details");
  settings.className = "transport-settings";
  const settingsLabel = document.createElement("summary");
  settingsLabel.id = "transportSettingsBtn";
  settingsLabel.dataset.en = "Transport settings";
  settingsLabel.dataset.es = "Ajustes de transporte";
  settingsLabel.textContent =
    studioBridge.getSnapshot().language === "es"
      ? "Ajustes de transporte"
      : "Transport settings";
  settings.append(settingsLabel);
  const settingsControls = document.createElement("div");
  settingsControls.className = "transport-options";
  transportElement
    .querySelectorAll(".count-in")
    .forEach((node) => settingsControls.append(node));
  settings.append(settingsControls);
  transportElement.append(settings);
  const views = take(".view");
  const remembered: Record<string, StudioView> = {
    compose: "forge",
    arrange: "arrange",
    live: "perform",
    mix: "mix",
  };
  const scroll = new Map<string, number>();
  const host = document.createElement("div");
  host.id = "app";
  host.className = "app studio-shell";
  old.id = "source-template";
  old.before(host);
  function Shell() {
    const [state, setState] = useState(studioBridge.getSnapshot());
    const expanded = state.expanded;
    const [density, setDensity] = useState(
      localStorage.getItem("kv-density") || "comfortable",
    );
    useLayoutEffect(
      () => studioBridge.subscribe(() => setState(studioBridge.getSnapshot())),
      [],
    );
    useLayoutEffect(() => {
      const key = (event: KeyboardEvent) => {
        if (event.key === "Escape" && studioBridge.getSnapshot().inspector)
          studioBridge.toggleInspector();
      };
      window.addEventListener("keydown", key);
      return () => window.removeEventListener("keydown", key);
    }, []);
    const es = state.language === "es",
      space = viewSpace(state.view),
      title = titles[state.view];
    useLayoutEffect(() => {
      const densityEvent = (event: Event) =>
        setDensity((event as CustomEvent<string>).detail);
      window.addEventListener("kv-density", densityEvent);
      return () => window.removeEventListener("kv-density", densityEvent);
    }, []);
    useLayoutEffect(() => {
      document.documentElement.dataset.density = density;
      try {
        localStorage.setItem("kv-density", density);
      } catch {
        /* Density remains usable for this session. */
      }
    }, [density]);
    useLayoutEffect(() => {
      for (const node of views) {
        const active = node.id === `${state.view}View`;
        (node as HTMLElement).hidden = !active;
        node.classList.toggle("active", active);
      }
      host.dataset.activeView = state.view;
      host.dataset.activeSpace = space;
      host.classList.toggle("instrument-expanded", expanded);
    }, [state.view, expanded]);
    const navigate = (view: StudioView) => {
      scroll.set(state.view, window.scrollY);
      remembered[viewSpace(view)] = view;
      studioBridge.release();
      studioBridge.navigate(view);
      requestAnimationFrame(() =>
        window.scrollTo({ top: scroll.get(view) || 0, behavior: "instant" }),
      );
    };
    const tabs: StudioView[] =
      space === "arrange"
        ? ["arrange", "audio"]
        : space === "live"
          ? ["perform", "launch"]
          : space === "compose"
            ? ["forge"]
            : ["mix"];
    return (
      <>
        <header class="studio-header">
          <Slot nodes={brand} />
          <Slot nodes={project} />
          <Slot nodes={transport} />
          <Slot nodes={actions} />
        </header>
        <nav
          class="studio-nav"
          aria-label={es ? "Espacios de trabajo" : "Workspaces"}
        >
          {destinations.map(([id, en, spanish, num]) => (
            <button
              data-space={id}
              aria-current={space === id ? "page" : undefined}
              onClick={() => navigate(remembered[id]!)}
            >
              <span class="nav-number" aria-hidden="true">
                {num}
              </span>
              <span>{es ? spanish : en}</span>
            </button>
          ))}
          <span class="nav-signature">KV / STUDIO</span>
        </nav>
        <main class="studio-main workspace">
          <div class="studio-contextbar modebar">
            <div>
              <span class="eyebrow">
                КИБЕР VENGANCE / {space.toUpperCase()}
              </span>
              <h1>{title[es ? 1 : 0]}</h1>
              <p>{title[es ? 3 : 2]}</p>
            </div>
            <div class="studio-context-actions">
              {space === "compose" && (
                <button
                  id="composeAIMelodyBtn"
                  aria-haspopup="dialog"
                  aria-controls="localAIDialog"
                  onClick={() => studioBridge.openLocalAI()}
                >
                  {es ? "Melodía IA" : "AI melody"}
                </button>
              )}
              <button
                id="soundInspectorBtn"
                aria-expanded={state.inspector}
                aria-controls="studioInspector"
                onClick={() => studioBridge.toggleInspector()}
              >
                {es ? "Sonido" : "Sound"}
              </button>
              <button
                aria-pressed={expanded}
                onClick={() => studioBridge.toggleFocus()}
              >
                {expanded
                  ? es
                    ? "Salir de vista ampliada"
                    : "Exit expanded view"
                  : es
                    ? "Ampliar"
                    : "Expand"}
              </button>
              <label class="density-control">
                <span>{es ? "Densidad" : "Density"}</span>
                <select
                  aria-label={es ? "Densidad de interfaz" : "Interface density"}
                  value={density}
                  onChange={(e) => setDensity(e.currentTarget.value)}
                >
                  <option value="comfortable">
                    {es ? "Cómoda" : "Comfortable"}
                  </option>
                  <option value="compact">{es ? "Compacta" : "Compact"}</option>
                </select>
              </label>
            </div>
          </div>
          <div
            class={`studio-subnav${tabs.length > 1 ? " has-view-tabs" : ""}`}
          >
            {tabs.length > 1 && (
              <nav
                key="workspace-tabs"
                aria-label={es ? "Herramientas del espacio" : "Workspace tools"}
              >
                {tabs.map((view) => (
                  <button
                    key={view}
                    data-view={view}
                    aria-current={view === state.view ? "page" : undefined}
                    onClick={() => navigate(view)}
                  >
                    {titles[view][es ? 1 : 0]}
                  </button>
                ))}
              </nav>
            )}
            <Slot key="workspace-actions" nodes={modeActions} />
          </div>
          <div class="studio-transport-context">
            <span id="transportScope">
              {es ? "Transporte: " : "Transport: "}
              {state.songMode
                ? es
                  ? "Canción"
                  : "Song"
                : es
                  ? "Clips activos"
                  : "Active clips"}
            </span>
            <span role="status">
              {state.playing
                ? es
                  ? "Reproduciendo"
                  : "Playing"
                : state.paused
                  ? es
                    ? "En pausa"
                    : "Paused"
                  : es
                    ? "Preparado"
                    : "Ready"}
              {state.armed
                ? es
                  ? " · Notas preparadas para grabar"
                  : " · Note recording armed"
                : ""}
            </span>
          </div>
          <Slot nodes={saveWarnings} className="studio-save-warning" />
          <Slot nodes={tracks} className="studio-trackbar" />
          <Slot nodes={global} className="studio-song-position" />
          <Slot nodes={views} className="studio-content" />
        </main>
        {state.inspector && (
          <button
            class="studio-inspector-backdrop"
            aria-label={es ? "Cerrar inspector" : "Close inspector"}
            onClick={() => studioBridge.toggleInspector()}
          />
        )}
        <aside
          id="studioInspector"
          class={`studio-inspector ${state.inspector ? "is-open" : ""}`}
          aria-hidden={!state.inspector}
          inert={!state.inspector}
        >
          <div class="studio-inspector-header">
            <div>
              <span class="eyebrow">
                {es ? "Inspector de sonido" : "Sound inspector"}
              </span>
              <h2>{state.context}</h2>
            </div>
            <button
              aria-label={es ? "Cerrar inspector" : "Close inspector"}
              onClick={() => studioBridge.toggleInspector()}
            >
              ×
            </button>
          </div>
          <Slot nodes={inspector} />
        </aside>
        <Slot nodes={footer} className="studio-footer" />
      </>
    );
  }
  render(<Shell />, host);
  old.remove();
  document.querySelector(".mobile-studio-nav")?.remove();
}
