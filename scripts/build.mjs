import { access, readFile, writeFile, readdir, unlink, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const required=['index.html','core.js','audio.js','scratch-worklet.js','manifest.webmanifest','icon.svg'];
for(const file of required)await access(resolve('dist',file));
const html=await readFile('dist/index.html','utf8');if(!html.includes('КИБЕР VENGANCE'))throw new Error('Missing brand');
// CPU inference explicitly selects the standard ONNX WASM factory and binary.
// Transformers also emits its unused asyncify variant, which exceeds Sites' 25 MiB asset limit.
for(const file of await readdir('dist/assets'))if(/^ort-wasm-simd-threaded\.asyncify-.*\.wasm$/.test(file))await unlink(resolve('dist/assets',file));
for(const file of await readdir('dist',{recursive:true})){
  const entry=await stat(resolve('dist',file));
  if(entry.isFile()&&entry.size>25*1024*1024)throw new Error(`Site asset exceeds 25 MiB: ${file}`);
}
const files=(await readdir('dist',{recursive:true})).filter(file=>/\.(html|js|css|svg|webmanifest)$/.test(file)&&file!=='sw.js');
const digest=createHash('sha256');for(const file of files)digest.update(await readFile(`dist/${file}`));
const version=digest.digest('hex').slice(0,12);
// Optional inference runtime is cached only after the user explicitly loads it.
const precache=files.filter(file=>!/^assets\/(inference-worker-|cpu-worker-|voice-worker-|espeak-ng-|ort-wasm-)/.test(file));
await writeFile('dist/sw.js',`const CACHE='kv-studio-${version}';const ASSETS=${JSON.stringify(precache.map(f=>'./'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('kv-studio-')||k.startsWith('kiber-vengance-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(async()=>{const hit=await caches.match(e.request);if(hit)return hit;if(e.request.mode==='navigate')return caches.match('./index.html');return Response.error()}))});`);
console.log(`Studio build verified: ${files.length} assets, offline cache ${version}`);
