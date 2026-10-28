import type { DeckContext } from "../state/contracts";
import type { DeckId } from "../audio/deck";
import { waveformPeaks } from "../audio/waveform-cache";
import { renderWav } from "../audio";
import { meterSteps, TRACKS, activeClip, clipLengthSteps } from "../core";
import { t as msg } from "../ui/i18n";
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const primaryIds: Record<string, string> = {
  deckBTitle: "scratchTitle",
  deckBBars: "scratchBars",
  deckBCapture: "scratchCaptureBtn",
  deckBImport: "scratchImport",
  deckBMic: "scratchMic",
  deckBBpm: "scratchBpm",
  deckBWave: "scratchWaveform",
  deckBPlayhead: "scratchWavePlayhead",
  deckBStatus: "scratchStatus",
  deckBPlatter: "scratchPlatter",
  deckBSpeed: "scratchSpeed",
  deckBPlay: "scratchPlayBtn",
  deckBSync: "scratchSyncBtn",
  deckBBrake: "scratchBrakeBtn",
  deckBSpin: "scratchSpinBtn",
  deckBStutter: "scratchStutterBtn",
  deckBFilter: "scratchFilter",
  deckBFilterValue: "scratchFilterValue",
  deckBDivision: "scratchDivision",
  deckBRate: "scratchRate",
  deckBRateValue: "scratchRateValue",
  deckBReverse: "scratchReverse",
  deckBRestart: "scratchRestart",
  deckBKeep: "scratchKeep",
};
export function renderDeck(root: HTMLElement, deck: DeckId, tempo: number) {
  let markup = `
    <header class="scratch-head"><div><span class="deck-letter">B</span><h2 id="deckBTitle" data-en="SCRATCH DECK B" data-es="PLATO DE SCRATCH B">SCRATCH DECK B</h2></div><div class="scratch-capture">
      <label><span data-en="CAPTURE" data-es="CAPTURAR">CAPTURE</span><select id="deckBBars" aria-label="Deck B capture length"><option value="1">1 BAR</option><option value="2">2 BARS</option><option value="4" selected>4 BARS</option><option value="8">8 BARS</option></select></label>
      <button id="deckBCapture" data-en="CAPTURE MIX" data-es="CAPTURAR MEZCLA">CAPTURE MIX</button>
      <label class="file-button scratch-import"><span data-en="IMPORT AUDIO" data-es="IMPORTAR AUDIO">IMPORT AUDIO</span><input id="deckBImport" type="file" accept="audio/*,.wav,.mp3,.ogg,.oga,.webm"></label>
      <button id="deckBMic" aria-pressed="false" data-en="RECORD MIC" data-es="GRABAR MICRO">RECORD MIC</button>
      <label class="deck-bpm"><span data-en="TRACK BPM" data-es="BPM PISTA">TRACK BPM</span><input id="deckBBpm" type="number" min="40" max="240" value="${tempo}" aria-label="Deck B track BPM"></label>
    </div></header>
    <div class="scratch-wave-shell"><canvas id="deckBWave" width="900" height="104" role="slider" tabindex="0" aria-label="Deck B waveform position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></canvas><i id="deckBPlayhead"></i><span id="deckBStatus" data-en="CAPTURE OR IMPORT AUDIO TO ARM DECK B" data-es="CAPTURA O IMPORTA AUDIO PARA ACTIVAR EL PLATO B">CAPTURE OR IMPORT AUDIO TO ARM DECK B</span></div>
    <div class="scratch-console"><div class="turntable-shell"><div id="deckBPlatter" class="scratch-platter disabled" role="application" tabindex="0" aria-label="Deck B scratch platter. Drag, use the mouse wheel, or press the arrow keys." aria-disabled="true"><div class="vinyl-grooves"></div><div class="vinyl-mark"></div><div class="record-label"><svg class="brand-emblem" viewBox="0 0 64 64" aria-hidden="true"><use href="#kvBrandMark"/></svg><small>33⅓</small></div><i class="spindle"></i></div><div class="deck-speed"><b id="deckBSpeed">+1.00×</b><span>VELOCITY</span></div></div>
    <div class="scratch-controls"><div class="scratch-actions"><button id="deckBPlay" disabled>▶ PLAY</button><button id="deckBSync" disabled>⌁ SYNC</button><button id="deckBBrake" disabled data-en="BRAKE" data-es="FRENAR">BRAKE</button><button id="deckBSpin" disabled data-en="SPINBACK" data-es="RETROCESO">SPINBACK</button><button id="deckBStutter" disabled aria-pressed="false" data-en="STUTTER" data-es="REPETIR">STUTTER</button></div>
    <label class="deck-slider"><span><span data-en="FILTER" data-es="FILTRO">FILTER</span><output id="deckBFilterValue">OPEN</output></span><input id="deckBFilter" type="range" min="0" max="1" step=".01" value="1" disabled></label>
    <div class="scratch-pro"><label><span data-en="STUTTER LENGTH" data-es="INTERVALO REPETICIÓN">STUTTER LENGTH</span><select id="deckBDivision"><option value="1">1/1</option><option value="2">1/2</option><option value="4">1/4</option><option value="8" selected>1/8</option><option value="16">1/16</option><option value="32">1/32</option><option value="64">1/64</option></select></label>
    <label><span data-en="MOTOR SPEED" data-es="VELOCIDAD MOTOR">MOTOR SPEED</span><output id="deckBRateValue">1.00×</output><input id="deckBRate" type="range" min=".5" max="2" step=".01" value="1" disabled></label>
    <button id="deckBReverse" disabled aria-pressed="false" data-en="REVERSE" data-es="REVERSA">REVERSE</button><button id="deckBRestart" disabled data-en="BACK TO START" data-es="VOLVER AL INICIO">BACK TO START</button><button id="deckBKeep" disabled data-en="KEEP IN PROJECT" data-es="GUARDAR EN PROYECTO">KEEP IN PROJECT</button></div>
    <p class="scratch-hint" data-en="Drag the record or waveform. The two decks can play at different speeds; Sync matches the project BPM by changing pitch." data-es="Arrastra el disco o la onda. Los platos pueden sonar a distinta velocidad; Sync iguala el BPM del proyecto cambiando el tono.">Drag the record or waveform. The two decks can play at different speeds; Sync matches the project BPM by changing pitch.</p>
    </div></div>`;
  if (deck === "A") {
    for (const [from, to] of Object.entries(primaryIds))
      markup = markup
        .replaceAll(`id="${from}"`, `id="${to}"`)
        .replaceAll(`Deck B`, `Deck A`)
        .replaceAll("SCRATCH DECK B", "SCRATCH DECK")
        .replaceAll("PLATO DE SCRATCH B", "PLATO DE SCRATCH")
        .replaceAll(">B</span>", ">A</span>");
  }
  root.innerHTML = markup;
}
export function bindDeck(
  ctx: DeckContext,
  root: HTMLElement,
  deck: DeckId,
  onArmed: (buffer: AudioBuffer) => void,
) {
  const $ = <T extends HTMLElement = HTMLInputElement>(id: string) =>
    root.querySelector<T>(`#${deck === "A" ? primaryIds[id] : id}`)!;
  const state = ctx.engine.deck(deck);
  let wheelTimer: ReturnType<typeof setTimeout> | undefined;
  let operation = 0;
  let buffer: AudioBuffer | null = null;
  let angle = 0;
  let stuttering = false;
  const controls = [
    "deckBPlay",
    "deckBSync",
    "deckBBrake",
    "deckBSpin",
    "deckBStutter",
    "deckBFilter",
    "deckBRate",
    "deckBReverse",
    "deckBRestart",
    "deckBKeep",
  ];
  const playLabel = () => {
    $("deckBPlay").textContent = state.playing
      ? ctx.L("■ STOP", "■ PARAR")
      : ctx.L("▶ PLAY", "▶ TOCAR");
  };
  const motor = () =>
    (+$("deckBRate").value || 1) *
    ($("deckBReverse").getAttribute("aria-pressed") === "true" ? -1 : 1);
  const stutterFrames = () =>
    Math.round(
      ((((state.sampleRate || 44100) * 60) / ctx.project.tempo) * 4) /
        +$("deckBDivision").value,
    );
  const stopStutter = () => {
    stuttering = false;
    $("deckBStutter").setAttribute("aria-pressed", "false");
    ctx.engine.setScratchStutter(0, deck);
  };
  const arm = async (
    audio: AudioBuffer,
    label: string,
    token = ++operation,
  ) => {
    if (token !== operation) return;
    await ctx.engine.loadScratchBuffer(audio, deck);
    if (token !== operation) return;
    buffer = audio;
    root.classList.add("ready");
    angle = 0;
    $("deckBRate").value = "1";
    $("deckBRateValue").textContent = "1.00×";
    $("deckBReverse").setAttribute("aria-pressed", "false");
    stopStutter();
    const canvas = $("deckBWave") as HTMLCanvasElement;
    const drawing = canvas.getContext("2d")!;
    const peaks = waveformPeaks(audio, canvas.width);
    drawing.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = drawing.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, "#ff73d4");
    gradient.addColorStop(1, "#59eaff");
    drawing.strokeStyle = gradient;
    drawing.beginPath();
    peaks.forEach((peak, x) => {
      const height = Math.max(1, peak * canvas.height * 0.45);
      drawing.moveTo(x, canvas.height / 2 - height);
      drawing.lineTo(x, canvas.height / 2 + height);
    });
    drawing.stroke();
    controls.forEach((id) => {
      $(id).disabled = false;
    });
    ctx.$("#scratchMix").disabled = false;

    $("deckBPlatter").classList.remove("disabled");
    $("deckBPlatter").setAttribute("aria-disabled", "false");
    $("deckBStatus").removeAttribute("data-en");
    $("deckBStatus").removeAttribute("data-es");
    $("deckBStatus").textContent =
      deck === "A" ? msg("ui_a38c300dea37", { arg0: label }) : label;
    ctx.engine.setScratchFilter(+$("deckBFilter").value, deck);
    onArmed(audio);
    playLabel();
  };
  const importFile = async (file: File) => {
    const token = ++operation;
    const input = $("deckBImport");
    input.disabled = true;
    try {
      await ctx.engine.init();
      await arm(
        await ctx.engine.ctx.decodeAudioData(await file.arrayBuffer()),
        file.name,
        token,
      );
    } catch (error) {
      $("deckBStatus").textContent = String(error);
      ctx.toast(ctx.L("Could not import audio", "No se pudo importar audio"));
    } finally {
      input.value = "";
      input.disabled = false;
    }
  };
  $("deckBImport").onchange = (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) void importFile(file);
  };
  const captureMix = async () => {
    const token = ++operation;
    const button = $("deckBCapture") as HTMLButtonElement;
    button.disabled = true;
    try {
      const bars = Math.max(1, +$("deckBBars").value),
        wav = await renderWav(ctx.project, {
          song: false,
          drumSamples: ctx.engine.drumSamples,
        });
      await ctx.engine.init();
      const decoded = await ctx.engine.ctx.decodeAudioData(
          await wav.arrayBuffer(),
        ),
        rate = ctx.engine.ctx.sampleRate,
        targetSeconds =
          (bars * meterSteps(ctx.project.meter) * 60) / ctx.project.tempo / 4,
        targetFrames = Math.max(1, Math.round(targetSeconds * rate)),
        sourceSteps = Math.max(
          ...TRACKS.map((track) =>
            clipLengthSteps(activeClip(ctx.project, track)),
          ),
        ),
        sourceSeconds = (sourceSteps * 60) / ctx.project.tempo / 4,
        sourceFrames = Math.max(
          1,
          Math.min(
            decoded.length,
            Math.round(sourceSeconds * decoded.sampleRate),
          ),
        ),
        captured = ctx.engine.ctx.createBuffer(2, targetFrames, rate);
      for (let channel = 0; channel < 2; channel++) {
        const source = decoded.getChannelData(
            Math.min(channel, decoded.numberOfChannels - 1),
          ),
          target = captured.getChannelData(channel);
        for (let i = 0; i < target.length; i++) {
          const sourcePosition =
              ((i * decoded.sampleRate) / rate) % sourceFrames,
            index = Math.floor(sourcePosition),
            next = (index + 1) % sourceFrames,
            mix = sourcePosition - index;
          target[i] = source[index]! * (1 - mix) + source[next]! * mix;
        }
      }
      await arm(
        captured,
        `${bars} ${ctx.L("BARS CAPTURED", "COMPASES CAPTURADOS")}`,
        token,
      );
    } catch (error) {
      ctx.toast(String(error));
    } finally {
      button.disabled = false;
    }
  };
  $("deckBCapture").onclick = captureMix;
  let recorder: MediaRecorder | null = null,
    stream: MediaStream | null = null;
  const stopMic = () => {
    if (recorder?.state === "recording") recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
  };
  window.addEventListener("pagehide", stopMic);
  $("deckBMic").onclick = async () => {
    if (recorder?.state === "recording") {
      stopMic();
      return;
    }
    const button = $("deckBMic") as HTMLButtonElement;
    button.disabled = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const chunks: Blob[] = [];
      recorder = new MediaRecorder(stream);
      const current = recorder;
      current.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      current.onstop = async () => {
        stopMic();
        try {
          await ctx.engine.init();
          await arm(
            await ctx.engine.ctx.decodeAudioData(
              await new Blob(chunks, { type: current.mimeType }).arrayBuffer(),
            ),
            ctx.L("MIC RECORDING", "GRABACIÓN MICRO"),
          );
          ctx.engine.setScratchPlaying(false, deck);
          playLabel();
        } catch (error) {
          ctx.toast(String(error));
        } finally {
          recorder = null;
          button.disabled = false;
          button.setAttribute("aria-pressed", "false");
          button.textContent = ctx.L("RECORD MIC", "GRABAR MICRO");
        }
      };
      current.start();
      button.setAttribute("aria-pressed", "true");
      button.textContent = ctx.L("STOP MIC", "PARAR MICRO");
      setTimeout(() => {
        if (current.state === "recording") stopMic();
      }, 60000);
    } catch (error) {
      stopMic();
      ctx.toast(String(error));
    } finally {
      button.disabled = false;
    }
  };
  $("deckBPlay").onclick = () => {
    ctx.engine.setScratchPlaying(!state.playing, deck);
    playLabel();
  };
  $("deckBSync").onclick = () => {
    const bpm = clamp(+$("deckBBpm").value || ctx.project.tempo, 40, 240),
      ratio = clamp(ctx.project.tempo / bpm, 0.5, 2);
    $("deckBRate").value = String(ratio);
    $("deckBRate").dispatchEvent(new Event("input"));
    ctx.engine.syncScratch(
      Math.round(((state.sampleRate || 44100) * 60) / bpm),
      deck,
      ratio,
    );
  };
  $("deckBBrake").onclick = () => ctx.engine.setScratchSpeed(0, 1.15, deck);
  $("deckBSpin").onclick = () => {
    ctx.engine.setScratchPlaying(true, deck);
    ctx.engine.setScratchSpeed(-3.6, 0.035, deck);
    ctx.engine.setScratchSpeed(0, 1.6, deck);
    playLabel();
  };
  $("deckBStutter").onclick = () => {
    stuttering = !stuttering;
    ctx.engine.setScratchStutter(stuttering ? stutterFrames() : 0, deck);
    $("deckBStutter").setAttribute("aria-pressed", String(stuttering));
  };
  $("deckBDivision").onchange = () => {
    if (stuttering) ctx.engine.setScratchStutter(stutterFrames(), deck);
  };
  $("deckBFilter").oninput = () => {
    const value = +$("deckBFilter").value;
    ctx.engine.setScratchFilter(value, deck);
    $("deckBFilterValue").textContent =
      value > 0.96 ? "OPEN" : `${Math.round(value * 100)}%`;
  };
  $("deckBRate").oninput = () => {
    $("deckBRateValue").textContent = `${(+$("deckBRate").value).toFixed(2)}×`;
    ctx.engine.setScratchSpeed(motor(), 0.025, deck);
  };
  $("deckBReverse").onclick = () => {
    const button = $("deckBReverse");
    button.setAttribute(
      "aria-pressed",
      String(button.getAttribute("aria-pressed") !== "true"),
    );
    ctx.engine.setScratchSpeed(motor(), 0.025, deck);
  };
  $("deckBRestart").onclick = () => {
    stopStutter();
    state.node?.port.postMessage({ type: "seek", frame: 0 });
    ctx.engine.setScratchSpeed(motor(), 0, deck);
    ctx.engine.setScratchPlaying(true, deck);
    playLabel();
  };
  $("deckBKeep").onclick = async () => {
    if (!buffer) return;
    const button = $("deckBKeep") as HTMLButtonElement;
    button.disabled = true;
    try {
      await ctx.addAudioBlob(ctx.audioBufferWav(buffer), `Scratch-${deck}.wav`);
    } catch (error) {
      ctx.toast(String(error));
    } finally {
      button.disabled = false;
    }
  };
  const wave = $("deckBWave") as HTMLCanvasElement;
  const seek = (fraction: number) => {
    if (!buffer) return;
    stopStutter();
    const value = clamp(fraction, 0, 1);
    const frame = Math.round(value * (state.frames - 1));
    state.node?.port.postMessage({ type: "seek", frame });
    state.position = frame;
    wave.setAttribute("aria-valuenow", String(Math.round(value * 100)));
    $("deckBPlayhead").style.left = `${value * 100}%`;
  };
  let wavePointer: number | null = null;
  const seekAt = (event: PointerEvent) => {
    const rect = wave.getBoundingClientRect();
    seek((event.clientX - rect.left) / rect.width);
  };
  wave.onpointerdown = (event) => {
    if (!buffer || event.button !== 0 || wavePointer !== null) return;
    event.preventDefault();
    wavePointer = event.pointerId;
    wave.setPointerCapture(wavePointer);
    seekAt(event);
  };
  wave.onpointermove = (event) => {
    if (event.pointerId === wavePointer) seekAt(event);
  };
  const releaseWave = (event: PointerEvent) => {
    if (event.pointerId === wavePointer) {
      wavePointer = null;
      if (wave.hasPointerCapture(event.pointerId))
        wave.releasePointerCapture(event.pointerId);
    }
  };
  wave.onpointerup =
    wave.onpointercancel =
    wave.onlostpointercapture =
      releaseWave;
  wave.onkeydown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const position = (state.position || 0) / Math.max(1, state.frames || 1);
    seek(
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 1
          : position +
            (event.key === "ArrowLeft" ? -1 : 1) *
              (event.shiftKey ? 0.1 : 0.01),
    );
  };
  const platter = $("deckBPlatter");
  let dragging = false,
    pointer = -1,
    lastAngle = 0,
    lastTime = 0;
  const pointerAngle = (event: PointerEvent) => {
    const rect = platter.getBoundingClientRect();
    return Math.atan2(
      event.clientY - (rect.top + rect.height / 2),
      event.clientX - (rect.left + rect.width / 2),
    );
  };
  platter.onpointerdown = (event) => {
    if (!buffer || dragging) return;
    event.preventDefault();
    dragging = true;
    pointer = event.pointerId;
    lastAngle = pointerAngle(event);
    lastTime = performance.now();
    try {
      platter.setPointerCapture(pointer);
    } catch {}
    root.classList.add("scratching");
    ctx.engine.setScratchPlaying(true, deck);
    ctx.engine.setScratchSpeed(0, 0, deck);
    playLabel();
  };
  platter.onpointermove = (event) => {
    if (!dragging || pointer !== event.pointerId) return;
    event.preventDefault();
    const current = pointerAngle(event),
      now = performance.now();
    let delta = current - lastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    angle += (delta * 180) / Math.PI;
    platter.style.setProperty("--rotation", `${angle}deg`);
    const elapsed = Math.max(0.008, (now - lastTime) / 1000);
    ctx.engine.setScratchSpeed(
      clamp(delta / (Math.PI * 2) / elapsed / (33.333 / 60), -6, 6),
      0,
      deck,
    );
    lastAngle = current;
    lastTime = now;
  };
  const releasePlatter = (event: PointerEvent) => {
    if (!dragging || pointer !== event.pointerId) return;
    dragging = false;
    pointer = -1;
    if (platter.hasPointerCapture(event.pointerId))
      platter.releasePointerCapture(event.pointerId);
    root.classList.remove("scratching");
    ctx.engine.setScratchSpeed(motor(), 0.14, deck);
  };
  platter.onpointerup =
    platter.onpointercancel =
    platter.onlostpointercapture =
      releasePlatter;
  const releaseInput = () => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove("scratching");
    if (platter.hasPointerCapture(pointer))
      platter.releasePointerCapture(pointer);
    pointer = -1;
    ctx.engine.setScratchSpeed(motor(), 0.14, deck);
  };
  window.addEventListener("blur", releaseInput);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseInput();
  });
  platter.onwheel = (event) => {
    if (!buffer) return;
    event.preventDefault();
    ctx.engine.setScratchPlaying(true, deck);
    ctx.engine.setScratchSpeed(clamp(-event.deltaY * 0.018, -4, 4), 0.01, deck);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(
      () => ctx.engine.setScratchSpeed(motor(), 0.12, deck),
      90,
    );
  };
  platter.onkeydown = (event) => {
    if (!buffer) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      ctx.engine.setScratchPlaying(true, deck);
      ctx.engine.setScratchSpeed(
        event.key === "ArrowLeft" ? -1.8 : 1.8,
        0.01,
        deck,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      $("deckBPlay").click();
    }
  };
  platter.onkeyup = (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight")
      ctx.engine.setScratchSpeed(motor(), 0.1, deck);
  };
  state.onPosition = () => {
    if (buffer && ctx.activeView === "perform") {
      $("deckBPlayhead").style.left =
        `${clamp((state.position || 0) / (state.frames || 1), 0, 1) * 100}%`;
      $("deckBSpeed").textContent =
        `${state.speed >= 0 ? "+" : ""}${(+state.speed || 0).toFixed(2)}×`;
      if (!dragging) {
        angle += (+state.speed || 0) * 5;
        platter.style.setProperty("--rotation", `${angle}deg`);
      }
    }
  };
  return { arm, importFile, captureMix, refresh: playLabel };
}
