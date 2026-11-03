import { zipSync } from "fflate";
import { access, readFile, writeFile, readdir, unlink, stat, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const required=['index.html','core.js','audio.js','scratch-worklet.js','manifest.webmanifest','icon.svg'];
for(const file of required)await access(resolve('dist',file));
const html=await readFile('dist/index.html','utf8');if(!html.includes('КИБЕР VENGANCE'))throw new Error('Missing brand');
// CPU inference explicitly selects the standard ONNX WASM factory and binary.
// Transformers also emits its unused asyncify variant, which exceeds Sites' 25 MiB asset limit.
for(const file of await readdir('dist/assets'))if(/^ort-wasm-simd-threaded\.asyncify-.*\.wasm$/.test(file))await unlink(resolve('dist/assets',file));
// Sites limits individual files to 25 MiB. Optional GPU OMR assembles verified chunks in its worker.
for(const file of await readdir('dist/assets'))if(/^ort-wasm-simd-threaded\.jsep-.*\.wasm$/.test(file)){
  const path=resolve('dist/assets',file),bytes=await readFile(path);
  if(bytes.length>25*1024*1024){
    const parts=[];for(let start=0,index=0;start<bytes.length;start+=16*1024*1024,index++){
      const part=bytes.subarray(start,Math.min(bytes.length,start+16*1024*1024));
      await writeFile(path+'.part'+index,part);parts.push({bytes:part.length,sha256:createHash('sha256').update(part).digest('hex')});
    }
    await writeFile(path+'.json',JSON.stringify({bytes:bytes.length,parts}));await unlink(path);
  }
}
// Public corresponding-source offer, built from an explicit allowlist; no local credentials or user projects.
const sourceFiles = {};
for (const root of ['src', 'scripts', 'tests', 'public']) for (const file of await readdir(root, { recursive: true })) {
  const name = `${root}/${file}`;
  if (!/\.(ts|tsx|js|mjs|py|json|css|html|svg|txt|md|sh|toml|lock|musicxml|abc)$/.test(file) && !/(^|\/)LICENSE$/.test(file)) continue;
  if ((await stat(name)).isFile()) sourceFiles[name] = new Uint8Array(await readFile(name));
}
for (const file of ['LICENSE', 'README.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.runtime.json', 'vite.config.ts', 'index.html', 'eslint.config.js']) sourceFiles[file] = new Uint8Array(await readFile(file));
await mkdir('dist/source', { recursive: true });
await writeFile('dist/source/studio-source.zip', zipSync(sourceFiles, { level: 6 }));
for(const file of await readdir('dist',{recursive:true})){
  const entry=await stat(resolve('dist',file));
  if(entry.isFile()&&entry.size>25*1024*1024)throw new Error(`Site asset exceeds 25 MiB: ${file}`);
}
const files=(await readdir('dist',{recursive:true})).filter(file=>/(\.(html|js|css|svg|webmanifest)$|^assets\/ogg-.*\.wasm$|^third-party-audio-notices\.txt$)/.test(file)&&file!=='sw.js');
const digest=createHash('sha256');for(const file of files)digest.update(await readFile(`dist/${file}`));
const version=digest.digest('hex').slice(0,12);
// Optional inference runtime is cached only after the user explicitly loads it.
const manifest=JSON.parse(await readFile('dist/.vite/manifest.json','utf8'));
const initial=new Set(['index.html','manifest.webmanifest','icon.svg','scratch-worklet.js']);
function include(key){const entry=manifest[key];if(!entry||initial.has(entry.file))return;initial.add(entry.file);for(const css of entry.css||[])initial.add(css);for(const child of entry.imports||[])include(child);}
for(const [key,entry] of Object.entries(manifest))if(entry.isEntry&&['studio','core','audio','melody','presets','composer','recipes'].includes(entry.name)||key==='src/app.ts'||key==='src/audio/ogg.ts')include(key);
for(const file of files)if(/^assets\/(project-store-worker|scratch-worklet|wav-worker|ogg-worker)-/.test(file)||/^assets\/ogg-.*\.wasm$/.test(file)||file==='third-party-audio-notices.txt')initial.add(file);
const precache=[...initial];
await writeFile('dist/sw.js',`const CACHE='kv-studio-${version}';const ASSETS=${JSON.stringify(precache.map(f=>'./'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('kv-studio-')||k.startsWith('kiber-vengance-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin||new URL(e.request.url).pathname.includes('/soundfonts/'))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(async()=>{const hit=await caches.match(e.request);if(hit)return hit;if(e.request.mode==='navigate')return caches.match('./index.html');return Response.error()}))});`);
console.log(`Studio build verified: ${files.length} assets, offline cache ${version}`);
