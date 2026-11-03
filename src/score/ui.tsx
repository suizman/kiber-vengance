import { scoreNotice } from "./notices";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { translate as L } from "../ui/i18n";
import { requestFields, requestConfirmation } from "../ui/dialogs";
import { History } from "../state/history";
import { gmManifest } from "../audio/gm-bank";
import { parseScoreFile } from "./jobs";
import { scoreMusicXml } from "./musicxml";
import { validateScore, type ScoreDocument, type ScorePart } from "./model";
import type { InstrumentKind, MeterUnit, Project } from "../model";
import type { ScorePages, PageCrop } from "./pages";
import type { ScoreAudition } from "./audition";
import "./score.css";

export interface ScoreHost {
  insert(score: ScoreDocument, source: File): Promise<void>;
  putAsset(id: string, blob: Blob): Promise<void>;
  getAsset(id: string): Promise<Blob | null>;
  sources(): NonNullable<Project["scoreSources"]>;
  notify(message: string): void;
}
const DRAFT = "score-import-draft-v1",
  SOURCE = "score-import-source-v1";
const kinds: InstrumentKind[] = [
  "gm",
  "lead",
  "guitar",
  "bass",
  "pad",
  "drums",
];
const kindLabel = (kind: InstrumentKind) =>
  ({
    gm: L("Acoustic / General MIDI", "Acústico / General MIDI"),
    lead: "Volt Lead",
    guitar: "Neon Guitar",
    bass: "Iron Bass",
    pad: "Ash Veil",
    drums: "Impact Rig",
  })[kind];
