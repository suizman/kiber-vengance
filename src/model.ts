export const trackIds = ['lead', 'guitar', 'bass', 'pad', 'drums'] as const;
export type TrackId = typeof trackIds[number];
export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'pulse' | 'metal';
export type FilterMode = 'lowpass' | 'highpass' | 'bandpass';
export type ArpMode = 'up' | 'down' | 'updown' | 'random';
export type AutomationParameter = 'cutoff' | 'volume' | 'pan';
export type SendMode = 'pre' | 'post';
export type PerformanceEventKind = 'macro'|'mixer'|'scratch'|'scene'|'launcher';

export interface NoteExpression { pressure:number; timbre:number; bend:number }
export interface NoteEvent { id:string; step:number; pitch:number; length:number; velocity:number; offset:number; expression:NoteExpression }
export interface Automation { cutoff:Record<number,number>; volume:Record<number,number>; pan:Record<number,number> }
export interface EffectChain { [key:string]:any; bypass:boolean; distortion:number; saturation:number; chorus:number; delay:number; reverb:number; tone:number }
export interface Arpeggiator { [key:string]:any; enabled:boolean; mode:ArpMode; octaves:number; rate:number }
export interface Modulation { [key:string]:any; enabled:boolean; target:'cutoff'|'pitch'|'pan'; rate:number; depth:number }
export interface MacroState { [key:string]:number; energy:number; darkness:number; tension:number; aggression:number; space:number; complexity:number }
export interface ClipCharacter { arp:Arpeggiator; lfo:Modulation; fx:EffectChain; macros:MacroState }
export interface Clip { id:string; track:TrackId; name:string; bars:number; stepsPerBar:number; notes:NoteEvent[]; automation:Automation; character:ClipCharacter }
export interface TrackState {
  volume:number; pan:number; mute:boolean; solo:boolean; preset:string; wave?:Waveform; osc2Wave?:Waveform|'off'; osc2Mix?:number;
  filterType?:FilterMode; cutoff?:number; resonance?:number; attack?:number; decay?:number; sustain?:number;
  release?:number; glide?:number; unison?:number; detune?:number; preGainDb:number; sendMode:SendMode; color:string;
}
export interface Scene { id:string; name:string; clipIds:Record<TrackId,string>; repeats:number }
export interface SongMarker { id:string; step:number; name:string; color:string }
export interface PerformanceEvent { id:string; step:number; kind:PerformanceEventKind; target:string; value:number|string|boolean }
export interface PerformanceTake { id:string; name:string; createdAt:number; durationSteps:number; trimStart:number; trimEnd:number; events:PerformanceEvent[]; audioAssetId?:string; mimeType?:string }
export interface SampleAsset { id:string; name:string; slot:number; size:number; type:string; trimStart:number; trimEnd:number; tune:number; attack:number; release:number; reverse:boolean }
export interface Project {
  version:5; id:string; title:string; modifiedAt:number; tempo:number; swing:number; meter:{beats:number;unit:4|8};
  key:string; scale:string; master:number;
  tracks:Record<TrackId,TrackState>; clips:Clip[]; activeClipIds:Record<TrackId,string>; arrangement:Scene[];
  editor:{snap:number;zoom:number;pitchLow:number;pitchHigh:number;automationParam:AutomationParameter;recordMode:'quantized'|'free';arrangeZoom:number};
  markers:SongMarker[]; loop:{enabled:boolean;start:number;end:number;punch:boolean}; launcher:{quantization:number};
  performanceTakes:PerformanceTake[]; samples:SampleAsset[]; masterSettings:{bypass:boolean};
}

export function isProject(value:unknown): value is Project {
  if (!value || typeof value !== 'object') return false;
  const candidate=value as Partial<Project>;
  return candidate.version===5 && typeof candidate.title==='string' && Array.isArray(candidate.clips) &&
    Array.isArray(candidate.arrangement) && trackIds.every(track=>typeof candidate.activeClipIds?.[track]==='string');
}
