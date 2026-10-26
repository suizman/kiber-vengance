import type { RuntimeContext } from "../app";
import { waveformPeaks } from "../audio/waveform-cache";
import { meterSteps } from "../core";
import { renderWav } from "../audio";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function setupDualDeck(ctx: RuntimeContext) {
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
        cueB.disabled = !ctx.engine.scratchReadyB;
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

  const bpmA = document.createElement("label");
  bpmA.className = "deck-bpm";
  bpmA.innerHTML = `<span data-en="TRACK BPM" data-es="BPM PISTA">TRACK BPM</span><input id="scratchBpm" type="number" min="40" max="240" value="${ctx.project.tempo}" aria-label="Deck A track BPM">`;
  primary.querySelector(".scratch-capture")!.append(bpmA);
  const syncA = primary.querySelector<HTMLButtonElement>("#scratchSyncBtn")!;
  syncA.onclick = () => {
    const bpm = clamp(
      +primary.querySelector<HTMLInputElement>("#scratchBpm")!.value ||
        ctx.project.tempo,
      40,
      240,
    );
    const ratio = clamp(ctx.project.tempo / bpm, 0.5, 2);
    const rate = primary.querySelector<HTMLInputElement>("#scratchRate")!;
    rate.max = "2";
    rate.value = String(ratio);
    rate.dispatchEvent(new Event("input", { bubbles: true }));
    ctx.engine.syncScratch(
      Math.round(((ctx.engine.scratchSampleRate || 44100) * 60) / bpm),
      "A",
      ratio,
    );
  };
  primary.querySelector<HTMLInputElement>("#scratchRate")!.max = "2";

  const secondary = document.createElement("section");
  secondary.className = "scratch-deck-b";
  secondary.dataset.deck = "B";
  secondary.setAttribute("aria-labelledby", "deckBTitle");
  secondary.innerHTML = `
    <header class="scratch-head"><div><span class="deck-letter">B</span><h2 id="deckBTitle" data-en="SCRATCH DECK B" data-es="PLATO DE SCRATCH B">SCRATCH DECK B</h2></div><div class="scratch-capture">
      <label><span data-en="CAPTURE" data-es="CAPTURAR">CAPTURE</span><select id="deckBBars" aria-label="Deck B capture length"><option value="1">1 BAR</option><option value="2">2 BARS</option><option value="4" selected>4 BARS</option><option value="8">8 BARS</option></select></label>
      <button id="deckBCapture" data-en="CAPTURE MIX" data-es="CAPTURAR MEZCLA">CAPTURE MIX</button>
      <label class="file-button scratch-import"><span data-en="IMPORT AUDIO" data-es="IMPORTAR AUDIO">IMPORT AUDIO</span><input id="deckBImport" type="file" accept="audio/*,.wav,.mp3,.ogg,.oga,.webm"></label>
      <button id="deckBMic" aria-pressed="false" data-en="RECORD MIC" data-es="GRABAR MICRO">RECORD MIC</button>
      <label class="deck-bpm"><span data-en="TRACK BPM" data-es="BPM PISTA">TRACK BPM</span><input id="deckBBpm" type="number" min="40" max="240" value="${ctx.project.tempo}" aria-label="Deck B track BPM"></label>
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
  layout.append(secondary);
  const $ = <T extends HTMLElement = HTMLInputElement>(id: string) =>
    secondary.querySelector<T>(`#${id}`)!;
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
    $("deckBPlay").textContent = ctx.engine.scratchPlayingB
      ? ctx.L("■ STOP", "■ PARAR")
      : ctx.L("▶ PLAY", "▶ TOCAR");
  };
  const motor = () =>
    (+$("deckBRate").value || 1) *
    ($("deckBReverse").getAttribute("aria-pressed") === "true" ? -1 : 1);
  const stutterFrames = () =>
    Math.round(
      ((((ctx.engine.scratchSampleRateB || 44100) * 60) / ctx.project.tempo) *
        4) /
        +$("deckBDivision").value,
    );
  const stopStutter = () => {
    stuttering = false;
    $("deckBStutter").setAttribute("aria-pressed", "false");
    ctx.engine.setScratchStutter(0, "B");
  };
  const arm = async (audio: AudioBuffer, label: string) => {
    await ctx.engine.loadScratchBuffer(audio, "B");
    buffer = audio;
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
    if (cuePlayer) cueB.disabled = false;
    $("deckBPlatter").classList.remove("disabled");
    $("deckBPlatter").setAttribute("aria-disabled", "false");
    $("deckBStatus").removeAttribute("data-en");
    $("deckBStatus").removeAttribute("data-es");
    $("deckBStatus").textContent = label;
    ctx.engine.setScratchFilter(+$("deckBFilter").value, "B");
    ctx.engine.setScratchCrossfade(ctx.scratchBuffer ? 0.5 : 1);
    (mixer.querySelector("input") as HTMLInputElement).value = String(
      ctx.engine.scratchCrossfade,
    );
    crossfader.dispatchEvent(new Event("input"));
    playLabel();
  };
  $("deckBImport").onchange = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    input.disabled = true;
    try {
      await ctx.engine.init();
      await arm(
        await ctx.engine.ctx.decodeAudioData(await file.arrayBuffer()),
        file.name,
      );
    } catch (error) {
      $("deckBStatus").textContent = String(error);
      ctx.toast(ctx.L("Could not import audio", "No se pudo importar audio"));
    } finally {
      input.value = "";
      input.disabled = false;
    }
  };
  $("deckBCapture").onclick = async () => {
    const button = $("deckBCapture") as HTMLButtonElement;
    button.disabled = true;
    try {
      const bars = +$("deckBBars").value;
      const wav = await renderWav(ctx.project, { song: false });
      await ctx.engine.init();
      const source: AudioBuffer = await ctx.engine.ctx.decodeAudioData(
        await wav.arrayBuffer(),
      );
      const rate = ctx.engine.ctx.sampleRate;
      const length = Math.max(
        1,
        Math.round(
          ((bars * meterSteps(ctx.project.meter) * 60) /
            ctx.project.tempo /
            4) *
            rate,
        ),
      );
      const audio = ctx.engine.ctx.createBuffer(2, length, rate);
      for (let channel = 0; channel < 2; channel++) {
        const from = source.getChannelData(
          Math.min(channel, source.numberOfChannels - 1),
        );
        const to = audio.getChannelData(channel);
        for (let i = 0; i < length; i++) to[i] = from[i % from.length]!;
      }
      await arm(
        audio,
        `${bars} ${ctx.L("BARS CAPTURED", "COMPASES CAPTURADOS")}`,
      );
    } catch (error) {
      ctx.toast(String(error));
    } finally {
      button.disabled = false;
    }
  };
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
          ctx.engine.setScratchPlaying(false, "B");
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
    ctx.engine.setScratchPlaying(!ctx.engine.scratchPlayingB, "B");
    playLabel();
  };
  $("deckBSync").onclick = () => {
    const bpm = clamp(+$("deckBBpm").value || ctx.project.tempo, 40, 240),
      ratio = clamp(ctx.project.tempo / bpm, 0.5, 2);
    $("deckBRate").value = String(ratio);
    $("deckBRate").dispatchEvent(new Event("input"));
    ctx.engine.syncScratch(
      Math.round(((ctx.engine.scratchSampleRateB || 44100) * 60) / bpm),
      "B",
      ratio,
    );
  };
  $("deckBBrake").onclick = () => ctx.engine.setScratchSpeed(0, 1.15, "B");
  $("deckBSpin").onclick = () => {
    ctx.engine.setScratchPlaying(true, "B");
    ctx.engine.setScratchSpeed(-3.6, 0.035, "B");
    ctx.engine.setScratchSpeed(0, 1.6, "B");
    playLabel();
  };
  $("deckBStutter").onclick = () => {
    stuttering = !stuttering;
    ctx.engine.setScratchStutter(stuttering ? stutterFrames() : 0, "B");
    $("deckBStutter").setAttribute("aria-pressed", String(stuttering));
  };
  $("deckBDivision").onchange = () => {
    if (stuttering) ctx.engine.setScratchStutter(stutterFrames(), "B");
  };
  $("deckBFilter").oninput = () => {
    const value = +$("deckBFilter").value;
    ctx.engine.setScratchFilter(value, "B");
    $("deckBFilterValue").textContent =
      value > 0.96 ? "OPEN" : `${Math.round(value * 100)}%`;
  };
  $("deckBRate").oninput = () => {
    $("deckBRateValue").textContent = `${(+$("deckBRate").value).toFixed(2)}×`;
    ctx.engine.setScratchSpeed(motor(), 0.025, "B");
  };
  $("deckBReverse").onclick = () => {
    const button = $("deckBReverse");
    button.setAttribute(
      "aria-pressed",
      String(button.getAttribute("aria-pressed") !== "true"),
    );
    ctx.engine.setScratchSpeed(motor(), 0.025, "B");
  };
  $("deckBRestart").onclick = () => {
    stopStutter();
    ctx.engine.scratchNodeB?.port.postMessage({ type: "seek", frame: 0 });
    ctx.engine.setScratchSpeed(motor(), 0, "B");
    ctx.engine.setScratchPlaying(true, "B");
    playLabel();
  };
  $("deckBKeep").onclick = async () => {
    if (!buffer) return;
    const button = $("deckBKeep") as HTMLButtonElement;
    button.disabled = true;
    try {
      await ctx.addAudioBlob(ctx.audioBufferWav(buffer), "Scratch-B.wav");
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
    const frame = Math.round(value * (ctx.engine.scratchFramesB - 1));
    ctx.engine.scratchNodeB?.port.postMessage({ type: "seek", frame });
    ctx.engine.scratchPositionB = frame;
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
    const position =
      (ctx.engine.scratchPositionB || 0) /
      Math.max(1, ctx.engine.scratchFramesB || 1);
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
    if (!buffer) return;
    event.preventDefault();
    dragging = true;
    pointer = event.pointerId;
    lastAngle = pointerAngle(event);
    lastTime = performance.now();
    platter.setPointerCapture(pointer);
    secondary.classList.add("scratching");
    ctx.engine.setScratchPlaying(true, "B");
    ctx.engine.setScratchSpeed(0, 0, "B");
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
    const elapsed = Math.max(0.008, (now - lastTime) / 1000);
    ctx.engine.setScratchSpeed(
      clamp(delta / (Math.PI * 2) / elapsed / (33.333 / 60), -6, 6),
      0,
      "B",
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
    secondary.classList.remove("scratching");
    ctx.engine.setScratchSpeed(motor(), 0.14, "B");
  };
  platter.onpointerup = platter.onpointercancel = releasePlatter;
  platter.onwheel = (event) => {
    if (!buffer) return;
    event.preventDefault();
    ctx.engine.setScratchPlaying(true, "B");
    ctx.engine.setScratchSpeed(clamp(-event.deltaY * 0.018, -4, 4), 0.01, "B");
    clearTimeout(ctx.engine.scratchReturnTimerB);
    ctx.engine.scratchReturnTimerB = setTimeout(
      () => ctx.engine.setScratchSpeed(motor(), 0.12, "B"),
      90,
    );
  };
  platter.onkeydown = (event) => {
    if (!buffer) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      ctx.engine.setScratchPlaying(true, "B");
      ctx.engine.setScratchSpeed(
        event.key === "ArrowLeft" ? -1.8 : 1.8,
        0.01,
        "B",
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      $("deckBPlay").click();
    }
  };
  platter.onkeyup = (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight")
      ctx.engine.setScratchSpeed(motor(), 0.1, "B");
  };
  ctx.engine.onScratchPositionB = () => {
    if (buffer && ctx.activeView === "perform") {
      $("deckBPlayhead").style.left =
        `${clamp((ctx.engine.scratchPositionB || 0) / (ctx.engine.scratchFramesB || 1), 0, 1) * 100}%`;
      $("deckBSpeed").textContent =
        `${ctx.engine.scratchSpeedB >= 0 ? "+" : ""}${(+ctx.engine.scratchSpeedB || 0).toFixed(2)}×`;
      if (!dragging) {
        angle += (+ctx.engine.scratchSpeedB || 0) * 5;
        platter.style.setProperty("--rotation", `${angle}deg`);
      }
    }
  };
}
