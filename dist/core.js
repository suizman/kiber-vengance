export const PROJECT_VERSION = 4;
export const STEPS_PER_BAR = 16;
export const STEPS = STEPS_PER_BAR;
export const TRACKS = ['lead', 'guitar', 'bass', 'pad', 'drums'];
export const TRACK_META = {
    lead: { label: 'VOLT LEAD', color: '#ff3bd4', base: 60, low: 48, high: 96 }, guitar: { label: 'NEON GUITAR', color: '#ff9f43', base: 52, low: 40, high: 88 }, bass: { label: 'IRON BASS', color: '#2ee8ff', base: 36, low: 24, high: 67 },
    pad: { label: 'ASH VEIL', color: '#8b7cff', base: 48, low: 36, high: 84 }, drums: { label: 'IMPACT RIG', color: '#a7ff5b', base: 0, low: 0, high: 6 }
};
export const DRUM_NAMES = ['KICK', 'SNARE', 'CLOSED HAT', 'OPEN HAT', 'TOM', 'PERC', 'CRASH'];
export const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harmonicMinor: [0, 2, 3, 5, 7, 8, 11] };
export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function cryptoId() { return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2); }
export function makeNote(step, pitch, length = 1, velocity = .8, offset = 0, expression = {}) { return { id: cryptoId(), step, pitch, length, velocity, offset, expression: { pressure: velocity, timbre: .5, bend: 0, ...expression } }; }
export function createClip(track, name = 'New Clip', bars = 2, stepsPerBar = STEPS_PER_BAR) { return { id: cryptoId(), track, name, bars, stepsPerBar, notes: [], automation: { cutoff: {}, volume: {}, pan: {} }, character: characterDefaults(track) }; }
export function clipLengthSteps(clip) { return Math.max(1, clip.bars) * Math.max(1, clip.stepsPerBar || STEPS_PER_BAR); }
export function meterSteps(meter = { beats: 4, unit: 4 }) { return Math.max(1, meter.beats) * (meter.unit === 8 ? 2 : 4); }
export function frequency(midi) { return 440 * 2 ** ((midi - 69) / 12); }
export function secondsPerStep(tempo) { return 60 / tempo / 4; }
export function stepWithSwing(step, tempo, swing) { return step * secondsPerStep(tempo) + (step % 2 ? secondsPerStep(tempo) * swing : 0); }
export function activeClip(project, track) { return project.clips.find(c => c.id === project.activeClipIds[track]) || project.clips.find(c => c.track === track); }
export function clipsForTrack(project, track) { return project.clips.filter(c => c.track === track); }
export function isInScale(pitch, key, scale) { const root = Math.max(0, KEYS.indexOf(key)), degrees = SCALES[scale] || SCALES.minor; return degrees.includes(((pitch - root + 120) % 12)); }
function fx(distortion, saturation, chorus, delay, reverb, tone) { return { bypass: false, distortion, saturation, chorus, delay, reverb, tone }; }
const DEFAULT_MACROS = { energy: .72, darkness: .64, tension: .58, aggression: .68, space: .42, complexity: .56 };
export function characterDefaults(track) {
    const values = {
        lead: { arp: { enabled: false, mode: 'up', octaves: 1, rate: 1 }, lfo: { enabled: true, target: 'cutoff', rate: 2.2, depth: .12 }, fx: fx(.28, .18, .14, .18, .12, .58) },
        guitar: { arp: { enabled: false, mode: 'up', octaves: 1, rate: 1 }, lfo: { enabled: false, target: 'pitch', rate: 5.2, depth: .03 }, fx: fx(.34, .3, .12, .16, .18, .62) },
        bass: { arp: { enabled: false, mode: 'up', octaves: 1, rate: 1 }, lfo: { enabled: false, target: 'cutoff', rate: 1.5, depth: .08 }, fx: fx(.38, .3, .04, .02, .03, .38) },
        pad: { arp: { enabled: false, mode: 'updown', octaves: 2, rate: 1 }, lfo: { enabled: true, target: 'pan', rate: .18, depth: .32 }, fx: fx(.08, .1, .42, .32, .48, .52) },
        drums: { arp: { enabled: false, mode: 'up', octaves: 1, rate: 1 }, lfo: { enabled: false, target: 'cutoff', rate: 1, depth: 0 }, fx: fx(.2, .22, 0, .08, .16, .62) }
    };
    return { ...structuredClone(values[track]), macros: { ...DEFAULT_MACROS } };
}
function trackDefaults() {
    return {
        lead: { volume: .72, pan: .08, mute: false, solo: false, preset: 'Razor Choir', wave: 'sawtooth', osc2Wave: 'square', osc2Mix: .2, filterType: 'lowpass', cutoff: 4200, resonance: 4, attack: .015, decay: .11, sustain: .72, release: .22, glide: .04, unison: 2, detune: 7 },
        guitar: { volume: .7, pan: .12, mute: false, solo: false, preset: 'Chrome Strings', wave: 'triangle', osc2Wave: 'sawtooth', osc2Mix: .18, filterType: 'lowpass', cutoff: 5200, resonance: 2.4, attack: .003, decay: .24, sustain: .18, release: .38, glide: .015, unison: 1, detune: 4 },
        bass: { volume: .82, pan: 0, mute: false, solo: false, preset: 'Foundry Pulse', wave: 'square', osc2Wave: 'sine', osc2Mix: .28, filterType: 'lowpass', cutoff: 900, resonance: 6, attack: .008, decay: .08, sustain: .78, release: .14, glide: .02, unison: 1, detune: 3 },
        pad: { volume: .52, pan: -.1, mute: false, solo: false, preset: 'Afterlight', wave: 'triangle', osc2Wave: 'sawtooth', osc2Mix: .18, filterType: 'lowpass', cutoff: 2400, resonance: 2, attack: .45, decay: .65, sustain: .8, release: 1.8, glide: 0, unison: 2, detune: 5 },
        drums: { volume: .8, pan: 0, mute: false, solo: false, preset: 'Titan Frame' }
    };
}
function buildDemoClips() {
    const leadA = createClip('lead', 'Razor Motif', 2), leadB = createClip('lead', 'Ascension Lead', 4), guitarA = createClip('guitar', 'Chrome Chugs', 2), guitarB = createClip('guitar', 'Neon Ascension', 4), bassA = createClip('bass', 'Foundry Pulse', 2), bassB = createClip('bass', 'Reactor Drive', 4), padA = createClip('pad', 'Afterlight Chords', 4), padB = createClip('pad', 'Cathedral Rise', 4), drumsA = createClip('drums', 'Titan Frame', 2), drumsB = createClip('drums', 'Riot Assembly', 4);
    const notes = (data) => data.map(([step = 0, pitch = 0, length = 1, velocity = .8]) => makeNote(step, pitch, length, velocity));
    leadA.notes = notes([[0, 67, 2, .92], [3, 70, 1, .75], [4, 72, 2, .94], [7, 70, 1, .78], [8, 67, 2, .88], [11, 65, 1, .72], [12, 63, 2, .9], [15, 65, 1, .8], [16, 67, 3, .92], [20, 75, 2, .94], [24, 72, 4, .9], [29, 70, 2, .78]]);
    leadB.notes = notes([[0, 72, 2, .9], [4, 75, 2, .95], [8, 79, 4, 1], [14, 77, 2, .8], [16, 75, 2, .92], [20, 72, 2, .84], [24, 70, 4, .9], [30, 67, 2, .82], [32, 72, 1, .92], [34, 75, 1, .86], [36, 79, 2, 1], [40, 82, 4, .98], [48, 79, 4, .92], [56, 77, 2, .85], [60, 75, 4, .9]]);
    guitarA.notes = notes([[0, 52, 1.5, .94], [2, 52, 1.5, .72], [4, 55, 2, .9], [8, 52, 1.5, .94], [10, 58, 1.5, .82], [12, 55, 3, .88], [16, 52, 1.5, .96], [18, 52, 1.5, .74], [20, 60, 2, .92], [24, 58, 2, .86], [28, 55, 3, .9]]);
    guitarB.notes = notes([[0, 52, 2, .9], [3, 55, 1, .76], [4, 60, 2, .92], [7, 62, 1, .8], [8, 63, 4, .94], [16, 60, 2, .88], [20, 67, 3, .96], [24, 65, 2, .84], [28, 63, 4, .9], [32, 52, 1.5, .94], [34, 55, 1.5, .78], [36, 60, 2, .92], [40, 67, 4, .98], [48, 65, 3, .9], [56, 63, 2, .86], [60, 60, 4, .92]]);
    bassA.notes = notes([[0, 36, 3, .95], [4, 36, 3, .86], [8, 39, 3, .94], [12, 34, 3, .92], [16, 36, 3, .95], [20, 39, 3, .88], [24, 31, 3, .95], [28, 34, 3, .9]]);
    bassB.notes = Array.from({ length: 32 }, (_, i) => makeNote(i * 2, [36, 36, 39, 34, 31, 34, 36, 39][i % 8], 1.5, i % 4 === 0 ? .98 : .75));
    const addChords = (clip, data, velocity) => data.forEach(([step, chord]) => chord.forEach(pitch => clip.notes.push(makeNote(step, pitch, 16, velocity))));
    addChords(padA, [[0, [48, 55, 63]], [16, [51, 58, 67]], [32, [46, 53, 62]], [48, [43, 51, 58]]], .5);
    addChords(padB, [[0, [48, 55, 60]], [16, [53, 60, 65]], [32, [55, 62, 67]], [48, [51, 58, 63]]], .52);
    for (let s = 0; s < 32; s++) {
        if (s % 4 === 0)
            drumsA.notes.push(makeNote(s, 0, 1, .96));
        if (s % 8 === 4)
            drumsA.notes.push(makeNote(s, 1, 1, .86));
        if (s % 2 === 0)
            drumsA.notes.push(makeNote(s, 2, 1, s % 4 === 2 ? .58 : .42));
        if (s % 16 === 15)
            drumsA.notes.push(makeNote(s, 5, 1, .7));
    }
    for (let s = 0; s < 64; s++) {
        if (s % 4 === 0 || s % 16 === 14)
            drumsB.notes.push(makeNote(s, 0, 1, s % 4 === 0 ? .98 : .7));
        if (s % 8 === 4)
            drumsB.notes.push(makeNote(s, 1, 1, .9));
        if (s % 2 === 0 || s % 16 > 11)
            drumsB.notes.push(makeNote(s, 2, 1, s % 4 === 2 ? .62 : .4));
        if (s % 16 === 15)
            drumsB.notes.push(makeNote(s, s % 32 === 31 ? 6 : 5, 1, .8));
    }
    leadA.automation.cutoff = { 0: .35, 8: .62, 16: .42, 24: .8, 31: .5 };
    leadB.automation.cutoff = { 0: .3, 16: .55, 32: .75, 48: .9, 63: .65 };
    guitarB.automation.pan = { 0: .36, 16: .64, 32: .4, 48: .62 };
    padB.automation.volume = { 0: .35, 32: .7, 63: .9 };
    return [leadA, leadB, guitarA, guitarB, bassA, bassB, padA, padB, drumsA, drumsB];
}
export function createProject() {
    const clips = buildDemoClips(), by = (track, index = 0) => clipsForTrack({ clips }, track)[index].id, section = (name, indexes = {}, repeats = 1) => ({ id: cryptoId(), name, clipIds: Object.fromEntries(TRACKS.map(track => [track, by(track, indexes[track] || 0)])), repeats });
    return { version: PROJECT_VERSION, id: cryptoId(), title: 'Chrome Requiem', modifiedAt: Date.now(), tempo: 132, swing: .08, meter: { beats: 4, unit: 4 }, key: 'C', scale: 'minor', master: .78, tracks: trackDefaults(), clips, activeClipIds: Object.fromEntries(TRACKS.map(track => [track, by(track)])), arrangement: [section('IGNITION'), section('ASCENT', { guitar: 1, bass: 1, pad: 1 }), section('IMPACT', { lead: 1, guitar: 1, bass: 1, pad: 1, drums: 1 }, 2), section('AFTERMATH')], editor: { snap: 1, zoom: 32, pitchLow: 36, pitchHigh: 96, automationParam: 'cutoff', recordMode: 'quantized' } };
}
export function createEmptyProject() { const project = createProject(), clips = TRACKS.map(track => createClip(track, `${TRACK_META[track].label} 1`, 2)), clipIds = Object.fromEntries(clips.map(c => [c.track, c.id])); return { ...project, id: cryptoId(), title: 'Untitled Signal', modifiedAt: Date.now(), clips, activeClipIds: { ...clipIds }, arrangement: [{ id: cryptoId(), name: 'INTRO', clipIds: { ...clipIds }, repeats: 1 }] }; }
function normalizeClip(input, fallback) { const bars = Math.max(1, Math.min(8, +input.bars || 1)), stepsPerBar = Math.max(1, +input.stepsPerBar || STEPS_PER_BAR), automation = { cutoff: {}, volume: {}, pan: {}, ...input.automation }, base = fallback || characterDefaults(input.track), own = input.character || {}, character = { arp: { ...base.arp, ...own.arp }, lfo: { ...base.lfo, ...own.lfo }, fx: { ...base.fx, ...own.fx }, macros: { ...base.macros, ...own.macros } }; const notes = (Array.isArray(input.notes) ? input.notes : []).map((n) => ({ id: n.id || cryptoId(), step: Math.max(0, +n.step || 0), pitch: +n.pitch || 0, length: Math.max(.01, +n.length || 1), velocity: Math.max(.01, Math.min(1, +n.velocity || .8)), offset: Math.max(-.49, Math.min(.49, +n.offset || 0)), expression: { pressure: n.expression?.pressure ?? n.velocity ?? .8, timbre: n.expression?.timbre ?? .5, bend: n.expression?.bend ?? 0 } })); return { ...input, id: input.id, name: input.name, track: input.track, bars, stepsPerBar, notes, automation, character }; }
function legacyCharacter(source, track) { const base = characterDefaults(track), old = source.tracks?.[track] || {}, fxChain = { ...base.fx, ...old.fx }; if (old.drive != null && old.fx?.distortion == null)
    fxChain.distortion = old.drive; if (old.delay != null && old.fx?.delay == null)
    fxChain.delay = old.delay; return { arp: { ...base.arp, ...old.arp }, lfo: { ...base.lfo, ...old.lfo }, fx: fxChain, macros: { ...base.macros, ...source.macros } }; }
