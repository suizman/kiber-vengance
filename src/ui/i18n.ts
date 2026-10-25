import english from "./locales/en.json";
import spanish from "./locales/es.json";

export type Language = "en" | "es";
export type MessageParams = Record<
  string,
  string | number | boolean | null | undefined
>;
export type MessageId = keyof typeof english;
const catalogs: Record<Language, Record<string, string>> = {
  en: english,
  es: spanish,
};
const STORAGE_KEY = "kiber-vengance-language-v1";
let language: Language = "en";
try {
  language = localStorage.getItem(STORAGE_KEY) === "es" ? "es" : "en";
} catch {
  /* Storage denial must not prevent launch. */
}
const listeners = new Set<(language: Language) => void>();

export function getLanguage(): Language {
  return language;
}
export function setLanguage(value: Language): void {
  language = value;
  document.documentElement.lang = value;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* Session-only language remains usable. */
  }
  for (const listener of listeners) listener(value);
}
export function subscribeLanguage(
  listener: (language: Language) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
/** Strings are plain text. Escape the result before inserting it into HTML. */
export function t(id: MessageId | string, params: MessageParams = {}): string {
  const message = catalogs[language][id] ?? catalogs.en[id] ?? id;
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name] ?? "")
      : match,
  );
}
/** Bridge for dynamic pairs pending a stable parameterized message ID. */
export function translate(en: string, es: string): string {
  return language === "es" ? es : en;
}

const lookup = new Map<string, string>();
for (const [id, value] of Object.entries(english))
  if (!value.includes("{arg")) lookup.set(value, id);
for (const [id, value] of Object.entries(spanish))
  if (!value.includes("{arg")) lookup.set(value, id);
export function messageId(text: string): string | undefined {
  return lookup.get(text.trim());
}
export function translateText(text: string): string {
  const id = messageId(text);
  if (!id) return text;
  return text.replace(text.trim(), t(id));
}

// Never walk arbitrary user content. Native inputs keep their values, selections,
// listeners and pointer captures; only known control copy is updated in place.
const excluded =
  "[data-user-content],[data-no-translate],script,style,textarea,[contenteditable],.track-name,.launcher-cell,.scene-name,.preset-card,.version-item,.note-block,.keyboard-key,.key,.sampler-key,#clipSelect,#preset,#versionsList,#takeEventList";
const copySelector =
  "button,label,summary,option,p,h1,h2,h3,h4,legend,.eyebrow,.rail-label,.clip-scope,.deck-slider span,.export-choice span,.export-choice b,.help-grid span,.command-help,.menu-language span,.versions-head,.export-targets-head,.section-title>span,.audio-head>span,[data-i18n],[data-en][data-es]";
const attributeSelector =
  "[title],[aria-label],[aria-description],[placeholder],[data-help-title],[data-help-body]";
const attributes = [
  "title",
  "aria-label",
  "aria-description",
  "placeholder",
  "data-help-title",
  "data-help-body",
] as const;

/** Invoke after a view renders, or on explicit language change. No mutation observer or re-render. */
export function translateDOM(root: ParentNode = document): void {
  const elements = Array.from(
    root.querySelectorAll<HTMLElement>(`${copySelector},${attributeSelector}`),
  );
  if (
    root instanceof HTMLElement &&
    root.matches(`${copySelector},${attributeSelector}`)
  )
    elements.unshift(root);
  for (const element of elements) {
    if (element.closest(excluded)) continue;
    if (element.dataset.i18n && !element.children.length) {
      const next = t(element.dataset.i18n);
      if (element.textContent !== next) element.textContent = next;
    } else if (
      element.dataset.en !== undefined &&
      element.dataset.es !== undefined &&
      !element.children.length
    ) {
      const next = translate(element.dataset.en, element.dataset.es);
      if (element.textContent !== next) element.textContent = next;
    } else if (element.matches(copySelector)) {
      // Direct text nodes only: translating a label never replaces its input.
      for (const node of Array.from(element.childNodes)) {
        if (node.nodeType !== 3 || !node.nodeValue?.trim()) continue;
        const next = translateText(node.nodeValue);
        if (next !== node.nodeValue) node.nodeValue = next;
      }
    }
    for (const name of attributes) {
      const value = element.getAttribute(name);
      if (!value) continue;
      const next = translateText(value);
      if (next !== value) element.setAttribute(name, next);
    }
  }
}
