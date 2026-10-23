import { activeClip, automationValue, clipLengthSteps, frequency, meterSteps, notesAtStep, playbackEvents, sceneLengthSteps, secondsPerStep, stepWithSwing, TRACKS } from './core.js';
const STANDARD_WAVES = new Set(['sine', 'square', 'sawtooth', 'triangle']);
function applyWave(context, oscillator, wave = 'sawtooth') { if (STANDARD_WAVES.has(wave)) {
    oscillator.type = wave;
    return;
} const count = 32, real = new Float32Array(count), imag = new Float32Array(count); for (let harmonic = 1; harmonic < count; harmonic++) {
    if (wave === 'pulse')
        imag[harmonic] = 2 * Math.sin(Math.PI * harmonic * .25) / (Math.PI * harmonic);
    else {
        const metallic = [1, 1.414, 2.31, 3.76, 5.43, 8.21], distance = Math.min(...metallic.map(r => Math.abs(harmonic - r)));
        imag[harmonic] = Math.exp(-distance * 1.6) / (harmonic ** .35);
    }
} oscillator.setPeriodicWave(context.createPeriodicWave(real, imag, { disableNormalization: false })); }
export class AudioEngine {
    ctx = null;
    project;
    timer = null;
    nextTime = 0;
    position = 0;
    playing = false;
    countingIn = false;
    onStep;
    songMode = false;
    lastFrequency = {};
    metronome = false;
    liveVoices = new Map();
    constructor(onStep = () => { }) { this.project = null; this.onStep = onStep; }
    async init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
            this.master = this.ctx.createGain();
            this.masterTone = this.ctx.createBiquadFilter();
            this.compressor = this.ctx.createDynamicsCompressor();
            this.limiter = this.ctx.createDynamicsCompressor();
            this.analyser = this.ctx.createAnalyser();
            this.masterTone.type = 'highshelf';
            this.masterTone.frequency.value = 5200;
            this.masterTone.gain.value = 1.2;
            this.compressor.threshold.value = -14;
            this.compressor.knee.value = 12;
            this.compressor.ratio.value = 3;
            this.compressor.attack.value = .012;
            this.compressor.release.value = .2;
            this.limiter.threshold.value = -1.5;
            this.limiter.knee.value = 1;
            this.limiter.ratio.value = 20;
            this.limiter.attack.value = .001;
            this.limiter.release.value = .08;
            this.analyser.fftSize = 256;
            this.master.connect(this.masterTone).connect(this.compressor).connect(this.limiter).connect(this.analyser).connect(this.ctx.destination);
            this.createEffectBuses();
        }
        if (this.ctx.state === 'suspended')
            await this.ctx.resume();
        return this.ctx;
    }
    setProject(project) { this.project = project; if (this.master) {
        this.master.gain.setTargetAtTime(project.master, this.ctx.currentTime, .02);
        for (const id of TRACKS)
            this.updateEffectBus(id, project.tracks[id], activeClip(project, id).character);
    } }
    createEffectBuses() {
        this.buses = {};
        const impulse = this.reverbImpulse();
        for (const id of TRACKS) {
            const input = this.ctx.createGain(), tone = this.ctx.createBiquadFilter(), saturation = this.ctx.createWaveShaper(), shape = this.ctx.createWaveShaper(), dry = this.ctx.createGain(), chorus = this.ctx.createDelay(.05), chorusWet = this.ctx.createGain(), lfo = this.ctx.createOscillator(), depth = this.ctx.createGain(), delay = this.ctx.createDelay(.8), feedback = this.ctx.createGain(), delayWet = this.ctx.createGain(), reverb = this.ctx.createConvolver(), reverbWet = this.ctx.createGain(), output = this.ctx.createGain();
            tone.type = 'highshelf';
            tone.frequency.value = 1800;
            saturation.oversample = '4x';
            shape.oversample = '2x';
            dry.gain.value = .82;
            chorus.delayTime.value = .018;
            chorusWet.gain.value = 0;
            depth.gain.value = 0;
            feedback.gain.value = 0;
            delayWet.gain.value = 0;
            reverbWet.gain.value = 0;
            reverb.buffer = impulse;
            input.connect(tone).connect(saturation).connect(shape);
            shape.connect(dry).connect(output);
            shape.connect(chorus).connect(chorusWet).connect(output);
            lfo.connect(depth).connect(chorus.delayTime);
            shape.connect(delay);
            delay.connect(feedback).connect(delay);
            delay.connect(delayWet).connect(output);
            shape.connect(reverb).connect(reverbWet).connect(output);
            output.connect(this.master);
            lfo.start();
            this.buses[id] = { input, tone, saturation, shape, dry, chorus, chorusWet, lfo, depth, delay, feedback, delayWet, reverbWet, output };
        }
    }
    updateEffectBus(id, cfg, character, time = this.ctx.currentTime) { const bus = this.buses?.[id]; if (!bus)
        return; const fx = character.fx || {}, macros = character.macros, bypass = fx.bypass, space = .55 + macros.space * .75, energy = .78 + macros.energy * .25 + (macros.aggression || 0) * .32, soloActive = TRACKS.some(track => this.project.tracks[track].solo), audible = !cfg.mute && (!soloActive || cfg.solo), smooth = (p, v) => p.setTargetAtTime(v, Math.max(this.ctx.currentTime, time), .025); bus.saturation.curve = this.saturationCurve(bypass ? 0 : (fx.saturation || 0) * energy); bus.shape.curve = this.distortionCurve(bypass ? 0 : (fx.distortion || 0) * energy); smooth(bus.tone.gain, bypass ? 0 : ((fx.tone ?? .5) - .5) * 18 - macros.darkness * 2); smooth(bus.dry.gain, bypass ? 1 : .82); smooth(bus.chorusWet.gain, bypass ? 0 : (fx.chorus || 0) * .4); smooth(bus.lfo.frequency, .18 + (fx.chorus || 0) * .8); smooth(bus.depth.gain, .002 + (fx.chorus || 0) * .006); smooth(bus.delay.delayTime, .16 + (fx.delay || 0) * .22); smooth(bus.feedback.gain, bypass ? 0 : Math.min(.55, .1 + (fx.delay || 0) * .4)); smooth(bus.delayWet.gain, bypass ? 0 : (fx.delay || 0) * .34 * space); smooth(bus.reverbWet.gain, bypass ? 0 : (fx.reverb || 0) * .42 * space); smooth(bus.output.gain, audible ? 1 : 0); }
    async start(project, { countInBars = 0 } = {}) { await this.init(); this.setProject(project); if (this.playing)
        return; this.playing = true; this.nextTime = this.ctx.currentTime + .06; this.position = 0; this.sceneIndex = 0; this.sceneStep = 0; this.sceneRepeat = 0; this.countInRemaining = Math.max(0, countInBars * meterSteps(project.meter)); this.countingIn = this.countInRemaining > 0; this.sequenceStartTime = this.nextTime + this.countInRemaining * secondsPerStep(project.tempo); this.timer = setInterval(() => this.schedule(), 25); this.schedule(); }
    stop() { this.playing = false; this.countingIn = false; if (this.timer)
        clearInterval(this.timer); this.timer = null; this.onStep(-1, 0, -1, { stopped: true }); }
    schedule() { if (!this.playing || !this.project)
        return; if (this.nextTime < this.ctx.currentTime - .1)
        this.nextTime = this.ctx.currentTime + .03; while (this.nextTime < this.ctx.currentTime + .12) {
        const base = secondsPerStep(this.project.tempo), wasCounting = this.countInRemaining > 0;
        if (wasCounting) {
            const count = this.countInRemaining;
            this.click(this.nextTime, count % 4 === 0);
            this.onStep(-2, this.nextTime, -1, { countIn: count });
            this.countInRemaining--;
            if (this.countInRemaining === 0)
                this.countingIn = false;
        }
        else {
            this.scheduleMusicStep(this.nextTime);
            this.advanceTransport();
        }
        this.nextTime += wasCounting ? base : base + (this.position % 2 ? base * this.project.swing : -base * this.project.swing);
    } }
    scheduleMusicStep(time) {
        const beatSteps = this.project.meter?.unit === 8 ? 2 : 4;
        if (this.metronome && this.position % beatSteps === 0)
            this.click(time, this.position % meterSteps(this.project.meter) === 0);
        const scene = this.songMode ? this.project.arrangement[this.sceneIndex] : null, soloActive = TRACKS.some(track => this.project.tracks[track].solo);
        for (const track of TRACKS) {
            const clip = scene ? this.project.clips.find(c => c.id === scene.clipIds[track]) || activeClip(this.project, track) : activeClip(this.project, track), local = (this.songMode ? this.sceneStep : this.position) % clipLengthSteps(clip), cfg = this.project.tracks[track], character = clip.character;
            this.updateEffectBus(track, cfg, character, time);
            if (cfg.mute || (soloActive && !cfg.solo))
                continue;
            const volume = automationValue(clip, 'volume', local, 1);
            for (const n of notesAtStep(this.project, clip, track, local)) {
                const expression = n.expression || {}, velocity = n.velocity * cfg.volume * volume * (.65 + (expression.pressure ?? n.velocity) * .35), noteTime = Math.max(this.ctx.currentTime + .001, time + (n.offset || 0) * secondsPerStep(this.project.tempo)), cutoff = Math.max(0, Math.min(1, automationValue(clip, 'cutoff', local, .5) + (expression.timbre ?? .5) - .5));
                if (track === 'drums')
                    this.drum(n.pitch, noteTime, velocity, cfg);
                else
                    this.voice(track, n.pitch + (expression.bend || 0), noteTime, n.length * secondsPerStep(this.project.tempo), velocity, cfg, character, cutoff, automationValue(clip, 'pan', local, .5));
            }
        }
        this.onStep(this.songMode ? this.sceneStep : this.position, time, this.songMode ? this.sceneIndex : -1, { sceneStep: this.sceneStep, position: this.position });
    }
    advanceTransport() { this.position++; if (!this.songMode)
        return; const scene = this.project.arrangement[this.sceneIndex]; if (!scene) {
        this.sceneIndex = 0;
        this.sceneStep = 0;
        return;
    } this.sceneStep++; if (this.sceneStep >= sceneLengthSteps(this.project, scene)) {
        this.sceneStep = 0;
        this.sceneRepeat++;
        if (this.sceneRepeat >= scene.repeats) {
            this.sceneRepeat = 0;
            this.sceneIndex = (this.sceneIndex + 1) % this.project.arrangement.length;
        }
    } }
    recordPosition(track, { quantized = true } = {}) { if (!this.ctx || !this.playing || this.countingIn)
        return null; const raw = Math.max(0, (this.ctx.currentTime - this.sequenceStartTime) / secondsPerStep(this.project.tempo)), clip = activeClip(this.project, track), position = raw % clipLengthSteps(clip); return quantized ? Math.round(position / this.project.editor.snap) * this.project.editor.snap % clipLengthSteps(clip) : position; }
    click(time, accent = false) { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.frequency.value = accent ? 1250 : 900; g.gain.setValueAtTime(.07, time); g.gain.exponentialRampToValueAtTime(.001, time + .035); o.connect(g).connect(this.master); o.onended = () => { o.disconnect(); g.disconnect(); }; o.start(time); o.stop(time + .04); }
    voice(track, pitch, time, duration, velocity, cfg, character, cutoffAuto = .5, panAuto = .5) {
        if (!this.ctx)
            return;
        if (track === 'guitar') {
            this.guitar(pitch, time, duration, velocity, cfg, character, cutoffAuto, panAuto);
            return;
        }
        const { lfo, macros } = character, filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain(), pan = this.ctx.createStereoPanner(), oscillators = [], unison = Math.max(1, Math.min(3, cfg.unison || 1)), target = frequency(pitch), previous = this.lastFrequency[track] || target, lfoNode = lfo.enabled ? this.ctx.createOscillator() : null, lfoGain = lfoNode ? this.ctx.createGain() : null;
        filter.type = cfg.filterType || 'lowpass';
        filter.frequency.setValueAtTime(Math.max(120, cfg.cutoff * (.35 + cutoffAuto * 1.1) * (1 - macros.darkness * .35)), time);
        filter.Q.value = cfg.resonance || 1;
        pan.pan.value = Math.max(-1, Math.min(1, (panAuto - .5) * 1.3 + (cfg.pan || 0)));
        const peak = Math.min(.34, velocity * .23 / Math.sqrt(unison)), attack = Math.max(.005, cfg.attack || .005), decay = Math.max(.01, cfg.decay || .1), sustain = Math.max(.01, cfg.sustain ?? .72), attackEnd = time + Math.min(attack, duration), decayEnd = Math.min(time + duration, attackEnd + decay);
        gain.gain.setValueAtTime(.0001, time);
        gain.gain.exponentialRampToValueAtTime(Math.max(.001, peak), attackEnd);
        if (decayEnd > attackEnd)
            gain.gain.exponentialRampToValueAtTime(Math.max(.001, peak * sustain), decayEnd);
        if (time + duration > decayEnd)
            gain.gain.setValueAtTime(Math.max(.001, peak * sustain), time + duration);
        gain.gain.exponentialRampToValueAtTime(.0001, time + duration + cfg.release);
        filter.connect(gain).connect(pan).connect(this.buses[track].input);
        if (lfoNode) {
            lfoNode.frequency.value = lfo.rate;
            lfoGain.gain.value = lfo.target === 'cutoff' ? cfg.cutoff * lfo.depth * .45 : lfo.target === 'pan' ? lfo.depth * .8 : lfo.depth * 100;
            lfoNode.connect(lfoGain);
            if (lfo.target === 'cutoff')
                lfoGain.connect(filter.frequency);
            if (lfo.target === 'pan')
                lfoGain.connect(pan.pan);
            lfoNode.start(time);
            lfoNode.stop(time + duration + cfg.release + .05);
        }
        const addOsc = (wave, level = 1, octave = 1) => { for (let i = 0; i < unison; i++) {
            const o = this.ctx.createOscillator(), og = this.ctx.createGain(), spread = (i - (unison - 1) / 2) * (cfg.detune || 6);
            applyWave(this.ctx, o, wave);
            o.detune.value = spread;
            o.frequency.setValueAtTime(previous * octave, time);
            if (cfg.glide)
                o.frequency.exponentialRampToValueAtTime(target * octave, time + cfg.glide);
            else
                o.frequency.setValueAtTime(target * octave, time);
            og.gain.value = level;
            if (lfoNode && lfo.target === 'pitch')
                lfoGain.connect(o.detune);
            o.connect(og).connect(filter);
            o.start(time);
            o.stop(time + duration + cfg.release + .05);
            oscillators.push(o, og);
        } };
        addOsc(cfg.wave || 'sawtooth', 1 - (cfg.osc2Mix || 0) * .35);
        if (cfg.osc2Wave && cfg.osc2Wave !== 'off' && cfg.osc2Mix > 0)
            addOsc(cfg.osc2Wave, cfg.osc2Mix, .5);
        this.lastFrequency[track] = target;
        const tail = oscillators.filter(n => 'onended' in n).at(-1);
        if (tail)
            tail.onended = () => { oscillators.forEach(o => o.disconnect()); lfoNode?.disconnect(); lfoGain?.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect(); };
    }
    guitar(pitch, time, duration, velocity, cfg, character, cutoffAuto = .5, panAuto = .5) { const target = frequency(pitch), filter = this.ctx.createBiquadFilter(), body = this.ctx.createBiquadFilter(), gain = this.ctx.createGain(), pan = this.ctx.createStereoPanner(), nodes = [], release = Math.max(.12, cfg.release || .35), end = time + Math.max(.12, duration) + release, peak = Math.max(.002, Math.min(.28, velocity * .27)); let tail; filter.type = 'lowpass'; filter.frequency.value = Math.max(900, (cfg.cutoff || 5200) * (.45 + cutoffAuto * .75) * (1 - character.macros.darkness * .28)); filter.Q.value = cfg.resonance || 2; body.type = 'peaking'; body.frequency.value = 190 + target * .28; body.Q.value = 1.2; body.gain.value = 4; pan.pan.value = Math.max(-1, Math.min(1, (panAuto - .5) * 1.3 + (cfg.pan || 0))); gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(peak, time + .004); gain.gain.exponentialRampToValueAtTime(Math.max(.001, peak * .34), Math.min(end - .02, time + .16)); gain.gain.exponentialRampToValueAtTime(.0001, end); filter.connect(body).connect(gain).connect(pan).connect(this.buses.guitar.input); const harmonics = [1, 2, 3, 4], levels = [1, .34, .16, .07]; harmonics.forEach((ratio, index) => { const osc = this.ctx.createOscillator(), level = this.ctx.createGain(); osc.type = index === 0 ? 'triangle' : 'sine'; osc.frequency.value = target * ratio; osc.detune.value = (index % 2 ? .7 : -.7) * (cfg.detune || 3); level.gain.value = levels[index]; osc.connect(level).connect(filter); osc.start(time); osc.stop(end + .02); tail = osc; nodes.push(osc, level); }); const pickLength = .018, buffer = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * pickLength), this.ctx.sampleRate), data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length); const pick = this.ctx.createBufferSource(), pickFilter = this.ctx.createBiquadFilter(), pickGain = this.ctx.createGain(); pick.buffer = buffer; pickFilter.type = 'bandpass'; pickFilter.frequency.value = Math.min(9000, target * 8); pickFilter.Q.value = .7; pickGain.gain.value = peak * .75; pick.connect(pickFilter).connect(pickGain).connect(filter); pick.start(time); nodes.push(pick, pickFilter, pickGain); if (tail)
        tail.onended = () => { nodes.forEach(n => n.disconnect()); filter.disconnect(); body.disconnect(); gain.disconnect(); pan.disconnect(); }; }
    async startLive(id, track, pitch, velocity = .8, expression = {}, channel = null) {
        await this.init();
        this.setProject(this.project);
        this.stopLive(id, true);
        const now = this.ctx.currentTime, cfg = this.project.tracks[track], character = activeClip(this.project, track).character, macros = character.macros;
        if (track === 'drums') {
            this.drum(pitch, now, velocity, cfg);
            return;
        }
        const filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain(), pan = this.ctx.createStereoPanner(), oscillators = [], unison = Math.max(1, Math.min(3, cfg.unison || 1)), pressure = expression.pressure ?? velocity, timbre = expression.timbre ?? .5, bend = expression.bend ?? 0, peak = Math.max(.001, velocity * (.65 + pressure * .35) * cfg.volume * .23 / Math.sqrt(unison));
        filter.type = cfg.filterType || 'lowpass';
        filter.Q.value = cfg.resonance || 1;
        filter.frequency.value = Math.max(120, (cfg.cutoff || 1800) * (.35 + timbre * 1.1) * (1 - macros.darkness * .35));
        pan.pan.value = cfg.pan || 0;
        gain.gain.setValueAtTime(.0001, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + Math.max(.005, cfg.attack || .005));
        gain.gain.setTargetAtTime(Math.max(.001, peak * (cfg.sustain ?? .72)), now + Math.max(.005, cfg.attack || .005), Math.max(.01, cfg.decay || .1));
        filter.connect(gain).connect(pan).connect(this.buses[track].input);
        const add = (wave, level, ratio) => { for (let i = 0; i < unison; i++) {
            const node = this.ctx.createOscillator(), levelNode = this.ctx.createGain();
            applyWave(this.ctx, node, wave);
            node.detune.value = (i - (unison - 1) / 2) * (cfg.detune || 6);
            node.frequency.value = frequency(pitch + bend) * ratio;
            levelNode.gain.value = level;
            node.connect(levelNode).connect(filter);
            node.start(now);
            oscillators.push({ node, ratio });
        } };
        add(cfg.wave || 'sawtooth', 1 - (cfg.osc2Mix || 0) * .35, 1);
        if (cfg.osc2Wave && cfg.osc2Wave !== 'off' && (cfg.osc2Mix || 0) > 0)
            add(cfg.osc2Wave, cfg.osc2Mix || 0, .5);
        this.liveVoices.set(id, { id, track, pitch, velocity, channel, cfg, macros, filter, gain, pan, oscillators, expression: { pressure, timbre, bend } });
    }
    updateLive(id, expression) { const voice = this.liveVoices.get(id); if (!voice || !this.ctx)
        return; Object.assign(voice.expression, expression); const now = this.ctx.currentTime, { pressure, timbre, bend } = voice.expression; voice.oscillators.forEach(({ node, ratio }) => node.frequency.setTargetAtTime(frequency(voice.pitch + bend) * ratio, now, .008)); voice.filter.frequency.setTargetAtTime(Math.max(120, (voice.cfg.cutoff || 1800) * (.35 + timbre * 1.1) * (1 - voice.macros.darkness * .35)), now, .012); voice.gain.gain.setTargetAtTime(Math.max(.001, voice.velocity * (.65 + pressure * .35) * voice.cfg.volume * .23 * (voice.cfg.sustain ?? .72) / Math.sqrt(Math.max(1, voice.cfg.unison || 1))), now, .012); }
    updateLiveChannel(channel, expression) { for (const [id, voice] of this.liveVoices)
        if (voice.channel === channel)
            this.updateLive(id, expression); }
    stopLive(id, immediate = false) { const voice = this.liveVoices.get(id); if (!voice || !this.ctx)
        return; this.liveVoices.delete(id); const now = this.ctx.currentTime, release = immediate ? .01 : Math.max(.02, voice.cfg.release || .12); voice.gain.gain.cancelScheduledValues(now); voice.gain.gain.setTargetAtTime(.0001, now, release / 4); for (const { node } of voice.oscillators)
        try {
            node.stop(now + release);
        }
        catch { } setTimeout(() => { for (const { node } of voice.oscillators)
        node.disconnect(); voice.filter.disconnect(); voice.gain.disconnect(); voice.pan.disconnect(); }, Math.ceil((release + .05) * 1000)); }
    drum(kind, time, velocity, cfg = this.project.tracks.drums) { if (!this.ctx)
        return; const g = this.ctx.createGain(), pan = this.ctx.createStereoPanner(); pan.pan.value = cfg.pan || 0; g.connect(pan).connect(this.buses.drums.input); if (kind === 0 || kind === 4) {
        const o = this.ctx.createOscillator(), start = kind === 0 ? 145 : kind === 4 ? 125 : 180, end = kind === 0 ? 42 : 72, len = kind === 0 ? .2 : .28;
        o.type = kind === 4 ? 'triangle' : 'sine';
        o.frequency.setValueAtTime(start, time);
        o.frequency.exponentialRampToValueAtTime(end, time + len * .65);
        g.gain.setValueAtTime(velocity * (kind === 0 ? .7 : .42), time);
        g.gain.exponentialRampToValueAtTime(.001, time + len);
        o.connect(g);
        o.onended = () => { o.disconnect(); g.disconnect(); pan.disconnect(); };
        o.start(time);
        o.stop(time + len);
    }
    else {
        const len = kind === 2 ? .045 : kind === 3 ? .28 : kind === 6 ? .65 : .13, buf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * len), this.ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++)
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, kind === 6 ? .7 : 1);
        const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter();
        f.type = kind === 2 || kind === 3 || kind === 6 ? 'highpass' : 'bandpass';
        f.frequency.value = kind === 2 ? 6500 : kind === 3 ? 4700 : kind === 6 ? 3500 : kind === 5 ? 2400 : 1800;
        g.gain.setValueAtTime(velocity * (kind === 2 ? .2 : kind === 6 ? .3 : .35), time);
        g.gain.exponentialRampToValueAtTime(.001, time + len);
        s.buffer = buf;
        s.connect(f).connect(g);
        s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); pan.disconnect(); };
        s.start(time);
    } }
    distortionCurve(amount) { const n = 256, curve = new Float32Array(n), k = amount * 180; for (let i = 0; i < n; i++) {
        const x = i * 2 / n - 1;
        curve[i] = amount < .005 ? x : (1 + k) * x / (1 + k * Math.abs(x));
    } return curve; }
    saturationCurve(amount) { const n = 256, curve = new Float32Array(n), drive = 1 + amount * 8, norm = Math.tanh(drive); for (let i = 0; i < n; i++) {
        const x = i * 2 / (n - 1) - 1;
        curve[i] = amount < .005 ? x : Math.tanh(x * drive) / norm;
    } return curve; }
    reverbImpulse() { if (this.impulse)
        return this.impulse; const length = this.ctx.sampleRate * 1.8, buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate); for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < length; i++)
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.4);
    } return this.impulse = buffer; }
    async preview(track, pitch, velocity = .8) { await this.init(); this.setProject(this.project); if (track === 'drums')
        this.drum(pitch, this.ctx.currentTime, velocity);
    else
        this.voice(track, pitch, this.ctx.currentTime, .22, velocity, this.project.tracks[track], activeClip(this.project, track).character); }
    draw(canvas) { if (!this.analyser)
        return; const c = canvas.getContext('2d'), data = new Uint8Array(this.analyser.frequencyBinCount); this.analyser.getByteFrequencyData(data); c.clearRect(0, 0, canvas.width, canvas.height); const gradient = c.createLinearGradient(0, canvas.height, 0, 0); gradient.addColorStop(0, '#9d5b28'); gradient.addColorStop(1, '#ffcf67'); c.fillStyle = gradient; const w = canvas.width / data.length; data.forEach((v, i) => c.fillRect(i * w, canvas.height, Math.max(1, w - 1), -v / 255 * canvas.height)); }
    diagnostics() { return { effectBuses: Object.keys(this.buses || {}).length, liveVoices: this.liveVoices.size, schedulerActive: Boolean(this.timer), contextState: this.ctx?.state || 'uninitialized', sampleRate: this.ctx?.sampleRate || null, countingIn: this.countingIn }; }
}
function makeCurve(amount) { const c = new Float32Array(256), k = amount * 180; for (let i = 0; i < c.length; i++) {
    const x = i * 2 / c.length - 1;
    c[i] = amount < .005 ? x : (1 + k) * x / (1 + k * Math.abs(x));
} return c; }
function makeSaturationCurve(amount) { const c = new Float32Array(256), drive = 1 + amount * 8, norm = Math.tanh(drive); for (let i = 0; i < c.length; i++) {
    const x = i * 2 / (c.length - 1) - 1;
    c[i] = amount < .005 ? x : Math.tanh(x * drive) / norm;
} return c; }
function wavBlob(buffer) { const len = 44 + buffer.length * 4, ab = new ArrayBuffer(len), v = new DataView(ab), str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0))); str(0, 'RIFF'); v.setUint32(4, len - 8, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, buffer.sampleRate, true); v.setUint32(28, buffer.sampleRate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, len - 44, true); let off = 44; for (let i = 0; i < buffer.length; i++)
    for (let ch = 0; ch < 2; ch++) {
        const x = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
        v.setInt16(off, x < 0 ? x * 32768 : x * 32767, true);
        off += 2;
    } return new Blob([ab], { type: 'audio/wav' }); }