function migrateLegacy(raw, base) { if (!raw.patterns?.length)
    return base; const clips = [], map = new Map(); for (const pattern of raw.patterns) {
    const ids = {};
    for (const track of TRACKS) {
        const clip = createClip(track, `${pattern.name || 'Pattern'} · ${TRACK_META[track].label}`, pattern.bars || 1);
        clip.character = legacyCharacter(raw, track);
        clip.notes = (pattern.notes?.[track] || []).map(n => normalizeClip({ id: 'temp', name: 'temp', track, bars: 1, notes: [n] }, clip.character).notes[0]);
        clips.push(clip);
        ids[track] = clip.id;
    }
    map.set(pattern.id, ids);
} const active = map.get(raw.activePatternId || '') || map.values().next().value; return { ...base, ...raw, version: PROJECT_VERSION, clips, activeClipIds: active, arrangement: (raw.arrangement || []).map(s => ({ id: s.id || cryptoId(), name: s.name || 'SECTION', clipIds: map.get(s.patternId || '') || active, repeats: s.repeats || 1 })) }; }
export function migrateProject(value) { if (!value || typeof value !== 'object')
    throw new Error('Invalid Kiber Vengance project'); const base = createProject(), raw = value, source = raw.clips ? raw : migrateLegacy(raw, base), defaults = trackDefaults(), tracks = {}; for (const id of TRACKS) {
    const incoming = source.tracks?.[id] || defaults[id], { arp: _arp, lfo: _lfo, fx: _fx, drive: _drive, delay: _delay, ...instrument } = incoming;
    tracks[id] = { ...defaults[id], ...instrument };
} const clips = (source.clips || base.clips).map((c) => normalizeClip(c, legacyCharacter(source, c.track))); for (const track of TRACKS)
    if (!clips.some(c => c.track === track))
        clips.push(createClip(track, `${TRACK_META[track].label} 1`, 2, meterSteps(source.meter || base.meter))); const activeClipIds = { ...base.activeClipIds, ...source.activeClipIds }; for (const track of TRACKS)
    if (!clips.some(c => c.id === activeClipIds[track] && c.track === track))
        activeClipIds[track] = clips.find(c => c.track === track).id; const arrangement = (source.arrangement?.length ? source.arrangement : base.arrangement).map((s) => ({ id: s.id || cryptoId(), name: s.name || 'SECTION', clipIds: { ...activeClipIds, ...('clipIds' in s ? s.clipIds : {}) }, repeats: Math.max(1, Math.min(16, +s.repeats || 1)) })), { macros: _macros, ...cleanSource } = source; return { ...base, ...cleanSource, version: PROJECT_VERSION, modifiedAt: Date.now(), meter: { ...base.meter, ...source.meter }, tracks, clips, activeClipIds, arrangement, editor: { ...base.editor, ...source.editor } }; }
