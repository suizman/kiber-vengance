const $ = (id) => document.getElementById(id);
let token =
  location.hash.slice(1) || sessionStorage.getItem("kv-companion-owner") || "";
if (location.hash) {
  sessionStorage.setItem("kv-companion-owner", token);
  history.replaceState(null, "", location.pathname);
}
let state,
  working = false,
  polling = false,
  language = localStorage.getItem("kv-companion-language") || "en";
const es = {
  title: "Motores vocales locales",
  language: "Idioma",
  intro:
    "Esta aplicación genera audio en tu ordenador. Los modelos se descargan por separado y se conservan al actualizar la aplicación.",
  connect: "Conectar tu estudio",
  pairHelp:
    "Abre Canto de escritorio en el estudio e introduce este código de un solo uso. Conecta únicamente una ventana del estudio que tú hayas abierto.",
  newCode: "Nuevo código",
  openStudio: "Abrir estudio",
  disconnectAll: "Desconectar ventanas vinculadas",
  computer: "Tu ordenador",
  hardwareHelp:
    "La detección es un punto de partida. Cada motor comprueba su runtime antes de usar la GPU. La CPU está disponible como alternativa más lenta.",
  engines: "Instalar motores y modelos",
  runtime: "Perfil de ejecución",
  aceHelp:
    "Crea interpretaciones musicales a partir de letra y estilo. No garantiza reproducir exactamente las notas del piano roll. Pesos: aproximadamente 6,3 GB, más las dependencias.",
  acceptModel: "He revisado la licencia del modelo y quiero descargarlo.",
  installAce: "Instalar ACE-Step y modelo",
  removeModel: "Eliminar modelo",
  diffHelp:
    "Canta notas y letras con un banco vocal ONNX y su vocoder correspondiente. Las voces tienen licencias propias, independientes del motor.",
  installDiff: "Instalar runtime DiffSinger",
  catalog: "Voz opcional",
  readTerms: "Leer condiciones del autor",
  acceptVoice:
    "He revisado las condiciones de la voz y del vocoder y acepto sus restricciones.",
  installVoice: "Descargar voz seleccionada",
  importVoice: "Importar ZIP de tu banco vocal, incluyendo su vocoder",
  voiceName: "Nombre de la voz",
  acceptImport:
    "Tengo permiso para usar este banco vocal y he revisado sus condiciones.",
  import: "Importar banco vocal",
  advanced: "Diagnóstico y reparación de runtimes",
  repairHelp:
    "Reinstalar un runtime conserva bancos vocales, pesos y audio generado. Los controladores gráficos los gestiona tu sistema operativo.",
  engine: "Motor",
  diagnose: "Comprobar / instalar runtime",
  repair: "Reinstalar runtime",
  jobs: "Trabajos",
  jobHelp:
    "Se ejecuta un trabajo pesado cada vez. Cancelar detiene el proceso del motor; el audio terminado se conserva.",
  integrate: "Instalar lanzador de escritorio",
  updates: "Buscar actualizaciones",
  quit: "Cerrar asistente",
};
const en = Object.fromEntries(
  [...document.querySelectorAll("[data-i18n]")].map((el) => [
    el.dataset.i18n,
    el.textContent,
  ]),
);
function L(a, b) {
  return language === "es" ? b : a;
}
function translate() {
  document.documentElement.lang = language;
  document
    .querySelectorAll("[data-i18n]")
    .forEach(
      (el) =>
        (el.textContent =
          (language === "es" ? es : en)[el.dataset.i18n] ||
          en[el.dataset.i18n]),
    );
  $("language").value = language;
}
async function api(path, body, options = {}) {
  const response = await fetch("/api/" + path, {
    ...options,
    ...(body !== undefined
      ? { method: "POST", body: JSON.stringify(body) }
      : {}),
    headers: {
      Authorization: "Bearer " + token,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    let message = "HTTP " + response.status;
    try {
      message = (await response.json()).error || message;
    } catch {}
    throw Error(message);
  }
  return options.binary ? response.blob() : response.json();
}
function notice(value) {
  $("notice").textContent = value;
}
async function act(fn) {
  if (working) return;
  working = true;
  try {
    notice("");
    await fn();
    await refresh();
  } catch (e) {
    notice(String(e));
  } finally {
    working = false;
  }
}
async function submit(kind, payload) {
  return api("jobs", { kind, payload });
}
const profile = () => ({ profile: $("profile").value });
function button(label, fn) {
  const el = document.createElement("button");
  el.textContent = label;
  el.onclick = () => act(fn);
  return el;
}
// Keep cards and action buttons mounted while polling updates progress.
function cards(container, values, create, update) {
  const existing = new Map(
    [...container.children].map((card) => [card.dataset.id, card]),
  );
  values.forEach((value, index) => {
    let card = existing.get(value.id);
    if (!card) {
      card = create(value);
      card.dataset.id = value.id;
    }
    existing.delete(value.id);
    if (container.children[index] !== card)
      container.insertBefore(card, container.children[index] || null);
    update(card, value);
  });
  for (const card of existing.values()) card.remove();
}
function voiceCard(v) {
  const card = document.createElement("div");
  card.className = "job";
  card.append(
    document.createElement("p"),
    button(L("Remove voice", "Eliminar voz"), async () => {
      if (
        confirm(
          L(
            "Remove this downloaded voice? Generated audio is kept.",
            "¿Eliminar esta voz descargada? Se conserva el audio generado.",
          ),
        )
      )
        await submit("remove-model", { model: v.id });
    }),
  );
  return card;
}
function jobCard() {
  const card = document.createElement("div");
  card.className = "job";
  card.tabIndex = -1;
  const title = document.createElement("strong"),
    text = document.createElement("p"),
    progress = document.createElement("progress"),
    actions = document.createElement("div");
  progress.max = 1;
  card.append(title, text, progress, actions);
  return card;
}
function updateJob(card, j) {
  const [title, text, progress, actions] = card.children;
  title.textContent = j.kind + " · " + j.status;
  text.textContent = j.error || j.message;
  const active = ["running", "queued"].includes(j.status);
  progress.hidden = !active;
  progress.setAttribute(
    "aria-label",
    L("Job progress", "Progreso del trabajo"),
  );
  if (j.progress > 0) progress.value = j.progress;
  else progress.removeAttribute("value");
  const signature = j.status + ":" + language + ":" + (j.result?.audioId || "");
  if (card.dataset.actions !== signature) {
    const focused = actions.contains(document.activeElement);
    actions.replaceChildren();
    if (active)
      actions.append(
        button(L("Cancel", "Cancelar"), () =>
          api("jobs/" + j.id + "/cancel", {}),
        ),
      );
    if (j.result?.audioId)
      actions.append(
        button("WAV", async () => {
          const blob = await api("audio/" + j.result.audioId, undefined, {
            binary: true,
          });
          const url = URL.createObjectURL(blob),
            a = document.createElement("a");
          a.href = url;
          a.download = j.result.engine + ".wav";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }),
      );
    card.dataset.actions = signature;
    if (focused)
      (actions.querySelector("button") || card).focus({ preventScroll: true });
  }
}
async function refresh() {
  if (polling) return;
  polling = true;
  try {
    state = await api("status");
    const pair = await api("pairing");
    $("pairCode").textContent = pair.code;
    $("codeExpiry").textContent =
      L("Expires in ", "Caduca en ") +
      Math.ceil(pair.expiresIn / 60) +
      L(" min", " min");
    const h = state.hardware;
    $("hardware").textContent =
      `${h.os} ${h.architecture} · ${h.distribution || ""} · RAM ${h.memoryGB} GB · ${h.gpuDetected} · ${L("Free disk", "Disco libre")}: ${h.freeDiskGB} GB`;
    $("version").textContent = "КИБЕР VENGANCE · " + state.version;
    $("profileHelp").textContent =
      L("Recommended detection: ", "Detección recomendada: ") + h.recommended;
    if (!$("profile").dataset.initialized) {
      $("profile").value = h.recommended;
      $("profile").dataset.initialized = "yes";
    }
    $("aceState").textContent = state.acestep
      ? L("Model downloaded and verified.", "Modelo descargado y verificado.")
      : L("Model not downloaded.", "Modelo sin descargar.");
    if (!$("catalog").options.length)
      state.voiceCatalog.forEach((v) => {
        const o = document.createElement("option");
        o.value = v.id;
        o.textContent = v.name;
        $("catalog").append(o);
      });
    const v = state.voiceCatalog.find((v) => v.id === $("catalog").value);
    if (v) {
      $("voiceTerms").textContent = v.license;
      $("voiceLicense").href = v.licenseUrl;
    }
    $("runtimes").textContent = JSON.stringify(state.runtimes, null, 2);
    cards($("voices"), state.voices, voiceCard, (card, v) => {
      card.firstElementChild.textContent = v.name + " · " + v.license;
      card.querySelector("button").textContent = L(
        "Remove voice",
        "Eliminar voz",
      );
    });
    cards($("jobs"), [...state.jobs].reverse(), jobCard, updateJob);
    $("installAce").disabled = !$("aceTerms").checked;
    $("installVoice").disabled = !$("voiceAccepted").checked;
    $("importVoice").disabled =
      !$("importAccepted").checked || !$("voiceFile").files.length;
  } catch (e) {
    notice(String(e));
  } finally {
    polling = false;
  }
}
$("language").onchange = () => {
  language = $("language").value;
  localStorage.setItem("kv-companion-language", language);
  translate();
  refresh();
};
$("rotate").onclick = () => act(() => api("pairing/rotate", {}));
$("revoke").onclick = () => act(() => api("revoke", {}));
$("openStudio").onclick = () =>
  window.open("https://studio.suizman.org", "_blank", "noopener,noreferrer");
$("aceTerms").onchange =
  $("voiceAccepted").onchange =
  $("importAccepted").onchange =
  $("voiceFile").onchange =
  $("catalog").onchange =
    () => refresh();
$("installAce").onclick = () =>
  act(() =>
    submit("install-acestep", {
      ...profile(),
      licenseAccepted: $("aceTerms").checked,
    }),
  );
$("installDiff").onclick = () =>
  act(() => submit("install-runtime", { ...profile(), engine: "diffsinger" }));
$("installVoice").onclick = () =>
  act(() =>
    submit("install-voice", {
      ...profile(),
      voice: $("catalog").value,
      licenseAccepted: $("voiceAccepted").checked,
    }),
  );
$("removeAce").onclick = () =>
  act(async () => {
    if (
      confirm(
        L(
          "Remove ACE-Step model weights? Your generated audio is kept.",
          "¿Eliminar los pesos de ACE-Step? Se conserva el audio generado.",
        ),
      )
    )
      await submit("remove-model", { model: "acestep" });
  });
$("importVoice").onclick = () =>
  act(async () => {
    const file = $("voiceFile").files[0];
    if (!file || !$("importAccepted").checked)
      throw Error(
        L(
          "Choose a ZIP and review its terms.",
          "Elige un ZIP y revisa sus condiciones.",
        ),
      );
    notice(L("Uploading local voicebank…", "Importando banco vocal local…"));
    const upload = await api("upload", undefined, {
      method: "POST",
      body: file,
      headers: { "Content-Type": "application/zip" },
    });
    await submit("import-voice", {
      ...profile(),
      upload: upload.upload,
      name: $("voiceName").value || file.name.replace(/\.zip$/i, ""),
      licenseAccepted: true,
    });
  });
$("repair").onclick = () =>
  act(() =>
    submit("repair-runtime", {
      ...profile(),
      engine: $("diagnosticEngine").value,
    }),
  );
$("diagnose").onclick = () =>
  act(() =>
    submit("diagnose", { ...profile(), engine: $("diagnosticEngine").value }),
  );
$("integrate").onclick = () =>
  act(async () => {
    const result = await api("integrate", {});
    notice(result.message);
  });
$("updates").onclick = () =>
  act(async () => {
    const result = await api("updates", {});
    alert(
      result.newer
        ? L("A new version is available: ", "Nueva versión disponible: ") +
            result.version
        : L(
            "You have the current published version.",
            "Tienes la versión publicada actual.",
          ),
    );
    if (result.newer) window.open(result.url, "_blank", "noopener,noreferrer");
  });
$("shutdown").onclick = () =>
  act(async () => {
    await api("shutdown", {});
    notice(
      L(
        "Companion stopped. You can close this window.",
        "Asistente detenido. Puedes cerrar esta ventana.",
      ),
    );
  });
translate();
if (!token)
  notice(
    L(
      "Open this window using the installed companion launcher to manage models.",
      "Abre esta ventana desde el lanzador instalado para gestionar modelos.",
    ),
  );
else {
  refresh();
  setInterval(refresh, 2000);
}
