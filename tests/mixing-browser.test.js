import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {launchBrowser,preview,goToView} from './browser-support.js';
import axe from 'axe-core';
const server=preview(4254);after(()=>server.close());
test('shared audio DSP preserves neutral samples, separates clip effects and keeps effect tails',async t=>{
 await server.ready();const browser=await launchBrowser();t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(server.url+'/?qa=1');
 const result=await page.evaluate(async()=>{
  const {AudioFx,processAudio,normalizeEffects}=await import('/audio.js');
  const rate=8000,buffer=new globalThis.AudioBuffer({numberOfChannels:1,length:4000,sampleRate:rate});const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=.15*Math.sin(i/rate*2*Math.PI*440);
  const clean=await processAudio(buffer,normalizeEffects(),0),wet=await processAudio(buffer,normalizeEffects({delay:.8}),1),distorted=await processAudio(buffer,normalizeEffects({distortion:.7}),0),bypass=await processAudio(buffer,normalizeEffects({distortion:.7,bypass:true}),0);
  const diff=(a,b)=>a.reduce((sum,n,i)=>sum+Math.abs(n-b[i]),0)/a.length;
  const ctx=new globalThis.OfflineAudioContext(1,16000,8000),source=ctx.createBufferSource();source.buffer=buffer;const graph=new AudioFx(ctx,normalizeEffects({delay:.6}));source.connect(graph.input);graph.output.connect(ctx.destination);source.start();await ctx.startRendering();graph.dispose();graph.dispose();
  return {neutral:diff(data,clean.getChannelData(0)),distorted:diff(data,distorted.getChannelData(0)),bypass:diff(data,bypass.getChannelData(0)),tail:wet.getChannelData(0).slice(4000).reduce((sum,n)=>sum+n*n,0)};
 });
 assert.ok(result.neutral<1e-6,JSON.stringify(result));assert.ok(result.distorted>.01);assert.ok(result.bypass<.01);assert.ok(result.tail>.001);
});
test('mobile audio effects and level controls persist, undo and stay within the viewport',async t=>{
 await server.ready();const browser=await launchBrowser();t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(server.url+'/?qa=1');
 await page.evaluate(async()=>{const {createEmptyProject,createAudioLane,createAudioRegion}=await import('/core.js');const p=createEmptyProject();const lane=createAudioLane('AI voice');lane.regions.push(createAudioRegion('missing','Phrase'));p.audioLanes.push(lane);globalThis.localStorage.setItem('kiber-vengance-project-v6',JSON.stringify(p));});
 await page.reload();await page.locator('#missingAssetsDialog button').filter({hasText:/Close|Cerrar/}).click();await goToView(page,'audio');await page.locator('.audio-lane').first().waitFor();
 const effects=page.locator('.audio-region .audio-fx');await effects.locator('summary').click();await effects.locator('select').selectOption('radio');await effects.getByRole('button',{name:'Processed',exact:true}).click();assert.equal(await effects.getByRole('button',{name:'Original · bypass',exact:true}).getAttribute('aria-pressed'),'true');
 await goToView(page,'mix');assert.equal(await page.locator('.audio-mixer-channel').count(),1);
 const master=page.locator('#finalMasterControl input[type=number]');await master.fill('-6');await master.press('Tab');assert.match(await page.locator('#finalMasterControl output').textContent(),/-6.0/);
 const mute=page.locator('#outputMute');await mute.click();assert.equal(await mute.getAttribute('aria-pressed'),'true');
 await page.waitForTimeout(500);await page.reload();await page.locator('#missingAssetsDialog button').filter({hasText:/Close|Cerrar/}).click();await goToView(page,'mix');assert.match(await page.locator('#finalMasterControl output').textContent(),/-6.0/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=globalThis.innerWidth),true);assert.deepEqual(errors,[]);
 await page.addScriptTag({content:axe.source});const violations=await page.evaluate(async()=> (await axe.run(document.querySelector('.output-mix'))).violations.map(v=>v.id));assert.deepEqual(violations,[]);
});
test('final Master controls deck audio and excludes preview while Cue stays independent',async t=>{
 await server.ready();const browser=await launchBrowser();t.after(()=>browser.close());const page=await browser.newPage();await page.goto(server.url+'/?qa=1');
 const result=await page.evaluate(async()=>{
  const {AudioEngine}=await import('/audio.js'),{createEmptyProject}=await import('/core.js');const engine=new AudioEngine(),project=createEmptyProject();project.masterSettings.bypass=true;project.outputMix.master=0;project.sampler.gain=.25;engine.project=project;await engine.init();const boot={master:engine.finalGain.gain.value,sampler:engine.samplerOutput.gain.value};project.outputMix.master=1;engine.setProject(project);
  engine.setScratchMix(1);engine.setScratchCrossfade(0);engine.setScratchCue('A');
  const source=engine.ctx.createOscillator();source.frequency.value=220;source.connect(engine.deck('A').filter);source.start();
  const rms=()=>{const data=new Float32Array(engine.analyser.fftSize);engine.analyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,n)=>sum+n*n,0)/data.length);};
  const wait=async()=>{const start=engine.ctx.currentTime;const wall=Date.now();while(engine.ctx.currentTime-start<.3){if(Date.now()-wall>15000)throw Error(`Audio clock stalled: ${engine.ctx.state}`);await new Promise(resolve=>setTimeout(resolve,20));}};await wait();const deck=rms();project.outputMix.master=0;engine.setProject(project);await wait();const silent=rms(),cue=engine.deck('A').cueGain.gain.value;
  source.stop();project.outputMix.master=1;engine.setProject(project);const preview=engine.ctx.createOscillator();preview.connect(engine.previewGain);preview.start();await wait();const previewExcluded=rms();preview.stop();await engine.ctx.close();return {deck,silent,cue,previewExcluded,boot};
 });assert.equal(result.boot.master,0);assert.equal(result.boot.sampler,.25);assert.ok(result.deck>.1,JSON.stringify(result));assert.ok(result.silent<.001,JSON.stringify(result));assert.equal(result.cue,1);assert.ok(result.previewExcluded<.001,JSON.stringify(result));
});
test('expressive speech settings and selected treatment survive insertion and reload (protocol fixture)',async t=>{
 await server.ready();const browser=await launchBrowser();t.after(()=>browser.close());const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const page=await context.newPage();
 const fixture=`self.onmessage=({data})=>{if(data.kind==='load')self.postMessage({kind:'loaded'});if(data.kind==='generate'){const pcm=new Float32Array(24000);for(let i=0;i<pcm.length;i++)pcm[i]=.1*Math.sin(i*.05);self.postMessage({kind:'audio',pcm,sampleRate:24000,phonemes:''});}}`;
 await context.route('**/chatterbox-worker-*.js',route=>route.fulfill({contentType:'text/javascript',body:fixture}));await page.goto(server.url+'/?qa=1');await goToView(page,'audio');await page.locator('#localVoiceBtn').click();await page.locator('#voiceEngine').selectOption('chatterbox');await page.locator('#voiceLanguage').selectOption('es');await page.locator('#voiceIntensity').fill('0.8');await page.locator('#voiceText').fill('Voz de prueba.');await page.locator('#loadLocalVoice').click();await page.waitForFunction(()=>!document.querySelector('#generateLocalVoice').disabled);await page.locator('#generateLocalVoice').click();await page.locator('#voicePreview').waitFor();
 await page.locator('#localVoiceDialog .audio-fx summary').click();await page.locator('#localVoiceDialog .audio-fx select').selectOption('radio');await page.locator('#insertLocalVoice').click();await page.waitForFunction(()=>!document.querySelector('#loadLocalVoice').disabled);await page.locator('#localVoiceDialog header button').click();await page.waitForTimeout(500);
 const stored=await page.evaluate(()=>JSON.parse(globalThis.localStorage.getItem('kiber-vengance-project-v6')).audioLanes.at(-1).regions.at(-1));assert.equal(stored.generation.engine,'chatterbox');assert.equal(stored.generation.voice,'default');assert.equal(stored.generation.intensity,.8);assert.equal(stored.effects.filter,.42);assert.ok(stored.generation.revision);
 await page.reload();await goToView(page,'audio');assert.ok(await page.locator('.audio-region').count());
});
test('WAV export applies independent region and lane FX, honors dry and final Master without altering sources',async t=>{
 await server.ready();const browser=await launchBrowser();t.after(()=>browser.close());const page=await browser.newPage();await page.goto(server.url+'/?qa=1');
 const result=await page.evaluate(async()=>{
  const {createEmptyProject,createAudioLane,createAudioRegion}=await import('/core.js'),{renderWav,normalizeEffects}=await import('/audio.js');const p=createEmptyProject();p.clips.forEach(clip=>clip.bars=1);p.swing=0;p.tempo=120;p.tempoMap=[];p.master=1;p.masterSettings.bypass=true;
  const buffer=new globalThis.AudioBuffer({numberOfChannels:1,length:8000,sampleRate:8000});const source=buffer.getChannelData(0);for(let i=0;i<source.length;i++)source[i]=.12*Math.sin(i*2*Math.PI*220/8000);const original=Array.from(source);
  const lane=createAudioLane('Voice'),region=createAudioRegion('source','Phrase',0,8,1);lane.regions.push(region);p.audioLanes.push(lane);
  const measure=async(dry=false)=>{const blob=await renderWav(p,{song:true,bitDepth:32,normalize:false,sampleRate:8000,tailSeconds:1,dry,audioAssets:new Map([['source',buffer]])});const data=new DataView(await blob.arrayBuffer());let body=0,tail=0;for(let i=44;i<data.byteLength;i+=8){const n=data.getFloat32(i,true);if((i-44)/8<8000)body+=n*n;else tail+=n*n;}return {body,tail};};
  const clean=await measure();region.effects=normalizeEffects({delay:.8});lane.effects=normalizeEffects({distortion:.5});const wet=await measure(),dry=await measure(true);p.outputMix.master=0;const muted=await measure();return {clean,wet,dry,muted,unchanged:source.every((n,i)=>n===original[i])};
 });assert.ok(result.clean.body>.1);assert.ok(result.wet.tail>.01);assert.ok(result.wet.body>result.clean.body);assert.ok(Math.abs(result.dry.body-result.clean.body)<.00001);assert.equal(result.muted.body,0);assert.equal(result.muted.tail,0);assert.equal(result.unchanged,true);
});