export function setProjectMeter(project, beats, unit) { const next = meterSteps({ beats, unit }), ratio = next / meterSteps(project.meter); for (const clip of project.clips) {
    clip.notes = clip.notes.map(n => ({ ...n, step: Math.round(n.step * ratio * 4) / 4, length: Math.max(.01, Math.round(n.length * ratio * 1000) / 1000), offset: n.offset * ratio }));
    for (const name of Object.keys(clip.automation)) {
        const lane = clip.automation[name];
        clip.automation[name] = Object.fromEntries(Object.entries(lane).map(([step, v]) => [Math.round(+step * ratio * 4) / 4, v]));
    }
    clip.stepsPerBar = next;
    resizeClip(clip, clip.bars);
} project.meter = { beats, unit }; return project; }
export function toggleNote(clip, step, pitch, velocity = .8, length = 1) { const i = clip.notes.findIndex(n => n.step === step && n.pitch === pitch); if (i >= 0)
    clip.notes.splice(i, 1);
else
    clip.notes.push(makeNote(step, pitch, length, velocity)); return i < 0; }
export function duplicateClip(project, id) { const source = project.clips.find(c => c.id === id); if (!source)
    return null; const copy = structuredClone(source); copy.id = cryptoId(); copy.name = `${source.name} V${clipsForTrack(project, source.track).length + 1}`; copy.notes.forEach(n => n.id = cryptoId()); project.clips.push(copy); project.activeClipIds[source.track] = copy.id; return copy; }