function saveFile(data: Blob, name: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(data);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
const message = (error: unknown) =>
  scoreNotice(error instanceof Error ? error.message : String(error));

export function openScoreImport(host: ScoreHost) {
  const dialog = document.createElement("dialog");
  dialog.id = "scoreImportDialog";
  dialog.className = "studio-dialog score-dialog";
  dialog.setAttribute("aria-labelledby", "score-title");
  const previousFocus = document.activeElement;
  const close = () => {
    dialog.close();
    render(null, dialog);
    dialog.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
      previousFocus.focus();
  };
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  document.body.append(dialog);
  render(<ScoreImporter host={host} close={close} />, dialog);
  dialog.showModal();
}
function ScoreImporter({ host, close }: { host: ScoreHost; close(): void }) {
  const [score, setScore] = useState<ScoreDocument | null>(null),
    [file, setFile] = useState<File | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0),
    [partIndex, setPartIndex] = useState(0),
    [notePage, setNotePage] = useState(0);
  const [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1),
    [pageCount, setPageCount] = useState(0),
    [imageUrl, setImageUrl] = useState("");
  const [crop, setCrop] = useState<PageCrop>({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      rotation: 0,
    }),
    [gpu, setGpu] = useState(false),
    [systems, setSystems] = useState("");
  const [bank, setBank] = useState<Array<{ number: number; name: string }>>([]),
    [notationOpen, setNotationOpen] = useState(false),
    [notationBar, setNotationBar] = useState(1),
    [notationRevision, setNotationRevision] = useState(0);
  const [draft, setDraft] = useState(false),
    [saveStatus, setSaveStatus] = useState("");
  const [listening, setListening] = useState(false);
  const audition = useRef<ScoreAudition | null>(null),
    savedSource = useRef<File | null>(null);
  const stopAudition = () => {
    audition.current?.stop();
    audition.current = null;
    setListening(false);
  };
  const reader = useRef<ScorePages | null>(null),
    controller = useRef<AbortController | null>(null),
    history = useRef(new History<ScoreDocument>(30)),
    notation = useRef<HTMLDivElement>(null),
    disposed = useRef(false),
    draftQueue = useRef(Promise.resolve());
  const section = score?.sections[sectionIndex],
    part = section?.parts[partIndex];
  const setDocument = (next: ScoreDocument) => {
    stopAudition();
    setScore(next);
    setNotationRevision((value) => value + 1);
  };
  const edit = (apply: (next: ScoreDocument) => void) => {
    if (!score) return;
    history.current.push(score);
    const next = structuredClone(score);
    apply(next);
    history.current.finish(next);
    setDocument(next);
  };
  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError("");
    setProgress(null);
    try {
      await action(current.signal);
    } catch (reason) {
      if (!disposed.current) {
        if (current.signal.aborted)
          setStatus(
            L(
              "Cancelled. Completed pages and model downloads are retained.",
              "Cancelado. Se conservan las páginas terminadas y la descarga del modelo.",
            ),
          );
        else setError(message(reason));
      }
    } finally {
      if (!disposed.current && controller.current === current) {
        setBusy(false);
        setProgress(null);
        controller.current = null;
      }
    }
  };
  useEffect(() => {
    void gmManifest().then(
      (value) => setBank(value.programs),
      () => {},
    );
    void host.getAsset(DRAFT).then(
      (value) => setDraft(!!value),
      () => {},
    );
    return () => {
      disposed.current = true;
      audition.current?.stop();
      controller.current?.abort();
      reader.current?.close();
    };
  }, []);
  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );
  useEffect(() => {
    if (!score || !file) return;
    const timer = setTimeout(() => {
      const metadata = new Blob(
        [
          JSON.stringify({
            score,
            fileName: file.name,
            fileType: file.type,
            pageNumber,
            crop,
          }),
        ],
        { type: "application/json" },
      );
      draftQueue.current = draftQueue.current
        .catch(() => {})
        .then(async () => {
          if (savedSource.current !== file) {
            await host.putAsset(SOURCE, file);
            savedSource.current = file;
          }
          await host.putAsset(DRAFT, metadata);
          if (!disposed.current) {
            setDraft(true);
            setSaveStatus(
              L(
                "Review saved on this device",
                "Revisión guardada en este dispositivo",
              ),
            );
          }
        })
        .catch((reason) => {
          if (!disposed.current)
            setSaveStatus(
              L(
                "Review could not be saved: ",
                "No se pudo guardar la revisión: ",
              ) + message(reason),
            );
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [score, file, pageNumber, crop]);
  useEffect(() => {
    if (!notationOpen || !notation.current || !score) return;
    let cancelled = false,
      destroy: (() => void) | undefined;
    const element = notation.current;
    element.textContent = L("Rendering notation…", "Dibujando partitura…");
    void import("./notation")
      .then((module) => {
        if (!cancelled) {
          element.textContent = "";
          destroy = module.showNotation(
            element,
            score,
            sectionIndex,
            partIndex,
            notationBar,
          );
        }
      })
      .catch((reason) => {
        if (!cancelled) element.textContent = message(reason);
      });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [notationOpen, notationRevision, sectionIndex, partIndex, notationBar]);

  const preparePages = async (source: File, signal: AbortSignal) => {
    reader.current?.close();
    const { ScorePages } = await import("./pages");
    const pages = new ScorePages(source);
    reader.current = pages;
    await pages.open(signal);
    setPageCount(pages.count);
  };
  const load = (source: File) =>
    void run(async (signal) => {
      if (source.size > 32 * 1024 * 1024)
        throw new Error(
          L(
            "Files are limited to 32 MiB. Split or compress this file.",
            "El límite es 32 MiB. Divide o comprime el archivo.",
          ),
        );
      setFile(source);
      setScore(null);
      setSectionIndex(0);
      setPartIndex(0);
      setNotePage(0);
      setPageCount(0);
      setPageNumber(1);
      setImageUrl("");
      history.current = new History(30);
      setStatus(L("Reading locally…", "Leyendo en tu dispositivo…"));
      if (/\.(pdf|png|jpe?g)$/i.test(source.name)) {
        await preparePages(source, signal);
        setStatus(
          L(
            "Preview the page, then download the local reader when ready.",
            "Previsualiza la página y descarga el lector local cuando esté lista.",
          ),
        );
      } else {
        const parsed = await parseScoreFile(source, source.name, signal);
        signal.throwIfAborted();
        setDocument(parsed);
        setStatus(
          L(
            "Ready to review. Nothing has been added to the project.",
            "Lista para revisar. Todavía no se ha añadido al proyecto.",
          ),
        );
      }
    });
  const preview = () =>
    void run(async (signal) => {
      if (!reader.current) return;
      const image = await reader.current.image(pageNumber, crop, signal);
      signal.throwIfAborted();
      setImageUrl(URL.createObjectURL(image));
    });
  const recognize = () =>
    void run(async (signal) => {
      if (!reader.current || !file) return;
      let systemRanges: string | undefined;
      if (systems.trim()) {
        const values = systems
          .split(";")
          .map((pair) => pair.split(",").map(Number));
        if (
          !values.every(
            (pair) =>
              pair.length === 2 &&
              pair.every(Number.isFinite) &&
              pair[0]! >= 0 &&
              pair[1]! > pair[0]!,
          )
        )
          throw new Error(
            L(
              "Use top,bottom pixel pairs separated by semicolons.",
              "Usa pares superior,inferior en píxeles separados por punto y coma.",
            ),
          );
        systemRanges = JSON.stringify(values);
      }
      const image = await reader.current.image(pageNumber, crop, signal);
      setImageUrl(URL.createObjectURL(image));
      setStatus(
        L(
          "Preparing the local reader (150.2 MiB)…",
          "Preparando el lector local (150,2 MiB)…",
        ),
      );
      const { recognizePage } = await import("./omr");
      const result = await recognizePage(
        image,
        signal,
        (event) => {
          if (event.stage === "download") {
            setProgress((event.loaded || 0) / (event.total || 1));
            setStatus(
              L(
                "Downloading / checking local models",
                "Descargando / comprobando modelos locales",
              ),
            );
          } else {
            setProgress(
              event.stage === "segment"
                ? (event.loaded || 0) / (event.total || 1)
                : null,
            );
            setStatus(
              event.stage === "staff"
                ? L(
                    `Reading staff ${event.staff}…`,
                    `Leyendo pentagrama ${event.staff}…`,
                  )
                : event.stage === "retry"
                  ? L("Retrying download…", "Reintentando descarga…")
                  : L(
                      "Finding notes and staves…",
                      "Localizando notas y pentagramas…",
                    ),
            );
          }
        },
        { gpu, ...(systemRanges ? { systems: systemRanges } : {}) },
      );
      const parsed = await parseScoreFile(
        new Blob([result.xml]),
        `${file.name} · ${pageNumber}.musicxml`,
        signal,
      );
      signal.throwIfAborted();
      parsed.format = "PDF / image · homr";
      parsed.sourceName = file.name;
      parsed.sourcePage = pageNumber;
      parsed.sections[0]!.id = `page-${pageNumber}`;
      parsed.sections[0]!.title = `${file.name} · ${L("Page", "Página")} ${pageNumber}`;
      parsed.warnings.push(
        ...result.warnings,
        L(
          "Recognition can merge staves and misread pitches, rhythms, repeats or text. Review each part; unknown instruments use piano. Pages are inserted in page order as sections.",
          "El reconocimiento puede unir pentagramas o interpretar mal alturas, ritmos, repeticiones y texto. Revisa las partes; los instrumentos sin identificar usan piano. Las páginas se insertan por orden como secciones.",
        ),
      );
      if (score) {
        const next = structuredClone(score),
          prior = next.sections.findIndex(
            (item) => item.id === `page-${pageNumber}`,
          );
        if (prior >= 0) next.sections[prior] = parsed.sections[0]!;
        else next.sections.push(parsed.sections[0]!);
        next.sections.sort(
          (a, b) =>
            Number(a.id.split("-").at(-1)) - Number(b.id.split("-").at(-1)),
        );
        next.warnings = [...new Set([...next.warnings, ...parsed.warnings])];
        history.current.push(score);
        history.current.finish(next);
        setDocument(next);
        setSectionIndex(
          next.sections.findIndex((item) => item.id === `page-${pageNumber}`),
        );
      } else {
        setDocument(parsed);
        setSectionIndex(0);
      }
      setPartIndex(0);
      setNotePage(0);
      setStatus(
        L(
          "Page ready. Review it before continuing with the next page.",
          "Página lista. Revísala antes de continuar con la siguiente.",
        ),
      );
    });
  const resume = () =>
    void run(async (signal) => {
      const [metadata, binary] = await Promise.all([
        host.getAsset(DRAFT),
        host.getAsset(SOURCE),
      ]);
      if (!metadata || !binary)
        throw new Error(
          L("The saved source is missing.", "Falta el original guardado."),
        );
      const saved = JSON.parse(await metadata.text()) as {
        score: ScoreDocument;
        fileName: string;
        fileType: string;
        pageNumber: number;
        crop: PageCrop;
      };
      validateScore(saved.score);
      const source = new File([binary], saved.fileName, {
        type: saved.fileType,
      });
      setFile(source);
      setDocument(saved.score);
      setPageNumber(saved.pageNumber);
      setCrop(saved.crop);
      setSectionIndex(0);
      setPartIndex(0);
      if (/\.(pdf|png|jpe?g)$/i.test(source.name))
        await preparePages(source, signal);
    });
  const restoreSource = (id: string) =>
    void run(async (signal) => {
      const source = host.sources().find((item) => item.id === id);
      if (!source?.reviewAssetId) return;
      const [review, binary] = await Promise.all([
        host.getAsset(source.reviewAssetId),
        host.getAsset(source.assetId),
      ]);
      if (!review || !binary)
        throw new Error(
          L(
            "The review or source asset is missing. Import its Project Package.",
            "Falta la revisión o el original. Importa su Project Package.",
          ),
        );
      const document = validateScore(
        JSON.parse(await review.text()) as ScoreDocument,
      );
      const original = new File([binary], source.name, {
        type: source.mimeType || binary.type,
      });
      setFile(original);
      setDocument(document);
      setSectionIndex(0);
      setPartIndex(0);
      setNotePage(0);
      setPageCount(0);
      if (/\.(pdf|png|jpe?g)$/i.test(original.name))
        await preparePages(original, signal);
    });
  const editPart = (action: (part: ScorePart) => void) =>
    edit((next) => action(next.sections[sectionIndex]!.parts[partIndex]!));
  const editNote = (
    id: string,
    field: "pitch" | "step" | "length" | "velocity" | "staff" | "voice",
    value: string,
  ) =>
    editPart((current) => {
      const note = current.notes.find((note) => note.id === id)!;
      if (field === "voice") note.voice = value || "1";
      else {
        const number = Number(value);
        if (!Number.isFinite(number)) return;
        note[field] =
          field === "pitch"
            ? Math.max(0, Math.min(127, Math.round(number)))
            : field === "velocity"
              ? Math.max(0.01, Math.min(1, number / 100))
              : field === "staff"
                ? Math.max(1, Math.min(current.staves, Math.round(number)))
                : Math.max(field === "length" ? 0.001 : 0, number * 4);
      }
    });
  const split = () =>
    edit((next) => {
      const parts = next.sections[sectionIndex]!.parts,
        selected = parts[partIndex]!;
      parts.splice(
        partIndex,
        1,
        ...Array.from({ length: selected.staves }, (_, index) => ({
          ...selected,
          id: `${selected.id}-staff-${index + 1}`,
          name: `${selected.name} · ${index + 1}`,
          staves: 1,
          notes: selected.notes
            .filter((note) => note.staff === index + 1)
            .map((note) => ({ ...note, staff: 1 })),
        })),
      );
    });
  const merge = async () => {
    if (!section || !part) return;
    const values = await requestFields({
      title: L("Merge parts", "Unir partes"),
      fields: [
        {
          name: "target",
          label: L("Destination", "Destino"),
          type: "select",
          options: section.parts
            .filter((item) => item !== part)
            .map((item) => ({ value: item.id, label: item.name })),
        },
      ],
    });
    if (!values) return;
    edit((next) => {
      const parts = next.sections[sectionIndex]!.parts,
        source = parts[partIndex]!,
        target = parts.find((item) => item.id === values.target)!;
      target.notes.push(
        ...source.notes.map((note) => ({
          ...note,
          staff: note.staff + target.staves,
        })),
      );
      target.staves += source.staves;
      parts.splice(partIndex, 1);
    });
    setPartIndex(0);
  };
  const listen = () =>
    void run(async (signal) => {
      if (!score) return;
      stopAudition();
      setStatus(
        L(
          "Preparing instrument preview…",
          "Preparando escucha del instrumento…",
        ),
      );
      const { ScoreAudition } = await import("./audition");
      signal.throwIfAborted();
      const player = new ScoreAudition();
      audition.current = player;
      await player.play(score, sectionIndex, partIndex, signal, () => {
        if (!disposed.current) setListening(false);
      });
      signal.throwIfAborted();
      setListening(true);
      setStatus(
        L(
          "Playing the selected part (up to 30 seconds)",
          "Escuchando la parte seleccionada (hasta 30 segundos)",
        ),
      );
    });
  const insert = () =>
    void run(async (signal) => {
      if (!score || !file) return;
      validateScore(score);
      signal.throwIfAborted();
      stopAudition();
      await host.insert(score, file);
      host.notify(
        L(
          "Score inserted. Undo restores the previous project.",
          "Partitura insertada. Deshacer restaura el proyecto anterior.",
        ),
      );
      close();
    });
  return (
    <>
      <header class="score-head">
        <div>
          <span class="eyebrow">SCORE LAB</span>
          <h2 id="score-title">
            {L("From score to sound", "De la partitura al sonido")}
          </h2>
          <p>
            {L(
              "Import, review every part, then add it to your arrangement.",
              "Importa, revisa cada parte y añádela a tu arreglo.",
            )}
          </p>
        </div>
        <button
          onClick={close}
          aria-label={L("Close score import", "Cerrar importación")}
        >
          ×
        </button>
      </header>
      <div class="score-tools">
        <label class="file-button">
          {L("Choose score", "Elegir partitura")}
          <input
            id="scoreFile"
            type="file"
            accept=".musicxml,.xml,.mxl,.mid,.midi,.gp,.gp3,.gp4,.gp5,.gpx,.gp7,.gp8,.abc,.pdf,.png,.jpg,.jpeg"
            disabled={busy}
            onChange={(event) => {
              const source = event.currentTarget.files?.[0];
              if (source) load(source);
            }}
          />
        </label>
        {draft && (
          <button disabled={busy} onClick={resume}>
            {L("Resume saved review", "Continuar revisión guardada")}
          </button>
        )}
        {host.sources().length > 0 && (
          <label>
            {L("Project sources", "Originales del proyecto")}
            <select
              value=""
              disabled={busy}
              onChange={(event) => {
                if (event.currentTarget.value)
                  restoreSource(event.currentTarget.value);
              }}
            >
              <option value="">{L("Open…", "Abrir…")}</option>
              {host.sources().map((item) => (
                <option value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        )}
        {file && (
          <button onClick={() => saveFile(file, file.name)}>
            {L("Download original", "Descargar original")}
          </button>
        )}
      </div>
      <p class="score-help">
        MusicXML / MXL · MIDI · Guitar Pro 3–8 · ABC · PDF · PNG / JPEG.{" "}
        {L(
          "For MuseScore, Sibelius, Finale, Dorico or Noteflight, export MusicXML. PDF recognition runs locally and requires an optional 150.2 MiB model download. Printed notation works best; handwriting and complex layouts need corrections.",
          "Desde MuseScore, Sibelius, Finale, Dorico o Noteflight, exporta MusicXML. El reconocimiento de PDF es local y requiere una descarga opcional de 150,2 MiB. Funciona mejor con notación impresa; los manuscritos y diseños complejos requieren correcciones.",
        )}
      </p>
      {pageCount > 0 && (
        <section class="score-page-tools">
          <h3>{L("Source page", "Página original")}</h3>
          <div class="score-tools">
            <label>
              {L("Page", "Página")}
              <input
                type="number"
                min={1}
                max={pageCount}
                value={pageNumber}
                disabled={busy}
                onChange={(event) =>
                  setPageNumber(
                    Math.max(
                      1,
                      Math.min(pageCount, +event.currentTarget.value),
                    ),
                  )
                }
              />
            </label>
            <span>/ {pageCount}</span>
            <label>
              {L("Rotation", "Rotación")}
              <select
                value={crop.rotation}
                disabled={busy}
                onChange={(event) =>
                  setCrop({ ...crop, rotation: +event.currentTarget.value })
                }
              >
                {[0, 90, 180, 270].map((value) => (
                  <option value={value}>{value}°</option>
                ))}
              </select>
            </label>
            <button disabled={busy} onClick={preview}>
              {L("Preview crop", "Ver recorte")}
            </button>
            <button
              id="recognizeScore"
              class="primary"
              disabled={busy}
              onClick={recognize}
            >
              {L(
                "Download reader & recognize this page",
                "Descargar lector y reconocer esta página",
              )}
            </button>
            <button
              disabled={busy || pageNumber >= pageCount}
              onClick={() => setPageNumber(pageNumber + 1)}
            >
              {L("Next page", "Página siguiente")}
            </button>
          </div>
          <details>
            <summary>
              {L(
                "Crop, staff grouping & acceleration",
                "Recorte, agrupación y aceleración",
              )}
            </summary>
            <div class="score-tools">
              {(["left", "top", "right", "bottom"] as const).map(
                (key, index) => (
                  <label>
                    {
                      [
                        L("Left %", "Izquierda %"),
                        L("Top %", "Arriba %"),
                        L("Right %", "Derecha %"),
                        L("Bottom %", "Abajo %"),
                      ][index]
                    }
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={crop[key]}
                      onChange={(event) =>
                        setCrop({
                          ...crop,
                          [key]: Math.max(
                            0,
                            Math.min(100, +event.currentTarget.value),
                          ),
                        })
                      }
                    />
                  </label>
                ),
              )}
            </div>
            <label>
              {L(
                "System ranges in cropped-image pixels (optional: 30,250;300,520)",
                "Rangos de sistemas en píxeles del recorte (opcional: 30,250;300,520)",
              )}
              <input
                value={systems}
                onChange={(event) => setSystems(event.currentTarget.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={gpu}
                onChange={(event) => setGpu(event.currentTarget.checked)}
              />
              {L(
                "Try desktop WebGPU; phones always use CPU",
                "Probar WebGPU en escritorio; el móvil siempre usa CPU",
              )}
            </label>
          </details>
          <a href="./omr/SOURCE.md" target="_blank" rel="noreferrer">
            {L("Reader source & licenses", "Código y licencias del lector")}
          </a>
          <button
            disabled={busy}
            onClick={async () => {
              if (
                await requestConfirmation(
                  L("Remove downloaded reader", "Eliminar lector descargado"),
                  L(
                    "Remove only the OMR model cache? Projects and source scores stay saved.",
                    "¿Eliminar solo la caché del modelo OMR? Se conservan proyectos y partituras.",
                  ),
                )
              ) {
                const { OMR_CACHE } = await import("./omr");
                await caches.delete(OMR_CACHE);
                setStatus(
                  L("Reader cache removed", "Caché del lector eliminada"),
                );
              }
            }}
          >
            {L("Remove reader cache", "Eliminar caché del lector")}
          </button>
        </section>
      )}
      {(status || busy) && (
        <div class="score-status" role="status">
          <span>{status}</span>
          {progress !== null && <progress value={progress} max={1} />}
          {busy && (
            <button onClick={() => controller.current?.abort()}>
              {L("Cancel", "Cancelar")}
            </button>
          )}
        </div>
      )}
      {error && (
        <p class="score-error" role="alert">
          {error}
        </p>
      )}
      {imageUrl && (
        <details open={!score}>
          <summary>
            {L("Original page preview", "Vista de la página original")}
          </summary>
          <img
            class="score-source-image"
            src={imageUrl}
            alt={L("Original score page", "Página original de la partitura")}
          />
        </details>
      )}
      {score && section && part && (
        <fieldset class="score-review" disabled={busy}>
          <div class="score-tools">
            <label>
              {L("Section / page", "Sección / página")}
              <select
                id="scoreSection"
                value={sectionIndex}
                onChange={(event) => {
                  stopAudition();
                  setSectionIndex(+event.currentTarget.value);
                  setPartIndex(0);
                  setNotePage(0);
                  setNotationBar(1);
                }}
              >
                {score.sections.map((item, index) => (
                  <option value={index}>{item.title}</option>
                ))}
              </select>
            </label>
            <label>
              {L("Part", "Parte")}
              <select
                id="scorePart"
                value={partIndex}
                onChange={(event) => {
                  stopAudition();
                  setPartIndex(+event.currentTarget.value);
                  setNotePage(0);
                }}
              >
                {section.parts.map((item, index) => (
                  <option value={index}>
                    {item.name} · {item.notes.length} {L("notes", "notas")}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                const previous = history.current.undo(score);
                if (previous) {
                  setDocument(previous);
                  setPartIndex(0);
                  setSectionIndex(0);
                }
              }}
            >
              {L("Undo review edit", "Deshacer edición")}
            </button>
            <button
              onClick={() => {
                const next = history.current.redo(score);
                if (next) {
                  setDocument(next);
                  setPartIndex(0);
                  setSectionIndex(0);
                }
              }}
            >
              {L("Redo", "Rehacer")}
            </button>
          </div>
          <div class="score-tools">
            <label>
              {L(
                "Part name / page matching",
                "Nombre / correspondencia entre páginas",
              )}
              <input
                id="scorePartName"
                value={part.name}
                maxLength={120}
                onChange={(event) =>
                  editPart((current) => {
                    current.name = event.currentTarget.value || "Part";
                  })
                }
              />
            </label>
            <label>
              {L("Sound", "Sonido")}
              <select
                value={part.kind}
                onChange={(event) =>
                  editPart((current) => {
                    current.kind = event.currentTarget.value as InstrumentKind;
                  })
                }
              >
                {kinds.map((kind) => (
                  <option value={kind}>{kindLabel(kind)}</option>
                ))}
              </select>
            </label>
            {part.kind === "gm" && (
              <>
                <label>
                  {L("Instrument", "Instrumento")}
                  <select
                    id="scoreInstrument"
                    value={part.program}
                    onChange={(event) =>
                      editPart((current) => {
                        current.program = +event.currentTarget.value;
                      })
                    }
                  >
                    {bank.length ? (
                      bank.map((item) => (
                        <option value={item.number}>
                          {item.number + 1}. {item.name}
                        </option>
                      ))
                    ) : (
                      <option value={part.program}>
                        GM {part.program + 1}
                      </option>
                    )}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={part.percussion}
                    onChange={(event) =>
                      editPart((current) => {
                        current.percussion = event.currentTarget.checked;
                      })
                    }
                  />
                  {L("GM percussion", "Percusión GM")}
                </label>
              </>
            )}
            {part.staves > 1 && (
              <button onClick={split}>
                {L(
                  "Separate staves into parts",
                  "Separar pentagramas en partes",
                )}
              </button>
            )}
            {section.parts.length > 1 && (
              <button onClick={() => void merge()}>
                {L("Merge with another part", "Unir con otra parte")}
              </button>
            )}
          </div>
          <p class="score-help">
            {L(
              "Parts with the same name, instrument and source identity on successive pages share a studio track. Every staff and voice is retained. Timing below is in quarter-note beats.",
              "Las partes con el mismo nombre, instrumento e identidad en páginas sucesivas comparten pista. Se conserva cada pentagrama y voz. Los tiempos se muestran en negras.",
            )}
          </p>
          <div class="score-tools">
            <button
              id="scoreListen"
              onClick={listening ? stopAudition : listen}
            >
              {listening
                ? L("Stop preview", "Detener escucha")
                : L("Listen to this part", "Escuchar esta parte")}
            </button>
            <button
              onClick={() =>
                editPart((current) => {
                  for (const note of current.notes)
                    note.pitch = Math.min(127, note.pitch + 1);
                })
              }
            >
              {L("Transpose +1", "Transportar +1")}
            </button>
            <button
              onClick={() =>
                editPart((current) => {
                  for (const note of current.notes)
                    note.pitch = Math.max(0, note.pitch - 1);
                })
              }
            >
              {L("Transpose −1", "Transportar −1")}
            </button>
            <button
              onClick={() =>
                edit((next) => {
                  const current = next.sections[sectionIndex]!,
                    target = current.parts[partIndex]!;
                  const start = target.notes.reduce(
                    (end, note) => Math.max(end, note.step + note.length),
                    0,
                  );
                  target.notes.push({
                    id: crypto.randomUUID(),
                    step: start,
                    length: 4,
                    pitch: 60,
                    velocity: 0.8,
                    staff: 1,
                    voice: "1",
                  });
                  current.durationSteps = Math.max(
                    current.durationSteps,
                    start + 4,
                  );
                })
              }
            >
              {L("Add note", "Añadir nota")}
            </button>
            <button
              aria-expanded={notationOpen}
              onClick={() => setNotationOpen(!notationOpen)}
            >
              {L("Notation preview", "Ver notación")}
            </button>
            <button
              onClick={() =>
                saveFile(
                  new Blob([scoreMusicXml(score, sectionIndex)], {
                    type: "application/vnd.recordare.musicxml+xml",
                  }),
                  `${section.title}.musicxml`,
                )
              }
            >
              {L("Export corrected MusicXML", "Exportar MusicXML corregido")}
            </button>
          </div>
          {notationOpen && (
            <>
              <div class="score-tools">
                <label>
                  {L("First bar (8 per view)", "Primer compás (8 por vista)")}
                  <input
                    type="number"
                    min={1}
                    value={notationBar}
                    onChange={(event) =>
                      setNotationBar(Math.max(1, +event.currentTarget.value))
                    }
                  />
                </label>
              </div>
              <div
                class="score-notation"
                ref={notation}
                tabIndex={0}
                role="region"
                aria-label={L("Score notation", "Notación musical")}
              />
            </>
          )}
          <div class="score-note-scroll">
            <table class="score-notes">
              <thead>
                <tr>
                  {[
                    L("Pitch (MIDI)", "Altura (MIDI)"),
                    L("Start", "Inicio"),
                    L("Length", "Duración"),
                    L("Velocity %", "Intensidad %"),
                    L("Staff", "Pentagrama"),
                    L("Voice", "Voz"),
                    L("Remove", "Eliminar"),
                  ].map((label) => (
                    <th scope="col">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {part.notes
                  .slice(notePage * 50, notePage * 50 + 50)
                  .map((note) => (
                    <tr key={note.id}>
                      {(
                        [
                          "pitch",
                          "step",
                          "length",
                          "velocity",
                          "staff",
                          "voice",
                        ] as const
                      ).map((field) => (
                        <td>
                          <input
                            aria-label={`${field} ${note.id}`}
                            {...(field === "voice"
                              ? { type: "text" as const }
                              : {
                                  type: "number" as const,
                                  step:
                                    field === "step" || field === "length"
                                      ? "any"
                                      : 1,
                                })}
                            value={
                              field === "step" || field === "length"
                                ? +(note[field] / 4).toFixed(6)
                                : field === "velocity"
                                  ? Math.round(note.velocity * 100)
                                  : note[field]
                            }
                            onChange={(event) =>
                              editNote(
                                note.id,
                                field,
                                event.currentTarget.value,
                              )
                            }
                          />
                        </td>
                      ))}
                      <td>
                        <button
                          aria-label={L("Remove note", "Eliminar nota")}
                          onClick={() =>
                            editPart((current) => {
                              current.notes = current.notes.filter(
                                (item) => item.id !== note.id,
                              );
                            })
                          }
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div class="score-tools">
            <button
              disabled={notePage === 0}
              onClick={() => setNotePage(notePage - 1)}
            >
              {L("Previous notes", "Notas anteriores")}
            </button>
            <span>
              {notePage * 50 + 1}–
              {Math.min(part.notes.length, notePage * 50 + 50)} /{" "}
              {part.notes.length}
            </span>
            <button
              disabled={(notePage + 1) * 50 >= part.notes.length}
              onClick={() => setNotePage(notePage + 1)}
            >
              {L("Next notes", "Siguientes notas")}
            </button>
          </div>
          <details>
            <summary>
              {L("Tempo & meter review", "Revisar tempo y compás")}
            </summary>
            <div class="score-map">
              {section.tempos.map((tempo, index) => (
                <label>
                  {L("Beat", "Negra")} {+(tempo.step / 4).toFixed(3)} · BPM{" "}
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={tempo.bpm}
                    onChange={(event) =>
                      edit((next) => {
                        next.sections[sectionIndex]!.tempos[index]!.bpm =
                          Math.max(
                            10,
                            Math.min(500, +event.currentTarget.value),
                          );
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <div class="score-map">
              {section.meters.map((meter, index) => (
                <div class="score-tools">
                  <label>
                    {L("Start beat", "Negra inicial")}
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={meter.step / 4}
                      onChange={(event) =>
                        edit((next) => {
                          next.sections[sectionIndex]!.meters[index]!.step =
                            Math.max(0, +event.currentTarget.value * 4);
                          next.sections[sectionIndex]!.meters.sort(
                            (a, b) => a.step - b.step,
                          );
                        })
                      }
                    />
                  </label>
                  <label>
                    {L("Beats per bar", "Pulsos por compás")}
                    <input
                      type="number"
                      min={1}
                      max={32}
                      value={meter.beats}
                      onChange={(event) =>
                        edit((next) => {
                          next.sections[sectionIndex]!.meters[index]!.beats =
                            Math.max(
                              1,
                              Math.min(
                                32,
                                Math.round(+event.currentTarget.value),
                              ),
                            );
                        })
                      }
                    />
                  </label>
                  <label>
                    {L("Beat unit", "Unidad de pulso")}
                    <select
                      value={meter.unit}
                      onChange={(event) =>
                        edit((next) => {
                          next.sections[sectionIndex]!.meters[index]!.unit =
                            +event.currentTarget.value as MeterUnit;
                        })
                      }
                    >
                      {[1, 2, 4, 8, 16, 32, 64].map((unit) => (
                        <option value={unit}>{unit}</option>
                      ))}
                    </select>
                  </label>
                  {index > 0 && (
                    <button
                      onClick={() =>
                        edit((next) => {
                          next.sections[sectionIndex]!.meters.splice(index, 1);
                        })
                      }
                    >
                      {L("Remove meter change", "Eliminar cambio de compás")}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() =>
                edit((next) => {
                  const meters = next.sections[sectionIndex]!.meters;
                  const previous = meters.at(-1) || {
                    step: 0,
                    beats: 4,
                    unit: 4 as const,
                  };
                  meters.push({
                    ...previous,
                    step: previous.step + (previous.beats * 16) / previous.unit,
                  });
                })
              }
            >
              {L("Add meter change", "Añadir cambio de compás")}
            </button>
          </details>
          {score.warnings.length > 0 && (
            <details open>
              <summary>
                {L("Review notices", "Avisos para la revisión")} (
                {score.warnings.length})
              </summary>
              <ul>
                {score.warnings.map((warning) => (
                  <li>{scoreNotice(warning)}</li>
                ))}
              </ul>
            </details>
          )}
          <footer class="score-footer">
            <span>
              {score.sections.reduce(
                (sum, item) =>
                  sum +
                  item.parts.reduce(
                    (count, part) => count + part.notes.length,
                    0,
                  ),
                0,
              )}{" "}
              {L("notes retained", "notas conservadas")} · {saveStatus}
            </span>
            <button id="insertScore" class="primary" onClick={insert}>
              {L(
                "Insert all reviewed sections",
                "Insertar todas las secciones revisadas",
              )}
            </button>
          </footer>
        </fieldset>
      )}
    </>
  );
}
