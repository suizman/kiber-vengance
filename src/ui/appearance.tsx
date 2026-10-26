import { render } from "preact";
import { useState } from "preact/hooks";
import { getLanguage, subscribeLanguage } from "./i18n";
import { studioBridge } from "./bridge";

const STORAGE = "kiber-vengance-appearance-v1";
const skins = [
  {
    id: "neon",
    name: "Neon Circuit",
    en: "Obsidian keys, cyan circuitry and magenta edges.",
    es: "Teclas de obsidiana, circuitos cian y bordes magenta.",
  },
  {
    id: "terminal",
    name: "Acid Terminal",
    en: "Graphite hardware with acid-green signal strips.",
    es: "Grafito con indicadores de señal verde ácido.",
  },
  {
    id: "ember",
    name: "Ember Drive",
    en: "Warm copper, smoked metal and amber light.",
    es: "Cobre, metal ahumado y luz ámbar.",
  },
  {
    id: "scarlett",
    name: "Scarlett Protocol",
    en: "Black chrome, crimson circuitry and scarlet light.",
    es: "Cromo negro, circuitos carmesí y luz escarlata.",
  },
  {
    id: "classic",
    name: "Studio Classic",
    en: "The original light and dark studio keys.",
    es: "Las teclas claras y oscuras originales del estudio.",
  },
] as const;
type Skin = (typeof skins)[number]["id"];
interface Appearance {
  skin: Skin;
  accent: "cyan" | "violet" | "amber";
  glow: number;
  shortcuts: boolean;
}
const defaults: Appearance = {
  skin: "neon",
  accent: "cyan",
  glow: 65,
  shortcuts: true,
};
function load(): Appearance {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE) || "null");
    return {
      skin: skins.some((skin) => skin.id === value?.skin)
        ? value.skin
        : defaults.skin,
      accent: ["cyan", "violet", "amber"].includes(value?.accent)
        ? value.accent
        : defaults.accent,
      glow:
        typeof value?.glow === "number" && Number.isFinite(value.glow)
          ? Math.max(0, Math.min(100, value.glow))
          : defaults.glow,
      shortcuts:
        typeof value?.shortcuts === "boolean"
          ? value.shortcuts
          : defaults.shortcuts,
    };
  } catch {
    return { ...defaults };
  }
}
let appearance = load();
function apply(value: Appearance) {
  const root = document.documentElement;
  root.dataset.keyboardSkin = value.skin;
  root.dataset.controlAccent = value.accent;
  root.dataset.keyShortcuts = String(value.shortcuts);
  root.style.setProperty("--key-glow-size", `${value.glow * 0.3}px`);
}
// Apply before the shell mounts, including keyboards mounted later on demand.
apply(appearance);