export function deleteClip(project, id) { const target = project.clips.find(c => c.id === id); if (!target)
    return null; const siblings = clipsForTrack(project, target.track).filter(c => c.id !== id); if (!siblings.length)
    return null; const replacement = siblings[0]; project.clips = project.clips.filter(c => c.id !== id); if (project.activeClipIds[target.track] === id)
    project.activeClipIds[target.track] = replacement.id; for (const scene of project.arrangement)
    if (scene.clipIds[target.track] === id)
        scene.clipIds[target.track] = replacement.id; return replacement; }
export function varyClip(project, clip, amount = .5) { const copy = structuredClone(clip); copy.id = cryptoId(); copy.name = `${clip.name} / MUTATION`; copy.notes.forEach(n => n.id = cryptoId()); const scale = SCALES[project.scale] || SCALES.minor, root = Math.max(0, KEYS.indexOf(project.key)), count = Math.max(1, Math.round(copy.notes.length * .2 * amount)); for (let i = 0; i < count; i++) {
    const src = copy.notes[(i * 7) % Math.max(1, copy.notes.length)];
    if (src) {
        const old = scale.indexOf(((src.pitch - root + 120) % 12)), degree = scale[((old < 0 ? 0 : old) + 2) % scale.length];
        copy.notes.push(makeNote((src.step + 3 + i * 4) % clipLengthSteps(copy), Math.floor(src.pitch / 12) * 12 + root + degree, src.length, Math.max(.3, src.velocity - .12)));
    }
} project.clips.push(copy); project.activeClipIds[clip.track] = copy.id; return copy; }
export function resizeClip(clip, bars) { clip.bars = Math.max(1, Math.min(8, +bars)); const max = clipLengthSteps(clip); clip.notes = clip.notes.filter(n => n.step < max).map(n => ({ ...n, length: Math.min(n.length, max - n.step) })); for (const lane of Object.values(clip.automation))
    for (const key of Object.keys(lane))
        if (+key >= max)
            delete lane[+key]; }
