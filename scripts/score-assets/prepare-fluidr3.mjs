/** Offline, data-only conversion. No eval, vm, Function or script execution. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2);
const flag=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const root=flag('--root','.cache/score-assets');
const output=flag('--output',path.join(root,'prepared'));
const acornPath=flag('--acorn','acorn');
const {parse}=await import(acornPath.startsWith('/')?pathToFileURL(acornPath).href:acornPath);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const fields=new Set(['midi','originalPitch','keyRangeLow','keyRangeHigh','loopStart','loopEnd','coarseTune','fineTune','sampleRate','ahdsr','file','sample','anchor','delay','sustain','velocityRangeLow','velocityRangeHigh']);
function value(node){
 if(node.type==='Literal'&&['string','number','boolean'].includes(typeof node.value))return node.value;
 if(node.type==='Literal'&&node.value===null)return null;
 if(node.type==='UnaryExpression'&&node.operator==='-'&&node.argument.type==='Literal'&&typeof node.argument.value==='number')return -node.argument.value;
 if(node.type==='ArrayExpression')return node.elements.map(n=>{if(!n)throw Error('Array hole');return value(n)});
 if(node.type==='ObjectExpression'){
  const result=Object.create(null);
  for(const p of node.properties){
   if(p.type!=='Property'||p.computed||p.method||p.kind!=='init')throw Error('Executable or computed object property');
   const key=p.key.name??p.key.value;
   if(typeof key!=='string'||['__proto__','constructor','prototype'].includes(key)||Object.hasOwn(result,key))throw Error('Unsafe or duplicate property');
   result[key]=value(p.value);
  }
  return result;
 }
 throw Error(`Non-data syntax ${node.type}`);
}
function decode(text,expected){
 const tree=parse(text,{ecmaVersion:2020});
 const variables=tree.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations);
 if(variables.length!==1||variables[0].id.type!=='Identifier'||variables[0].id.name!==expected)throw Error('Unexpected variable declaration');
 for(const statement of tree.body){
  if(statement.type==='VariableDeclaration')continue;
  // Legacy diagnostic is ignored, never executed. Nothing else is accepted.
  const e=statement.expression;
  if(statement.type==='ExpressionStatement'&&e?.type==='CallExpression'&&e.callee.type==='MemberExpression'&&!e.callee.computed&&e.callee.object.name==='console'&&e.callee.property.name==='log'&&e.arguments.every(x=>x.type==='Literal'&&typeof x.value==='string'))continue;
  throw Error(`Unexpected statement ${statement.type}`);
 }
 const preset=value(variables[0].init);
 if(Object.keys(preset).some(k=>k!=='zones')||!Array.isArray(preset.zones)||!preset.zones.length)throw Error('Invalid preset shape');
 return preset;
}
const sources=JSON.parse(await fs.readFile(path.join(root,'fluid-source-lock.json'),'utf8'));
if(sources.assets.some(a=>a.error))throw Error('Some pinned source downloads failed');
// Conventional General MIDI Level 1 program names, zero-based order.
const names=["acoustic_grand_piano", "bright_acoustic_piano", "electric_grand_piano", "honkytonk_piano", "electric_piano_1", "electric_piano_2", "harpsichord", "clavinet", "celesta", "glockenspiel", "music_box", "vibraphone", "marimba", "xylophone", "tubular_bells", "dulcimer", "drawbar_organ", "percussive_organ", "rock_organ", "church_organ", "reed_organ", "accordion", "harmonica", "tango_accordion", "acoustic_guitar_nylon", "acoustic_guitar_steel", "electric_guitar_jazz", "electric_guitar_clean", "electric_guitar_muted", "overdriven_guitar", "distortion_guitar", "guitar_harmonics", "acoustic_bass", "electric_bass_finger", "electric_bass_pick", "fretless_bass", "slap_bass_1", "slap_bass_2", "synth_bass_1", "synth_bass_2", "violin", "viola", "cello", "contrabass", "tremolo_strings", "pizzicato_strings", "orchestral_harp", "timpani", "string_ensemble_1", "string_ensemble_2", "synth_strings_1", "synth_strings_2", "choir_aahs", "voice_oohs", "synth_choir", "orchestra_hit", "trumpet", "trombone", "tuba", "muted_trumpet", "french_horn", "brass_section", "synth_brass_1", "synth_brass_2", "soprano_sax", "alto_sax", "tenor_sax", "baritone_sax", "oboe", "english_horn", "bassoon", "clarinet", "piccolo", "flute", "recorder", "pan_flute", "blown_bottle", "shakuhachi", "whistle", "ocarina", "lead_1_square", "lead_2_sawtooth", "lead_3_calliope", "lead_4_chiff", "lead_5_charang", "lead_6_voice", "lead_7_fifths", "lead_8_bass__lead", "pad_1_new_age", "pad_2_warm", "pad_3_polysynth", "pad_4_choir", "pad_5_bowed", "pad_6_metallic", "pad_7_halo", "pad_8_sweep", "fx_1_rain", "fx_2_soundtrack", "fx_3_crystal", "fx_4_atmosphere", "fx_5_brightness", "fx_6_goblins", "fx_7_echoes", "fx_8_scifi", "sitar", "banjo", "shamisen", "koto", "kalimba", "bagpipe", "fiddle", "shanai", "tinkle_bell", "agogo", "steel_drums", "woodblock", "taiko_drum", "melodic_tom", "synth_drum", "reverse_cymbal", "guitar_fret_noise", "breath_noise", "seashore", "bird_tweet", "telephone_ring", "helicopter", "applause", "gunshot"];
const samples=new Map();
const manifest={schemaVersion:1,id:'fluidr3-gm-1',name:'FluidR3 General MIDI',license:'MIT',source:{repository:sources.repository,commit:sources.commit},attributions:['FluidR3 © 2000–2002, 2008 Frank Wen. Original README/COPYING included.','WebAudioFont data conversion © 2017 Srgy Surkv, MIT.'],samplePathBase:'manifest-directory',programs:[],drums:[],samples:[]};
for(const dir of ['programs','drums','samples','licenses'])await fs.mkdir(path.join(output,dir),{recursive:true});
for(const source of sources.assets){
 const bytes=await fs.readFile(source.sourcePath);
 if(hash(bytes)!==source.sourceSha256)throw Error(`Source hash mismatch: ${source.id}`);
 const variable=source.kind==='program'?`_tone_${String(source.number).padStart(3,'0')}0_FluidR3_GM_sf2_file`:`_drum_${source.number}_0_FluidR3_GM_sf2_file`;
 const preset=decode(bytes.toString('utf8'),variable);
 const zones=[];
 for(const [i,raw] of preset.zones.entries()){
  for(const k of Object.keys(raw))if(!fields.has(k))throw Error(`Unexpected zone field ${source.id}/${i}/${k}`);
  if(typeof raw.file!=='string'&&typeof raw.sample!=='string')throw Error('Missing sample bytes');
  const encoded=raw.file??raw.sample;
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw Error('Malformed base64');
  const binary=Buffer.from(encoded,'base64');
  if(binary.length===0||binary.toString('base64').replace(/=+$/,'')!==encoded.replace(/=+$/,''))throw Error('Non-canonical base64');
  const sha256=hash(binary),pcm=typeof raw.file!=='string';
  const magic=binary.subarray(0,4).toString('ascii');
  const format=pcm?'pcm-s16le':magic==='RIFF'?'wav':magic==='OggS'?'ogg':magic.startsWith('ID3')||(binary[0]===255&&(binary[1]&0xe0)===0xe0)?'mp3':null;
  if(!format)throw Error('Unknown audio codec');
  const samplePath=`samples/${sha256}.${pcm?'pcm':format}`;
  const sample={path:samplePath,sha256,bytes:binary.length,mime:format==='mp3'?'audio/mpeg':format==='wav'?'audio/wav':format==='ogg'?'audio/ogg':'audio/L16',format};
  if(!samples.has(sha256)){await fs.writeFile(path.join(output,samplePath),binary);samples.set(sha256,sample);}
  const zone={};
  for(const [k,v]of Object.entries(raw)){
   if(k==='file'||k==='sample')continue;
   if(k==='ahdsr'){
    if(typeof v!=='boolean'&&(!Array.isArray(v)||v.some(e=>Object.keys(e).some(k=>!['duration','volume'].includes(k))||!Number.isFinite(e.duration)||!Number.isFinite(e.volume)||e.duration<0||e.volume<0)))throw Error('Invalid envelope');
   }else if(!Number.isFinite(v))throw Error(`Invalid numeric metadata ${k}`);
   zone[k]=v;
  }
  if(zone.keyRangeLow<0||zone.keyRangeHigh>127||zone.keyRangeHigh<zone.keyRangeLow||zone.sampleRate<4000||zone.sampleRate>192000)throw Error('Invalid range/sample rate');
  zone.sample=sample;
  zones.push(zone);
 }
 const jsonPath=`${source.kind==='program'?'programs':'drums'}/${String(source.number).padStart(3,'0')}.json`;
 const record={schemaVersion:1,id:source.id,kind:source.kind,number:source.number,name:source.kind==='program'?names[source.number].replaceAll('_',' '):`GM percussion ${source.number}`,license:'MIT',source:{url:source.sourceUrl,sha256:source.sourceSha256,bytes:source.sourceBytes},zones};
 const json=Buffer.from(JSON.stringify(record,null,2)+'\n');await fs.writeFile(path.join(output,jsonPath),json);
 const unique=new Map(zones.map(z=>[z.sample.sha256,z.sample.bytes]));
 manifest[source.kind==='program'?'programs':'drums'].push({number:source.number,name:record.name,path:jsonPath,sha256:hash(json),metadataBytes:json.length,sampleBytes:[...unique.values()].reduce((a,b)=>a+b,0),zones:zones.length,sourceUrl:source.sourceUrl,sourceSha256:source.sourceSha256,sourceBytes:source.sourceBytes});
}
manifest.samples=[...samples.values()].sort((a,b)=>a.path.localeCompare(b.path));
manifest.totals={programs:manifest.programs.length,drums:manifest.drums.length,zones:manifest.programs.concat(manifest.drums).reduce((n,p)=>n+p.zones,0),uniqueSamples:samples.size,sampleBytes:[...samples.values()].reduce((n,s)=>n+s.bytes,0),metadataBytes:manifest.programs.concat(manifest.drums).reduce((n,p)=>n+p.metadataBytes,0)};
manifest.licenses=[];
for(const license of sources.licenseSources??[]){
 const original=await fs.readFile(license.sourcePath);
 if(hash(original)!==license.sourceSha256)throw Error('License hash mismatch');
 const text=original.toString(license.encoding==='latin-1'?'latin1':'utf8').replaceAll('\r\n','\n');
 const bytes=Buffer.from(text);const target='licenses/'+license.name;
 await fs.writeFile(path.join(output,target),bytes);
 manifest.licenses.push({path:target,bytes:bytes.length,sha256:hash(bytes),sourceUrl:license.url,sourceSha256:license.sourceSha256});
 if(license.name==='FluidR3-license-source.md'){
  const first=text.indexOf('README\n---');if(first<0)throw Error('Original FluidR3 license missing');
  const bytes=Buffer.from(text.slice(first));const target='licenses/FluidR3-original-README-COPYING.txt';
  await fs.writeFile(path.join(output,target),bytes);manifest.licenses.push({path:target,bytes:bytes.length,sha256:hash(bytes),sourceUrl:license.url,sourceSha256:license.sourceSha256});
 }
}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,...manifest.totals,manifestSha256:hash(await fs.readFile(path.join(output,'manifest.json')))}));