export function setupAppearance() {
  const host = document.createElement("div");
  document.body.append(host);
  let openSettings: () => void;
  let refreshLanguage: () => void;
  function Settings() {
    const [value, setValue] = useState(appearance);
    const [language, setLanguage] = useState(getLanguage());
    const [saved, setSaved] = useState(true);
    const es = language === "es";
    refreshLanguage = () => setLanguage(getLanguage());
    const change = (next: Appearance) => {
      appearance = next;
      apply(next);
      setValue(next);
      try {
        localStorage.setItem(STORAGE, JSON.stringify(next));
        setSaved(true);
      } catch {
        setSaved(false);
      }
    };
    openSettings = () => {
      studioBridge.release();
      document.querySelector<HTMLDialogElement>("#projectMenu")?.close();
      document
        .querySelector<HTMLDialogElement>("#appearanceDialog")
        ?.showModal();
    };
    return (
      <dialog
        id="appearanceDialog"
        class="appearance-dialog"
        aria-labelledby="appearanceTitle"
        data-no-translate
      >
        <header class="appearance-header">
          <div>
            <span class="eyebrow">PERSONAL STUDIO // К/V</span>
            <h2 id="appearanceTitle">{es ? "Configuración" : "Settings"}</h2>
          </div>
          <button
            type="button"
            autoFocus
            class="appearance-close"
            aria-label={es ? "Cerrar configuración" : "Close settings"}
            onClick={() =>
              document
                .querySelector<HTMLDialogElement>("#appearanceDialog")
                ?.close()
            }
          >
            ×
          </button>
        </header>
        <p class="appearance-intro">
          {es
            ? "Tu instrumento. Tu estética. Los cambios se aplican al instante en todos los teclados."
            : "Your instrument. Your aesthetic. Changes appear instantly across every keyboard."}
        </p>
        <fieldset>
          <legend>{es ? "Estilo del teclado" : "Keyboard skin"}</legend>
          <div class="skin-options">
            {skins.map((skin) => (
              <button
                type="button"
                class="skin-option"
                data-skin-option={skin.id}
                aria-pressed={value.skin === skin.id}
                onClick={() => change({ ...value, skin: skin.id })}
              >
                <span
                  class="skin-preview"
                  data-preview-skin={skin.id}
                  aria-hidden="true"
                >
                  {Array.from({ length: 7 }, (_, index) => (
                    <i class="preview-natural" key={`n${index}`} />
                  ))}
                  {[1, 2, 4, 5, 6].map((index) => (
                    <i
                      class="preview-accidental"
                      style={{ left: `calc(${index} * 100% / 7 - 4%)` }}
                      key={`a${index}`}
                    />
                  ))}
                  <i class="preview-signal" />
                </span>
                <span class="skin-option-heading">
                  <b>{skin.name}</b>
                  <span aria-hidden="true">
                    {value.skin === skin.id ? "✓" : "+"}
                  </span>
                </span>
                <span class="skin-description">{es ? skin.es : skin.en}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset class="appearance-controls">
          <legend>{es ? "Personalización" : "Personalization"}</legend>
          <label class="appearance-glow">
            <span>
              {es ? "Brillo de las teclas" : "Key glow"}
              <output>{value.glow}%</output>
            </span>
            <input
              id="keyGlow"
              type="range"
              min="0"
              max="100"
              value={value.glow}
              onInput={(event) =>
                change({ ...value, glow: event.currentTarget.valueAsNumber })
              }
            />
          </label>
          <label>
            <span>{es ? "Color de interacción" : "Control accent"}</span>
            <select
              id="controlAccent"
              value={value.accent}
              onChange={(event) =>
                change({
                  ...value,
                  accent: event.currentTarget.value as Appearance["accent"],
                })
              }
            >
              <option value="cyan">
                {es ? "Cian eléctrico" : "Electric cyan"}
              </option>
              <option value="violet">{es ? "Violeta" : "Violet"}</option>
              <option value="amber">{es ? "Ámbar" : "Amber"}</option>
            </select>
          </label>
          <label class="appearance-toggle">
            <span>
              {es ? "Mostrar atajos en las teclas" : "Show shortcuts on keys"}
            </span>
            <input
              id="keyShortcuts"
              type="checkbox"
              checked={value.shortcuts}
              onChange={(event) =>
                change({ ...value, shortcuts: event.currentTarget.checked })
              }
            />
          </label>
        </fieldset>
        <footer class="appearance-footer">
          <p role="status">
            {saved
              ? es
                ? "Guardado en este navegador. No modifica tus proyectos."
                : "Saved in this browser. Your projects stay unchanged."
              : es
                ? "No se pudo guardar. Los cambios durarán esta sesión."
                : "Could not save. Changes apply for this session."}
          </p>
          <button
            type="button"
            id="resetAppearance"
            onClick={() => change({ ...defaults })}
          >
            {es ? "Restaurar apariencia" : "Reset appearance"}
          </button>
        </footer>
      </dialog>
    );
  }
  render(<Settings />, host);
  const button = document.createElement("button");
  button.id = "settingsBtn";
  button.type = "button";
  button.onclick = () => openSettings();
  document.querySelector(".top-actions #menuBtn")?.before(button);
  const menuButton = document.createElement("button");
  menuButton.id = "menuSettingsBtn";
  menuButton.type = "button";
  menuButton.onclick = () => openSettings();
  document.querySelector("#projectMenu h2")?.after(menuButton);
  const labels = () => {
    const title = getLanguage() === "es" ? "Configuración" : "Settings";
    button.textContent = "⚙";
    button.setAttribute("aria-label", title);
    button.title = title;
    menuButton.textContent = title;
    refreshLanguage();
  };
  labels();
  subscribeLanguage(labels);
}