export function quantizeClip(clip, resolution = 1) { const max = clipLengthSteps(clip); for (const n of clip.notes) {
    n.step = Math.max(0, Math.min(max - resolution, Math.round((n.step + n.offset) / resolution) * resolution));
    n.offset = 0;
    n.length = Math.max(resolution, Math.round(n.length / resolution) * resolution);
} }
export function automationValue(clip, param, step, fallback = .5) { const lane = clip.automation[param], points = Object.keys(lane).map(Number).sort((a, b) => a - b); if (!points.length)
    return fallback; const s = ((step % clipLengthSteps(clip)) + clipLengthSteps(clip)) % clipLengthSteps(clip), left = points.filter(p => p <= s).at(-1) ?? points[0], right = points.find(p => p >= s) ?? points.at(-1); if (left === right)
    return lane[left]; return lane[left] + (lane[right] - lane[left]) * (s - left) / (right - left); }
export function notesAtStep(project, clip, track, step) { const local = ((step % clipLengthSteps(clip)) + clipLengthSteps(clip)) % clipLengthSteps(clip), arp = clip.character.arp; if (track === 'drums' || !arp.enabled)
    return clip.notes.filter(n => n.step === local); if (local % arp.rate !== 0)
    return []; const held = clip.notes.filter(n => n.step <= local && n.step + n.length > local).sort((a, b) => a.pitch - b.pitch); if (!held.length)
    return []; const span = held.length * Math.max(1, arp.octaves), phase = Math.floor(local / arp.rate); let index = phase % span; if (arp.mode === 'down')
    index = span - 1 - index; if (arp.mode === 'updown') {
    const cycle = Math.max(1, span * 2 - 2), p = phase % cycle;
    index = p < span ? p : cycle - p;
} if (arp.mode === 'random')
    index = (phase * 7 + 3) % span; const source = held[index % held.length], octave = Math.floor(index / held.length); return [{ ...source, id: `arp-${local}-${source.id}`, step: local, offset: 0, pitch: source.pitch + octave * 12, length: Math.max(.25, arp.rate * .82) }]; }
