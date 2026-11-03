/** Browser-injected scripts share window's error channel with the application. */
export interface PageErrorInput {
  kind: "error" | "rejection";
  message?: string;
  source?: string;
  line?: number;
  column?: number;
  error?: unknown;
}

export interface PageErrorDiagnostic {
  origin: "application" | "browser" | "unattributed";
  kind: PageErrorInput["kind"];
  message: string;
  source: string;
  line: number;
  column: number;
  stack: string;
  timestamp: string;
}

const diagnostics: PageErrorDiagnostic[] = [];
const MAX_DIAGNOSTICS = 30;

function errorText(value: unknown, property: "message" | "stack"): string {
  if (!value || typeof value !== "object") return "";
  try {
    const text = (value as Record<string, unknown>)[property];
    return typeof text === "string" ? text : "";
  } catch {
    return "";
  }
}

function applicationScript(source: string, pageUrl: string): boolean {
  try {
    const url = new URL(source, pageUrl);
    return (
      url.origin === new URL(pageUrl).origin &&
      /\.(?:[cm]?js|tsx?)(?:$|\/)/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function classifyPageError(
  input: PageErrorInput,
  pageUrl: string,
): PageErrorDiagnostic["origin"] {
  const message =
    input.message ||
    errorText(input.error, "message") ||
    String(input.error ?? "");
  const stack = errorText(input.error, "stack");
  // A known application location takes precedence, even if its message quotes a browser callback.
  if (
    (input.source && applicationScript(input.source, pageUrl)) ||
    (stack.match(/https?:\/\/[^\s)]+/g) ?? []).some((source) =>
      applicationScript(source.replace(/:\d+(?::\d+)?$/, ""), pageUrl),
    )
  )
    return "application";

  // Brave iOS retains this Firefox-derived namespace for its native Playlist hooks.
  // Do not create/replace that bridge or ignore unrelated errors mentioning Firefox.
  if (
    /\bwindow\.__firefox__\.playlist(?:LongPressed|ProcessDocumentLoad)_[\w-]+\b/.test(
      message,
    )
  )
    return "browser";

  // This redacted cross-origin event contains no evidence that Studio or audio failed.
  // Keep it in the local diagnostic report; a sourced error or rejected promise still surfaces.
  if (
    input.kind === "error" &&
    /^Script error\.?$/i.test(message.trim()) &&
    !input.source &&
    !input.line &&
    !input.column &&
    input.error == null
  )
    return "unattributed";
  return "application";
}

export function recordPageError(
  input: PageErrorInput,
  pageUrl: string,
): PageErrorDiagnostic {
  const entry: PageErrorDiagnostic = {
    origin: classifyPageError(input, pageUrl),
    kind: input.kind,
    message: (
      input.message ||
      errorText(input.error, "message") ||
      String(input.error ?? "Unknown error")
    ).slice(0, 1000),
    source: (input.source || "").slice(0, 1000),
    line: input.line || 0,
    column: input.column || 0,
    stack: errorText(input.error, "stack").slice(0, 4000),
    timestamp: new Date().toISOString(),
  };
  diagnostics.push(entry);
  if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.shift();
  return entry;
}

/** A bounded, local-only report; exporting it remains an explicit user action. */
export function pageErrorDiagnostics(): PageErrorDiagnostic[] {
  return diagnostics.map((entry) => ({ ...entry }));
}