export async function renderWav(project, { song = true } = {}) {
    const { events, durationSteps } = playbackEvents(project, { song }), sr = 44100, duration = stepWithSwing(durationSteps, project.tempo, project.swing) + 3, ctx = new OfflineAudioContext(2, Math.ceil(duration * sr), sr), master = ctx.createGain(), tone = ctx.createBiquadFilter(), comp = ctx.createDynamicsCompressor(), limiter = ctx.createDynamicsCompressor();
    master.gain.value = project.master * .78;
    tone.type = 'highshelf';
    tone.frequency.value = 5200;
    tone.gain.value = 1.2;
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    limiter.threshold.value = -1.5;
    limiter.ratio.value = 20;
    master.connect(tone).connect(comp).connect(limiter).connect(ctx.destination);
    let impulse;
    const getImpulse = () => { if (impulse)
        return impulse; impulse = ctx.createBuffer(2, Math.floor(sr * 1.8), sr); for (let ch = 0; ch < 2; ch++) {
        const d = impulse.getChannelData(ch);
        for (let i = 0; i < d.length; i++)
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.4);
    } return impulse; };
    const buses = {};
    for (const clip of project.clips) {
        const { fx, macros } = clip.character, input = ctx.createGain(), eq = ctx.createBiquadFilter(), saturation = ctx.createWaveShaper(), shape = ctx.createWaveShaper(), dry = ctx.createGain(), chorus = ctx.createDelay(.05), chorusWet = ctx.createGain(), chorusLfo = ctx.createOscillator(), chorusDepth = ctx.createGain(), delay = ctx.createDelay(.8), feedback = ctx.createGain(), delayWet = ctx.createGain(), reverb = ctx.createConvolver(), reverbWet = ctx.createGain(), space = .55 + macros.space * .75, drive = .78 + macros.energy * .25 + (macros.aggression || 0) * .32;
        eq.type = 'highshelf';
        eq.frequency.value = 1800;
        eq.gain.value = fx.bypass ? 0 : ((fx.tone ?? .5) - .5) * 18 - macros.darkness * 2;
        saturation.curve = makeSaturationCurve(fx.bypass ? 0 : (fx.saturation || 0) * drive);
        saturation.oversample = '4x';
        shape.curve = makeCurve(fx.bypass ? 0 : (fx.distortion || 0) * drive);
        shape.oversample = '2x';
        dry.gain.value = fx.bypass ? 1 : .82;
        chorus.delayTime.value = .018;
        chorusWet.gain.value = fx.bypass ? 0 : (fx.chorus || 0) * .4;
        chorusLfo.frequency.value = .18 + (fx.chorus || 0) * .8;
        chorusDepth.gain.value = .002 + (fx.chorus || 0) * .006;
        delay.delayTime.value = .16 + (fx.delay || 0) * .22;
        feedback.gain.value = fx.bypass ? 0 : Math.min(.55, .1 + (fx.delay || 0) * .4);
        delayWet.gain.value = fx.bypass ? 0 : (fx.delay || 0) * .34 * space;
        reverb.buffer = getImpulse();
        reverbWet.gain.value = fx.bypass ? 0 : (fx.reverb || 0) * .42 * space;
        input.connect(eq).connect(saturation).connect(shape);
        shape.connect(dry).connect(master);
        shape.connect(chorus).connect(chorusWet).connect(master);
        chorusLfo.connect(chorusDepth).connect(chorus.delayTime);
        chorusLfo.start(0);
        chorusLfo.stop(duration);
        shape.connect(delay);
        delay.connect(feedback).connect(delay);
        delay.connect(delayWet).connect(master);
        shape.connect(reverb).connect(reverbWet).connect(master);
        buses[clip.id] = input;
    }
    const guitarEvent = (e, cfg) => { const start = stepWithSwing(e.step, project.tempo, project.swing), noteDuration = e.length * secondsPerStep(project.tempo), end = start + Math.max(.12, noteDuration) + Math.max(.12, cfg.release || .35), clip = project.clips.find(c => c.id === e.clipId), macros = clip.character.macros, cut = automationValue(clip, 'cutoff', e.localStep, .5), vol = automationValue(clip, 'volume', e.localStep, 1), target = frequency(e.pitch), filter = ctx.createBiquadFilter(), body = ctx.createBiquadFilter(), gain = ctx.createGain(), pan = ctx.createStereoPanner(), peak = Math.max(.002, Math.min(.24, e.velocity * cfg.volume * vol * .22)); filter.type = 'lowpass'; filter.frequency.value = Math.max(900, (cfg.cutoff || 5200) * (.45 + cut * .75) * (1 - macros.darkness * .28)); filter.Q.value = cfg.resonance || 2; body.type = 'peaking'; body.frequency.value = 190 + target * .28; body.Q.value = 1.2; body.gain.value = 4; pan.pan.value = Math.max(-1, Math.min(1, (automationValue(clip, 'pan', e.localStep, .5) - .5) * 1.3 + (cfg.pan || 0))); gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(peak, start + .004); gain.gain.exponentialRampToValueAtTime(Math.max(.001, peak * .34), Math.min(end - .02, start + .16)); gain.gain.exponentialRampToValueAtTime(.0001, end); filter.connect(body).connect(gain).connect(pan).connect(buses[e.clipId]); [1, 2, 3, 4].forEach((ratio, index) => { const osc = ctx.createOscillator(), level = ctx.createGain(); osc.type = index === 0 ? 'triangle' : 'sine'; osc.frequency.value = target * ratio; osc.detune.value = (index % 2 ? .7 : -.7) * (cfg.detune || 3); level.gain.value = [1, .34, .16, .07][index]; osc.connect(level).connect(filter); osc.start(start); osc.stop(end + .02); }); const pickLength = .018, buffer = ctx.createBuffer(1, Math.ceil(sr * pickLength), sr), data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length); const pick = ctx.createBufferSource(), pickFilter = ctx.createBiquadFilter(), pickGain = ctx.createGain(); pick.buffer = buffer; pickFilter.type = 'bandpass'; pickFilter.frequency.value = Math.min(9000, target * 8); pickFilter.Q.value = .7; pickGain.gain.value = peak * .75; pick.connect(pickFilter).connect(pickGain).connect(filter); pick.start(start); };
    const toneEvent = (e, cfg) => { const start = stepWithSwing(e.step, project.tempo, project.swing), end = start + e.length * secondsPerStep(project.tempo), clip = project.clips.find(c => c.id === e.clipId), { lfo, macros } = clip.character, f = ctx.createBiquadFilter(), g = ctx.createGain(), pan = ctx.createStereoPanner(), cut = automationValue(clip, 'cutoff', e.localStep, .5), vol = automationValue(clip, 'volume', e.localStep, 1), unison = Math.max(1, Math.min(3, cfg.unison || 1)), peak = Math.max(.002, e.velocity * cfg.volume * vol * .16 / Math.sqrt(unison)), attack = Math.max(.005, cfg.attack || .005), decay = Math.max(.01, cfg.decay || .1), sustain = Math.max(.01, cfg.sustain ?? .72), release = cfg.release || .1, noteDuration = end - start, attackEnd = start + Math.min(attack, noteDuration), decayEnd = Math.min(end, attackEnd + decay); f.type = cfg.filterType || 'lowpass'; f.frequency.value = Math.max(120, cfg.cutoff * (.35 + cut * 1.1) * (1 - macros.darkness * .35)); f.Q.value = cfg.resonance || 1; pan.pan.value = Math.max(-1, Math.min(1, (automationValue(clip, 'pan', e.localStep, .5) - .5) * 1.3 + (cfg.pan || 0))); g.gain.setValueAtTime(.001, start); g.gain.exponentialRampToValueAtTime(peak, attackEnd); if (decayEnd > attackEnd)
        g.gain.exponentialRampToValueAtTime(Math.max(.001, peak * sustain), decayEnd); if (end > decayEnd)
        g.gain.setValueAtTime(Math.max(.001, peak * sustain), end); g.gain.exponentialRampToValueAtTime(.001, end + release); f.connect(g).connect(pan).connect(buses[e.clipId]); const lfoNode = lfo.enabled ? ctx.createOscillator() : null, lfoGain = lfoNode ? ctx.createGain() : null; if (lfoNode) {
        lfoNode.frequency.value = lfo.rate;
        lfoGain.gain.value = lfo.target === 'cutoff' ? cfg.cutoff * lfo.depth * .45 : lfo.target === 'pan' ? lfo.depth * .8 : lfo.depth * 100;
        lfoNode.connect(lfoGain);
        if (lfo.target === 'cutoff')
            lfoGain.connect(f.frequency);
        if (lfo.target === 'pan')
            lfoGain.connect(pan.pan);
        lfoNode.start(start);
        lfoNode.stop(end + release + .02);
    } const addOsc = (wave, level = 1, octave = 1) => { for (let i = 0; i < unison; i++) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        applyWave(ctx, o, wave);
        o.frequency.value = frequency(e.pitch) * octave;
        o.detune.value = (i - (unison - 1) / 2) * (cfg.detune || 6);
        og.gain.value = level;
        if (lfoNode && lfo.target === 'pitch')
            lfoGain.connect(o.detune);
        o.connect(og).connect(f);
        o.start(start);
        o.stop(end + release + .02);
    } }; addOsc(cfg.wave || 'sawtooth', 1 - (cfg.osc2Mix || 0) * .35); if (cfg.osc2Wave && cfg.osc2Wave !== 'off' && cfg.osc2Mix > 0)
        addOsc(cfg.osc2Wave, cfg.osc2Mix, .5); };
    const drumEvent = (e, cfg) => { const start = stepWithSwing(e.step, project.tempo, project.swing), g = ctx.createGain(), pan = ctx.createStereoPanner(); pan.pan.value = cfg.pan || 0; g.connect(pan).connect(buses[e.clipId]); if (e.pitch === 0 || e.pitch === 4) {
        const o = ctx.createOscillator(), len = e.pitch === 0 ? .21 : .28;
        o.type = e.pitch === 4 ? 'triangle' : 'sine';
        o.frequency.setValueAtTime(e.pitch === 0 ? 150 : 125, start);
        o.frequency.exponentialRampToValueAtTime(e.pitch === 0 ? 43 : 72, start + len * .65);
        g.gain.setValueAtTime(e.velocity * cfg.volume * (e.pitch === 0 ? .45 : .32), start);
        g.gain.exponentialRampToValueAtTime(.001, start + len);
        o.connect(g);
        o.start(start);
        o.stop(start + len);
    }
    else {
        const length = e.pitch === 2 ? .05 : e.pitch === 3 ? .28 : e.pitch === 6 ? .65 : .14, buf = ctx.createBuffer(1, Math.ceil(sr * length), sr), data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++)
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, e.pitch === 6 ? .7 : 1);
        const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
        filter.type = [2, 3, 6].includes(e.pitch) ? 'highpass' : 'bandpass';
        filter.frequency.value = e.pitch === 2 ? 6500 : e.pitch === 3 ? 4700 : e.pitch === 6 ? 3500 : e.pitch === 5 ? 2400 : 1800;
        g.gain.setValueAtTime(e.velocity * cfg.volume * (e.pitch === 2 ? .2 : e.pitch === 6 ? .3 : .24), start);
        g.gain.exponentialRampToValueAtTime(.001, start + length);
        source.buffer = buf;
        source.connect(filter).connect(g);
        source.start(start);
    } };
    const soloActive = TRACKS.some(track => project.tracks[track].solo);
    for (const e of events)
        if (!project.tracks[e.track].mute && (!soloActive || project.tracks[e.track].solo))
            e.track === 'drums' ? drumEvent(e, project.tracks.drums) : e.track === 'guitar' ? guitarEvent(e, project.tracks.guitar) : toneEvent(e, project.tracks[e.track]);
    return wavBlob(await ctx.startRendering());
}