export function generateClip(project, clip, type = 'riff', intensity = .6) { const steps = clipLengthSteps(clip), root = Math.max(0, KEYS.indexOf(project.key)), scale = SCALES[project.scale] || SCALES.minor, base = TRACK_META[clip.track].base, degree = (i) => base + root + scale[(i + scale.length) % scale.length] + 12 * Math.floor(i / scale.length); clip.notes = []; if (type === 'chords') {
    const progression = project.scale === 'major' ? [0, 4, 5, 3] : [0, 5, 3, 6];
    for (let bar = 0; bar < clip.bars; bar++) {
        const d = progression[bar % progression.length], start = bar * clip.stepsPerBar;
        [d, d + 2, d + 4].forEach((x, i) => clip.notes.push(makeNote(start, degree(x), clip.stepsPerBar, .48 + i * .04)));
    }
}
else if (type === 'bass') {
    const progression = [0, 0, 5, 3];
    for (let s = 0; s < steps; s += intensity > .65 ? 2 : 4) {
        const d = progression[Math.floor(s / clip.stepsPerBar) % 4];
        clip.notes.push(makeNote(s, degree(d) - 12, intensity > .65 ? 1.5 : 3, s % clip.stepsPerBar === 0 ? .95 : .72));
    }
}
else if (type === 'drums') {
    for (let s = 0; s < steps; s++) {
        const bar = clip.stepsPerBar;
        if (s % 4 === 0 || intensity > .75 && s % bar === bar - 2)
            clip.notes.push(makeNote(s, 0, 1, .95));
        if (s % 8 === 4)
            clip.notes.push(makeNote(s, 1, 1, .86));
        if (s % (intensity > .55 ? 2 : 4) === 0)
            clip.notes.push(makeNote(s, 2, 1, s % 4 === 2 ? .58 : .4));
        if (s % bar === bar - 1 && intensity > .45)
            clip.notes.push(makeNote(s, intensity > .8 ? 3 : 5, 1, .72));
        if (intensity > .68 && s % bar === bar - 4)
            clip.notes.push(makeNote(s, 4, 1, .68));
        if (intensity > .9 && s % bar === 0)
            clip.notes.push(makeNote(s, 6, 1, .7));
    }
}
else {
    const rhythm = intensity > .72 ? 2 : 4, shape = [0, 2, 4, 7, 4, 2, 5, 3];
    for (let s = 0; s < steps; s += rhythm) {
        const i = Math.floor(s / rhythm), oct = i % 8 === 3 && intensity > .65 ? 12 : 0;
        clip.notes.push(makeNote(s, degree(shape[i % shape.length]) + oct, Math.max(1, rhythm * .75), s % clip.stepsPerBar === 0 ? .94 : .76));
    }
} return clip; }
export function generateBacking(project, { sections = 3, intensity = .68, style = 'cinematic' } = {}) {
    const count = Math.max(2, Math.min(6, Math.round(sections))), amount = Math.max(.2, Math.min(1, intensity)), names = { cinematic: ['AWAKENING', 'ASCENT', 'CLIMAX', 'AFTERMATH', 'RETURN', 'FINALE'], driving: ['COUNT IN', 'DRIVE', 'OVERLOAD', 'BREAKDOWN', 'REPRISE', 'FINAL HIT'], dark: ['SHADOW', 'PRESSURE', 'ABYSS', 'RITUAL', 'ECLIPSE', 'FALLOUT'] }[style], scenes = [];
    for (let index = 0; index < count; index++) {
        const curve = count === 1 ? amount : Math.max(.25, Math.min(1, amount * (.62 + .55 * index / (count - 1)))), clipIds = { ...project.activeClipIds };
        for (const [track, type] of [['bass', 'bass'], ['pad', 'chords'], ['drums', 'drums']]) {
            const generated = createClip(track, `${names[index] || `BASE ${index + 1}`} · ${TRACK_META[track].label}`, 4, meterSteps(project.meter));
            generateClip(project, generated, type, style === 'driving' ? Math.min(1, curve + .15) : style === 'dark' ? Math.min(1, curve + .06) : curve);
            if (style === 'dark' && track !== 'drums')
                for (const note of generated.notes)
                    note.velocity = Math.min(1, note.velocity * 1.08);
            project.clips.push(generated);
            clipIds[track] = generated.id;
            if (index === 0)
                project.activeClipIds[track] = generated.id;
        }
        scenes.push({ id: cryptoId(), name: names[index] || `BASE ${index + 1}`, clipIds, repeats: index === count - 1 && style === 'cinematic' ? 2 : 1 });
    }
    project.arrangement = scenes;
    return scenes;
}
export function sceneLengthSteps(project, scene) { return Math.max(...TRACKS.map(t => clipLengthSteps(project.clips.find(c => c.id === scene.clipIds[t]) || activeClip(project, t)))); }
export function playbackEvents(project, { song = true } = {}) { const events = []; let durationSteps = 0; const append = (clip, track, start, duration) => { const loops = Math.ceil(duration / clipLengthSteps(clip)); for (let loop = 0; loop < loops; loop++) {
    const loopStart = start + loop * clipLengthSteps(clip);
    if (clip.character.arp.enabled && track !== 'drums') {
        for (let s = 0; s < Math.min(duration - loop * clipLengthSteps(clip), clipLengthSteps(clip)); s++)
            for (const n of notesAtStep(project, clip, track, s))
                events.push({ track, step: loopStart + s, pitch: n.pitch, basePitch: n.pitch, length: n.length, velocity: n.velocity, expression: n.expression, clipId: clip.id, localStep: s });
    }
    else
        for (const n of clip.notes)
            if (loop * clipLengthSteps(clip) + n.step < duration)
                events.push({ track, step: loopStart + n.step + n.offset, pitch: n.pitch + n.expression.bend, basePitch: n.pitch, length: Math.min(n.length, duration - (loop * clipLengthSteps(clip) + n.step)), velocity: n.velocity * (.65 + n.expression.pressure * .35), expression: n.expression, clipId: clip.id, localStep: n.step });
} }; if (song) {
    for (const scene of project.arrangement) {
        const length = sceneLengthSteps(project, scene);
        for (let r = 0; r < scene.repeats; r++) {
            for (const track of TRACKS)
                append(project.clips.find(c => c.id === scene.clipIds[track]) || activeClip(project, track), track, durationSteps, length);
            durationSteps += length;
        }
    }
}
else {
    durationSteps = Math.max(...TRACKS.map(t => clipLengthSteps(activeClip(project, t))));
    for (const track of TRACKS)
        append(activeClip(project, track), track, 0, durationSteps);
} return { events, durationSteps }; }
const SECTION_NAMES = ['IGNITION', 'ASCENT', 'IMPACT', 'BREAKDOWN', 'AFTERMATH', 'REPRISE', 'OVERDRIVE', 'FALLOUT'];
export function addArrangementScene(project) { const last = project.arrangement.at(-1), clipIds = {}; for (const track of TRACKS) {
    const clips = clipsForTrack(project, track), i = Math.max(-1, clips.findIndex(c => c.id === last?.clipIds[track]));
    clipIds[track] = clips[(i + 1) % clips.length].id;
} const scene = { id: cryptoId(), name: SECTION_NAMES[project.arrangement.length] || `SIGNAL ${String(project.arrangement.length + 1).padStart(2, '0')}`, clipIds, repeats: 1 }; project.arrangement.push(scene); return scene; }
export function duplicateArrangementScene(project, index) { const source = project.arrangement[index]; if (!source)
    return null; const scene = { ...structuredClone(source), id: cryptoId(), name: `${source.name} COPY` }; project.arrangement.splice(index + 1, 0, scene); return scene; }
