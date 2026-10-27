import { renderDeck, bindDeck } from "./deck-controller";
import type { DeckMixerContext } from "../state/contracts";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function setupDualDeck(ctx: DeckMixerContext) {
  const primary = ctx.$(".scratch-deck") as HTMLElement;
  const layout = document.createElement("div");
  layout.className = "dual-deck-layout";
  primary.before(layout);
  layout.append(primary);
  primary.dataset.deck = "A";
  primary
    .querySelector(".scratch-head > div")
    ?.insertAdjacentHTML("afterbegin", '<span class="deck-letter">A</span>');

  const mixer = document.createElement("div");
  mixer.className = "dual-deck-mixer";
  mixer.innerHTML = `<span data-en="DECK A" data-es="PLATO A">DECK A</span><label><span data-en="CROSSFADER" data-es="CROSSFADER">CROSSFADER</span><input id="scratchCrossfader" type="range" min="0" max="1" step=".01" value="0" aria-label="Deck A to Deck B crossfader"><output id="scratchCrossfadeValue">A 100% · B 0%</output></label><span data-en="DECK B" data-es="PLATO B">DECK B</span><div class="deck-cue-controls"><button id="deckCueOutput" data-en="CHOOSE HEADPHONES" data-es="ELEGIR AURICULARES">CHOOSE HEADPHONES</button><button id="deckACue" aria-pressed="false" disabled>CUE A</button><button id="deckBCue" aria-pressed="false" disabled>CUE B</button><small id="deckCueHelp" data-en="Cue needs a separate audio output supported by this browser." data-es="Cue necesita una salida de audio independiente compatible con este navegador.">Cue needs a separate audio output supported by this browser.</small></div>`;
  const programBlend = primary.querySelector<HTMLElement>(".crossfader")!;
  mixer.append(programBlend);
  layout.before(mixer);
  const crossfader =
    mixer.querySelector<HTMLInputElement>("#scratchCrossfader")!;
  const cueOutput = mixer.querySelector<HTMLButtonElement>("#deckCueOutput")!;
  const cueA = mixer.querySelector<HTMLButtonElement>("#deckACue")!;
  const cueB = mixer.querySelector<HTMLButtonElement>("#deckBCue")!;
  const cueHelp = mixer.querySelector<HTMLElement>("#deckCueHelp")!;
  const outputApi = navigator.mediaDevices as MediaDevices & {
    selectAudioOutput?: () => Promise<MediaDeviceInfo>;
  };
  const supportsCue = Boolean(
    outputApi?.selectAudioOutput &&
    (
      HTMLMediaElement.prototype as HTMLMediaElement & {
        setSinkId?: (id: string) => Promise<void>;
      }
    ).setSinkId,
  );
  let cuePlayer: HTMLAudioElement | null = null;
  let cued: "A" | "B" | null = null;
  const showCue = () => {
    cueA.setAttribute("aria-pressed", String(cued === "A"));
    cueB.setAttribute("aria-pressed", String(cued === "B"));
  };
  const cue = (deck: "A" | "B") => {
    cued = cued === deck ? null : deck;
    ctx.engine.setScratchCue(cued);
    showCue();
  };
  cueA.onclick = () => cue("A");
  cueB.onclick = () => cue("B");
  primary.addEventListener("scratcharmed", () => {
    if (cuePlayer) cueA.disabled = false;
  });
  window.addEventListener("pagehide", () => {
    ctx.engine.setScratchCue(null);
    cuePlayer?.pause();
  });
  if (!supportsCue) {
    cueOutput.disabled = true;
    cueOutput.title = ctx.L(
      "This browser cannot route Cue to separate headphones.",
      "Este navegador no permite enviar Cue a otros auriculares.",
    );
  } else
    cueOutput.onclick = async () => {
      cueOutput.disabled = true;
      try {
        const initialized = ctx.engine.init();
        void initialized.catch(() => {});
        const device = await outputApi.selectAudioOutput!();
        await initialized;
        const player = cuePlayer ?? new Audio();
        player.srcObject = ctx.engine.scratchCueDestination.stream;
        await (
          player as HTMLAudioElement & {
            setSinkId: (id: string) => Promise<void>;
          }
        ).setSinkId(device.deviceId);
        await player.play();
        cuePlayer = player;
        cueA.disabled = !ctx.scratchBuffer;
        cueB.disabled = !ctx.engine.deck("B").ready;
        cueHelp.dataset.en =
          "Cue routes only to the chosen headphones; it is excluded from the master recording.";
        cueHelp.dataset.es =
          "Cue sale solo por los auriculares elegidos y queda fuera de la grabación master.";
        cueHelp.textContent = ctx.L(cueHelp.dataset.en, cueHelp.dataset.es);
      } catch (error) {
        ctx.toast(
          `${ctx.L("Cue output unavailable", "Salida Cue no disponible")}: ${String(error)}`,
        );
      } finally {
        cueOutput.disabled = false;
      }
    };
  crossfader.oninput = () => {
    const value = +crossfader.value;
    ctx.engine.setScratchCrossfade(value);
    mixer.querySelector("output")!.textContent =
      `A ${Math.round(100 * Math.cos((value * Math.PI) / 2))}% · B ${Math.round(100 * Math.sin((value * Math.PI) / 2))}%`;
  };

  const blend = mixer.querySelector<HTMLInputElement>("#scratchMix")!;
  blend.oninput = () => {
    ctx.engine.setScratchMix(+blend.value);
    mixer.querySelector("#scratchMixValue")!.textContent =
      `${ctx.L("DECK", "PLATOS")} ${Math.round(+blend.value * 100)}%`;
  };
  const secondary = document.createElement("section");
  secondary.className = "scratch-deck-b";
  secondary.dataset.deck = "B";
  secondary.setAttribute("aria-labelledby", "deckBTitle");
  layout.append(secondary);
  renderDeck(primary, "A", ctx.project.tempo);
  renderDeck(secondary, "B", ctx.project.tempo);
  const armed = (deck: "A" | "B", buffer: AudioBuffer) => {
    if (deck === "A") {
      ctx.scratchBuffer = buffer;
      primary.dispatchEvent(new Event("scratcharmed"));
    }
    if (cuePlayer) {
      cueA.disabled = !ctx.scratchBuffer;
      cueB.disabled = !ctx.engine.deck("B").ready;
    }
    crossfader.value =
      ctx.engine.deck("A").ready && ctx.engine.deck("B").ready
        ? ".5"
        : deck === "A"
          ? "0"
          : "1";
    crossfader.dispatchEvent(new Event("input"));
  };
  const a = bindDeck(ctx, primary, "A", (buffer) => armed("A", buffer));
  bindDeck(ctx, secondary, "B", (buffer) => armed("B", buffer));
  return a;
}