export function moveArrangementScene(project, from, to) { if (from < 0 || to < 0 || from >= project.arrangement.length || to >= project.arrangement.length || from === to)
    return false; const [scene] = project.arrangement.splice(from, 1); project.arrangement.splice(to, 0, scene); return true; }
export function removeArrangementScene(project, index) { if (project.arrangement.length <= 1 || index < 0 || index >= project.arrangement.length)
    return false; project.arrangement.splice(index, 1); return true; }
export function distributeArrangementPatterns(project) { for (const track of TRACKS) {
    const clips = clipsForTrack(project, track);
    if (!clips.length)
        return false;
    project.arrangement.forEach((scene, index) => scene.clipIds[track] = clips[index % clips.length].id);
} return true; }
function variable(n) { const a = [n & 127]; while (n >>= 7)
    a.unshift((n & 127) | 128); return a; }
function trackChunk(events, channel, drums = false) { const list = []; for (const n of events) {
    const midiChannel = drums ? 9 : channel, pitch = drums ? ([36, 38, 42, 46, 45, 39, 49][n.pitch] || 36) : Math.round(n.basePitch), start = Math.max(0, Math.round(n.step * 120)), end = Math.max(start + 1, Math.round((n.step + n.length) * 120));
    if (!drums) {
        const bend = Math.max(0, Math.min(16383, Math.round(8192 + n.expression.bend / 2 * 8192)));
        list.push({ t: start, order: 2, bytes: [0xe0 | midiChannel, bend & 127, bend >> 7] }, { t: start, order: 2, bytes: [0xb0 | midiChannel, 74, Math.round(n.expression.timbre * 127)] }, { t: start, order: 2, bytes: [0xd0 | midiChannel, Math.round(n.expression.pressure * 127)] }, { t: end, order: 1, bytes: [0xe0 | midiChannel, 0, 64] });
    }
    list.push({ t: start, order: 3, bytes: [0x90 | midiChannel, pitch, Math.max(1, Math.round(n.velocity * 127))] }, { t: end, order: 0, bytes: [0x80 | midiChannel, pitch, 0] });
} list.sort((a, b) => a.t - b.t || a.order - b.order); let last = 0; const data = []; for (const item of list) {
    data.push(...variable(item.t - last), ...item.bytes);
    last = item.t;
} data.push(0, 0xff, 0x2f, 0); return data; }
export function encodeMidi(project, { song = true } = {}) { const { events } = playbackEvents(project, { song }), chunks = [], u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255], u16 = (n) => [(n >>> 8) & 255, n & 255], tempo = Math.round(60000000 / project.tempo), unit = Math.log2(project.meter.unit), meta = [0, 0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255, 0, 0xff, 0x58, 4, project.meter.beats, unit, 24, 8, 0, 0xff, 0x2f, 0]; chunks.push(meta); TRACKS.forEach((track, i) => chunks.push(trackChunk(events.filter(e => e.track === track), i, track === 'drums'))); const bytes = [77, 84, 104, 100, ...u32(6), ...u16(1), ...u16(chunks.length), ...u16(480)]; for (const data of chunks)
    bytes.push(77, 84, 114, 107, ...u32(data.length), ...data); return new Uint8Array(bytes); }
export class History {
    limit;
    past = [];
    future = [];
    constructor(limit = 60) { this.limit = limit; }
    push(value) { this.past.push(structuredClone(value)); if (this.past.length > this.limit)
        this.past.shift(); this.future = []; }
    undo(current) { if (!this.past.length)
        return current; this.future.push(structuredClone(current)); return this.past.pop(); }
    redo(current) { if (!this.future.length)
        return current; this.past.push(structuredClone(current)); return this.future.pop(); }
}
