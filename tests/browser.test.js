import { tmpdir } from "node:os";
import test from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, preview, goToView, setSoundInspector, setTransportSetting } from './browser-support.js';
import axe from 'axe-core';
import { readFileSync } from 'node:fs';

const server=preview(Number(process.env.BROWSER_TEST_PORT)||4201),{url,ready}=server;
function silentWav(seconds=1){const frames=8000*seconds,buffer=Buffer.alloc(44+frames*2);buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(8000,24);buffer.writeUInt32LE(16000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(frames*2,40);return buffer}

test('Chromium desktop and mobile flows are responsive and accessible',async t=>{
  await ready();const browser=await launchBrowser();t.after(async()=>{await browser.close()});
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});await page.locator('.note-block').first().waitFor();
    assert.equal(await page.locator('.track').count(),5);assert.ok(await page.locator('.pitch-label').count()>=40);await page.locator('[data-solo="lead"]').click();assert.equal(await page.locator('.solo.on').count(),1);assert.equal(await page.locator('[data-solo="lead"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.track.solo-muted').count(),4);await page.locator('[data-solo="guitar"]').click();assert.equal(await page.locator('.solo.on').count(),1);assert.equal(await page.locator('[data-solo="lead"]').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('[data-solo="guitar"]').getAttribute('aria-pressed'),'true');await page.locator('[data-solo="guitar"]').click();assert.equal(await page.locator('.solo.on').count(),0);await page.keyboard.press('Control+k');await page.locator('#commandSearch').fill('solo');assert.match(await page.locator('.command-item').first().textContent(),/Solo/);await page.keyboard.press('Enter');assert.equal(await page.locator('[data-solo="lead"]').getAttribute('aria-pressed'),'true');await page.locator('[data-solo="lead"]').click();assert.equal(await page.locator('.solo.on').count(),0);
    assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.ok(await page.locator('[data-help-body]').count()>0);await page.locator('#tutorialBtn').click();assert.equal(await page.locator('#tutorialDialog').evaluate(dialog=>dialog.open),true);await page.locator('.tutorial-target').waitFor();assert.equal(await page.locator('.tutorial-target').count(),1);await page.locator('#tutorialNext').click();assert.match(await page.locator('#tutorialStepLabel').textContent(),/2 \/ 7/);await page.locator('#tutorialExit').click();await page.locator('#helpBtn').click();await page.locator('#playBtn').hover();assert.match(await page.locator('#contextHelpBody').textContent(),/active clip/);await page.locator('#contextHelpClose').click();const languageControl=viewport.width<500?'#menuLanguageSelect':'#languageSelect';if(viewport.width<500)await page.locator('#menuBtn').click();await page.locator(languageControl).selectOption('es');if(viewport.width<500)await page.locator('#projectMenu [data-close]').click();assert.equal(await page.locator('html').getAttribute('lang'),'es');assert.match(await page.locator('[data-space="arrange"]').first().textContent(),/arregl/i);await setSoundInspector(page,true);assert.match(await page.locator('.knob').first().getAttribute('aria-description'),/Arrastra/);await setSoundInspector(page,false);if(viewport.width<500)await page.locator('#menuBtn').click();await page.locator(languageControl).selectOption('en');if(viewport.width<500)await page.locator('#projectMenu [data-close]').click();
    await setSoundInspector(page,false);await page.keyboard.press('Control+k');assert.equal(await page.locator('#commandDialog').evaluate(dialog=>dialog.open),true);await page.locator('#commandSearch').fill('focus');await page.keyboard.press('Enter');assert.equal(await page.locator('body').evaluate(body=>body.classList.contains('focus-mode')),true);await page.getByRole('button',{name:'Exit expanded view'}).click();await page.waitForFunction(()=>!document.body.classList.contains('focus-mode'));assert.equal(await page.locator('body').evaluate(body=>body.classList.contains('focus-mode')),false);
    const clipCount=await page.locator('#clipSelect option').count();await page.locator('#duplicateBtn').click();assert.equal(await page.locator('#clipSelect option').count(),clipCount+1);await page.locator('#clipSelect').selectOption({index:0});await page.locator('#deleteClipBtn').click();assert.equal(await page.locator('#deleteClipDialog').evaluate(dialog=>dialog.open),true);assert.match(await page.locator('#deleteClipDescription').textContent(),/arrangement section/);await page.locator('#confirmDeleteClipBtn').click();assert.equal(await page.locator('#clipSelect option').count(),clipCount);await page.locator('#undoBtn').click();assert.equal(await page.locator('#clipSelect option').count(),clipCount+1);await page.locator('#redoBtn').click();assert.equal(await page.locator('#clipSelect option').count(),clipCount);
    if(viewport.width>500){await page.evaluate(()=>{const seq=document.querySelector('#sequencer'),rect=seq.getBoundingClientRect(),event=(type,x,y)=>new globalThis.PointerEvent(type,{bubbles:true,pointerType:'mouse',pointerId:9,button:0,buttons:type==='pointerup'?0:1,clientX:rect.left+x,clientY:rect.top+y});seq.dispatchEvent(event('pointerdown',2,2));globalThis.dispatchEvent(event('pointermove',seq.clientWidth-2,seq.clientHeight-2));globalThis.dispatchEvent(event('pointerup',seq.clientWidth-2,seq.clientHeight-2))});assert.equal(await page.locator('.note-block.selected').count(),await page.locator('.note-block').count());assert.match(await page.locator('#selectionCount').textContent(),/notes/i) }
    if(viewport.width<500){assert.equal(await page.locator('#menuBtn').isVisible(),true);await page.locator('#menuBtn').click();assert.equal(await page.locator('#menuLanguageSelect').isVisible(),true);await page.locator('#projectMenu [data-close]').click();await setSoundInspector(page,true);const knobValue=await page.locator('.knob-control output').first().textContent();await page.locator('.knob-control .knob-nudge[aria-label^="Increase"]').first().click();assert.notEqual(await page.locator('.knob-control output').first().textContent(),knobValue);if(await page.locator('#effectsRack').evaluate(rack=>rack.classList.contains('collapsed')))await page.locator('[data-rack="effectsRack"]').click();assert.equal(await page.locator('#effectsRack').evaluate(rack=>rack.classList.contains('collapsed')),false);await setSoundInspector(page,false)}
    assert.equal(await page.locator('[data-fx="saturation"]').count(),1);await setTransportSetting(page,'recordMode','free');assert.equal(await page.locator('#recordMode').inputValue(),'free');
    await setSoundInspector(page,true);await page.locator('#waveSelect').selectOption('pulse');assert.equal(await page.locator('#waveSelect').inputValue(),'pulse');
    await setTransportSetting(page,'meterSelect','3/4');assert.match(await page.locator('#rollRuler').innerText(),/BAR 2/);
    await goToView(page,'arrange');assert.equal(await page.locator('.scene-clips select').count(),20);
    await goToView(page,'forge');await page.locator('.track[data-track="guitar"]').click();assert.equal(await page.locator('.track.active').getAttribute('data-track'),'guitar');assert.equal(await page.locator('#preset option').count(),3);await page.locator('.composition-options summary').click();await page.locator('#backingBtn').click();assert.equal(await page.locator('#backingDialog').evaluate(dialog=>dialog.open),true);await page.locator('#backingSections').selectOption('2');await page.locator('#generateBackingBtn').click();assert.equal(await page.locator('#arrangeView').getAttribute('hidden'),null);assert.equal(await page.locator('.scene').count(),2);assert.equal(await page.locator('.scene-clips select').count(),10);
    await page.addScriptTag({content:axe.source});await page.keyboard.press('Control+k');const paletteAudit=await page.evaluate(async()=>await globalThis.axe.run(document));assert.deepEqual(paletteAudit.violations.filter(v=>['serious','critical'].includes(v.impact)).flatMap(v=>v.nodes.map(n=>`${v.id}: ${n.target.join(' > ')}`)),[]);await page.keyboard.press('Escape');const audit=await page.evaluate(async()=>await globalThis.axe.run(document));
    const serious=audit.violations.filter(v=>['serious','critical'].includes(v.impact));assert.deepEqual(serious.flatMap(v=>v.nodes.map(n=>`${v.id}: ${n.target.join(' > ')} — ${n.failureSummary}`)),[]);
    assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=document.documentElement.clientWidth),true);
    assert.deepEqual(errors,[]);await page.close();
  }
});

test('motion, effects and vector controls belong to the active clip',async t=>{
  await ready();const browser=await launchBrowser();t.after(async()=>{await browser.close()});const page=await browser.newPage({viewport:{width:1280,height:900}});await page.addInitScript(()=>Object.defineProperty(globalThis,'showSaveFilePicker',{value:undefined,configurable:true}));await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});await page.locator('.note-block').first().waitFor();
  await page.locator('#exportAsBtn').click();assert.equal(await page.locator('#exportDialog').evaluate(dialog=>dialog.open),true);await page.locator('.export-advanced').nth(1).locator('summary').click();const midiDownloadPromise=page.waitForEvent('download');await page.locator('[data-export="midi"]').click();const midiDownload=await midiDownloadPromise;assert.match(midiDownload.suggestedFilename(),/-song\.mid$/);const projectDownloadPromise=page.waitForEvent('download');await page.locator('[data-export="project"]').click();const projectDownload=await projectDownloadPromise;assert.match(projectDownload.suggestedFilename(),/\.kiber\.json$/);assert.equal(await page.locator('[data-export="wav"]').isEnabled(),true);await page.locator('#exportDialog [data-close]').click();
  const first=await page.locator('#clipSelect').inputValue(),second=await page.locator('#clipSelect option').nth(1).getAttribute('value');assert.ok(second);await setSoundInspector(page,true);
  await page.locator('#arpEnabled').check();await page.locator('#lfoEnabled').uncheck();await page.locator('[data-fx="delay"]').evaluate(input=>{input.value='.91';input.dispatchEvent(new globalThis.Event('input',{bubbles:true}));input.dispatchEvent(new globalThis.Event('change',{bubbles:true}))});await page.locator('#macros [data-macro="space"]').evaluate(input=>{input.value='.93';input.dispatchEvent(new globalThis.Event('input',{bubbles:true}));input.dispatchEvent(new globalThis.Event('change',{bubbles:true}))});
  await page.locator('#clipSelect').selectOption(second);assert.equal(await page.locator('#arpEnabled').isChecked(),false);assert.notEqual(await page.locator('[data-fx="delay"]').inputValue(),'0.91');assert.notEqual(await page.locator('#macros [data-macro="space"]').inputValue(),'0.93');
  await page.locator('#clipSelect').selectOption(first);assert.equal(await page.locator('#arpEnabled').isChecked(),true);assert.equal(await page.locator('[data-fx="delay"]').inputValue(),'0.91');assert.equal(await page.locator('#macros [data-macro="space"]').inputValue(),'0.93');assert.equal(await page.locator('.clip-scope').count(),3);
  await page.keyboard.press('Shift+s');assert.equal(await page.locator('[data-solo="lead"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.key.active').count(),0);await page.keyboard.press('Shift+s');assert.equal(await page.locator('[data-solo="lead"]').getAttribute('aria-pressed'),'false');
  await page.keyboard.press('Control+k');await page.keyboard.type('solo');assert.equal(await page.locator('.key.active').count(),0);assert.match(await page.locator('.command-item').first().textContent(),/SHIFT S/);await page.keyboard.press('Enter');assert.equal(await page.locator('[data-solo="lead"]').getAttribute('aria-pressed'),'true');await page.keyboard.press('Shift+s');
  await page.evaluate(()=>{globalThis.__mutations=0;document.querySelector('#mutateBtn').addEventListener('click',()=>globalThis.__mutations++)});await page.keyboard.press('Shift+m');assert.equal(await page.locator('[data-mute="lead"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.key.active').count(),0);assert.equal(await page.evaluate(()=>globalThis.__mutations),0);await page.keyboard.press('Shift+m');assert.equal(await page.locator('[data-mute="lead"]').getAttribute('aria-pressed'),'false');await page.keyboard.press('Shift+v');assert.equal(await page.evaluate(()=>globalThis.__mutations),1);
  await page.keyboard.press('Control+k');await page.keyboard.type('mute');assert.equal(await page.locator('.key.active').count(),0);assert.match(await page.locator('.command-item').first().textContent(),/SHIFT M/);await page.keyboard.press('Enter');assert.equal(await page.locator('[data-mute="lead"]').getAttribute('aria-pressed'),'true');await page.keyboard.press('Shift+m');
});

test('quick exports remember file handles and overwrite the same destination',{timeout:60000},async t=>{
  await ready();const browser=await launchBrowser();t.after(async()=>{await browser.close()});const page=await browser.newPage({viewport:{width:1280,height:900}});await page.addInitScript(()=>{globalThis.__quickSaves={pickers:0,writes:[]};Object.defineProperty(globalThis,'showSaveFilePicker',{configurable:true,value:async options=>{const name=options.suggestedName;globalThis.__quickSaves.pickers++;return{name,queryPermission:async()=>'granted',requestPermission:async()=>'granted',createWritable:async()=>({write:async data=>globalThis.__quickSaves.writes.push({name,size:data.size??data.byteLength??String(data).length}),close:async()=>{}})}}})});await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});await page.locator('.note-block').first().waitFor();
  const waitForWrites=async expected=>{console.log(`Waiting export stage ${expected}`);try{await page.waitForFunction(count=>globalThis.__quickSaves.writes.length===count,expected,{timeout:30000})}catch(error){throw new Error(`Export stage ${expected}: ${await page.locator('#renderStatus').textContent()} / ${await page.locator('#toast').textContent()}`,{cause:error})}};
  await page.locator('#exportAsBtn').click();await page.locator('.export-advanced').nth(1).locator('summary').click();await page.locator('[data-export="midi"]').click();await waitForWrites(1);
  await page.locator('[data-export="midi"]').click();await waitForWrites(2);
  let state=await page.evaluate(()=>globalThis.__quickSaves);assert.equal(state.pickers,1);assert.equal(state.writes[0].name,state.writes[1].name);assert.ok(state.writes.every(write=>write.size>20));
  await page.locator('[data-export-as="midi"]').click();await waitForWrites(3);
  state=await page.evaluate(()=>globalThis.__quickSaves);assert.equal(state.pickers,2);
  await page.locator('[data-export="project"]').click();await waitForWrites(4);
  await page.locator('[data-export="project"]').click();await waitForWrites(5);
  state=await page.evaluate(()=>globalThis.__quickSaves);assert.equal(state.pickers,3);assert.equal(state.writes[3].name,state.writes[4].name);
  await page.locator('#exportDialog [data-close]').click();await page.locator('#menuBtn').click();await page.locator('#emptyBtn').click();await page.locator('[data-request-dialog] button[type=submit]').click();await page.locator('#exportAsBtn').click();
  await page.locator('[data-export="wav"]').click();await waitForWrites(6);
  await page.locator('[data-export="wav"]').click();await waitForWrites(7);
  state=await page.evaluate(()=>globalThis.__quickSaves);assert.equal(state.pickers,4);assert.equal(state.writes[5].name,state.writes[6].name);assert.ok(state.writes[5].size>1000);
});

test('clip and song locators seek accurately and the mix console controls five channels',async t=>{
  await ready();const browser=await launchBrowser();t.after(async()=>{await browser.close()});const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});await page.locator('.note-block').first().waitFor();
  await goToView(page,'arrange');assert.ok(+await page.locator('#globalPosition').getAttribute('max')>32);await page.locator('#globalPosition').fill('32');assert.match(await page.locator('#globalPositionValue').textContent(),/BAR 3/);await page.locator('#globalStartBtn').click();await page.waitForFunction(()=>globalThis.__kvDiagnostics().songMode&&globalThis.__kvDiagnostics().position>=32);await page.locator('#playBtn').click();
  await goToView(page,'forge');await page.locator('#clipPosition').fill('8');assert.match(await page.locator('#clipPositionValue').textContent(),/STEP 9/);await page.locator('#clipStartBtn').click();await page.waitForFunction(()=>!globalThis.__kvDiagnostics().songMode&&globalThis.__kvDiagnostics().position>=8);await page.locator('#playBtn').click();
  await goToView(page,'mix');assert.equal(await page.locator('.mixer-channel').count(),5);await page.locator('[data-mix-track="lead"] .level-control input[type="range"]').fill('-8.6');assert.equal(await page.locator('[data-mix-track="lead"] .level-control output').textContent(),'-8.6 dB');await page.locator('[data-mix-track="lead"] [data-mix-solo]').click();assert.equal(await page.locator('[data-solo="lead"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#arrangeTimeline button').count(),4);
});

test('v5 launcher, arrange tools, precision mixer and local libraries form a complete workflow',async t=>{
  await ready();const browser=await launchBrowser();t.after(async()=>{await browser.close()});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});await page.locator('.note-block').first().waitFor();
  await goToView(page,'launch');assert.equal(await page.locator('.launcher-track').count(),5);assert.ok(await page.locator('.launcher-cell').count()>=10);await page.locator('#launcherCaptureBtn').click();await page.locator('[data-launch-track="lead"]').nth(1).click();await page.waitForFunction(()=>globalThis.__kvDiagnostics().schedulerActive);await page.locator('#launcherCaptureBtn').click();assert.equal(await page.locator('#launcherCommitBtn').isEnabled(),true);await page.locator('#launcherCommitBtn').click();assert.equal(await page.locator('#arrangeView').evaluate(view=>view.classList.contains('active')),true);assert.ok(await page.locator('.scene').count()>4);await page.locator('#playBtn').click();
  await page.locator('#arrangeSelectAllBtn').click();assert.equal(await page.locator('.scene.selected').count(),await page.locator('.scene').count());const sceneCount=await page.locator('.scene').count();await page.locator('#arrangeDuplicateBtn').click();assert.equal(await page.locator('.scene').count(),sceneCount*2);await page.locator('#arrangeLoopEnabled').check();await page.locator('#arrangeLoopStart').fill('4');await page.locator('#arrangeLoopEnd').fill('20');await page.locator('#arrangeMarkerBtn').click();await page.locator('[data-request-dialog] input[name=value]').fill('DROP');await page.locator('[data-request-dialog] button[type=submit]').click();assert.equal(await page.locator('.arrange-marker:not([title="Tempo map"])').count(),1);
  await goToView(page,'mix');assert.equal(await page.locator('.mix-meter-pair canvas').count(),10);await page.locator('[data-mix-track="lead"] [data-mix="preGainDb"]').fill('3');assert.match(await page.locator('[data-mix-track="lead"] label:has([data-mix="preGainDb"]) output').textContent(),/3.0 dB/);await page.locator('[data-mix-track="lead"] [data-send-mode]').selectOption('pre');await page.locator('#masterBypassBtn').click();assert.equal(await page.locator('#masterBypassBtn').getAttribute('aria-pressed'),'true');
  await page.locator('#menuBtn').click();await page.locator('#presetLibraryBtn').click();assert.ok(await page.locator('.preset-card').count()>=15);await page.locator('#presetDialog [data-close]').click();await page.locator('#menuBtn').click();await page.locator('#sampleLibraryBtn').click();assert.equal(await page.locator('.sample-slot').count(),7);await page.locator('#sampleDialog [data-close]').click();await page.locator('#exportAsBtn').click();assert.equal(await page.locator('#wavSampleRate option').count(),3);assert.equal(await page.locator('[data-stem]').count(),6);assert.equal(await page.locator('[data-export="bundle"]').count(),1);assert.deepEqual(errors,[]);
});

test('Scratch Deck captures the mix and supports tactile bidirectional control',async t=>{
  await ready();const browser=await launchBrowser();t.after(async()=>{await browser.close()});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});await page.locator('.note-block').first().waitFor();await goToView(page,'perform');
  assert.equal(await page.locator('#scratchPlatter').getAttribute('aria-disabled'),'true');assert.equal(await page.locator('#scratchPlayBtn').isDisabled(),true);await page.locator('#scratchImport').setInputFiles({name:'deck-source.ogg',mimeType:'audio/wav',buffer:silentWav()});await page.waitForFunction(()=>globalThis.__kvDiagnostics().scratchReady,null,{timeout:30000});assert.match(await page.locator('#scratchStatus').textContent(),/deck-source\.ogg/);await page.locator('#scratchBars').selectOption('1');await page.locator('#scratchCaptureBtn').click();await page.waitForFunction(()=>/BUFFER ARMED/.test(document.querySelector('#scratchStatus')?.textContent||''),null,{timeout:30000});
  const diagnostics=await page.evaluate(()=>globalThis.__kvDiagnostics());assert.ok(diagnostics.scratchFrames>1000);assert.equal(diagnostics.scratchPlaying,true);assert.equal(await page.locator('#scratchPlatter').getAttribute('aria-disabled'),'false');assert.equal(await page.locator('#scratchPlayBtn').isEnabled(),true);assert.match(await page.locator('#scratchStatus').textContent(),/BUFFER ARMED/);
  await page.locator('#scratchMix').evaluate(input=>{input.value='.35';input.dispatchEvent(new Event('input',{bubbles:true}))});assert.equal((await page.evaluate(()=>globalThis.__kvDiagnostics())).scratchMix,.35);await page.locator('#scratchStutterBtn').click();assert.equal(await page.locator('#scratchStutterBtn').getAttribute('aria-pressed'),'true');await page.locator('#scratchStutterBtn').click();
  await page.evaluate(()=>{const platter=document.querySelector('#scratchPlatter'),rect=platter.getBoundingClientRect(),event=(type,x,y)=>new PointerEvent(type,{bubbles:true,pointerId:71,pointerType:'mouse',buttons:type==='pointerup'?0:1,clientX:rect.left+x,clientY:rect.top+y});platter.dispatchEvent(event('pointerdown',rect.width-10,rect.height/2));platter.dispatchEvent(event('pointermove',rect.width/2,10))});assert.equal(await page.locator('.scratch-deck').evaluate(deck=>deck.classList.contains('scratching')),true);assert.ok(Math.abs((await page.evaluate(()=>globalThis.__kvDiagnostics())).scratchSpeed)>0);await page.evaluate(()=>{const platter=document.querySelector('#scratchPlatter'),rect=platter.getBoundingClientRect();platter.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:71,pointerType:'mouse',clientX:rect.left+rect.width/2,clientY:rect.top+10}))});await page.locator('#scratchSyncBtn').click();await page.locator('#scratchBrakeBtn').click();assert.deepEqual(errors,[]);
  await page.locator('#performanceRecordBtn').click();await page.waitForFunction(()=>globalThis.__kvDiagnostics().performanceRecording);await page.locator('#scratchMix').fill('0.61');await page.waitForTimeout(350);await page.locator('#performanceRecordBtn').click();await page.locator('#performanceSaveBtn').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#performanceSaveBtn').disabled);assert.equal(await page.locator('#performanceSaveBtn').isEnabled(),true);assert.equal(await page.locator('.performance-take').count(),1);await page.locator('[data-take-edit]').click();assert.equal(await page.locator('#takeEditorDialog').evaluate(dialog=>dialog.open),true);assert.ok(await page.locator('.take-event').count()>=1);await page.waitForFunction(()=>Boolean(globalThis.localStorage.getItem('kiber-vengance-project-v6')));const saved=await page.evaluate(()=>JSON.parse(globalThis.localStorage.getItem('kiber-vengance-project-v6')));assert.equal(saved.version,6);assert.equal(saved.performanceTakes.length,1);
});

test('v6 Audio Studio imports, plays, pauses and sends edited regions to Scratch Deck',async t=>{await ready();const browser=await launchBrowser();t.after(async()=>{await browser.close()});const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});await goToView(page,'audio');assert.equal(await page.locator('#audioView').evaluate(view=>view.classList.contains('active')),true);await page.locator('#audioLaneBtn').click();assert.equal(await page.locator('.audio-lane').count(),1);await page.locator('#audioImport').setInputFiles({name:'voice.wav',mimeType:'audio/wav',buffer:silentWav()});await page.locator('.audio-region').waitFor();assert.equal(await page.locator('.audio-region').count(),1);await page.locator('#playBtn').click();await page.waitForFunction(()=>globalThis.__kvDiagnostics().songMode&&globalThis.__kvDiagnostics().activeAudioRegions>0);await page.waitForFunction(()=>globalThis.__kvDiagnostics().position>=2);await page.locator('#pauseBtn').click();assert.equal(await page.locator('#audioState').textContent(),'PAUSED');assert.equal(await page.locator('#pauseBtn').isDisabled(),true);const pausedAt=await page.evaluate(()=>globalThis.__kvDiagnostics().position);await page.locator('#playBtn').click();await page.waitForFunction(position=>globalThis.__kvDiagnostics().position>=position&&globalThis.__kvDiagnostics().activeAudioRegions>0,pausedAt);await page.locator('#pauseBtn').click();await page.locator('[data-region-key="startStep"]').fill('12');await page.locator('[data-region-key="startStep"]').dispatchEvent('change');assert.equal(await page.locator('[data-region-key="startStep"]').inputValue(),'12');await page.locator('[data-region-scratch]').click();await page.waitForFunction(()=>globalThis.__kvDiagnostics().scratchReady);assert.equal(await page.locator('#performView').evaluate(view=>view.classList.contains('active')),true);assert.match(await page.locator('#scratchStatus').textContent(),/voice\.wav/);await goToView(page,'audio');await page.locator('#automationLaneBtn').click();assert.equal(await page.locator('.automation-card').count(),1);await page.locator('#modulationBtn').click();assert.equal(await page.locator('.modulation-card').count(),1);await goToView(page,'mix');assert.equal(await page.locator('.mix-group').count(),1);await page.locator('#monoCheckBtn').click();assert.equal(await page.locator('#monoCheckBtn').getAttribute('aria-pressed'),'true');await page.locator('#menuBtn').click();await page.locator('#uiScale').selectOption('.9');assert.equal(await page.locator('html').evaluate(root=>root.style.getPropertyValue('--ui-scale')),'.9');assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=document.documentElement.clientWidth),true);assert.deepEqual(errors,[])});

test('Prism Keys sampler is persistent, tactile, polyphonic and responsive',async t=>{
  await ready();const browser=await launchBrowser();t.after(async()=>{await browser.close()});
  const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});await goToView(page,'audio');
  assert.equal(await page.locator('.sampler-key').count(),25);
  await page.locator('#samplerImport').setInputFiles({name:'prism.wav',mimeType:'audio/wav',buffer:silentWav()});
  await page.waitForFunction(()=>globalThis.__kvDiagnostics().samplerLoaded);
  await page.waitForFunction(()=>globalThis.document.querySelector('#samplerArm')?.getAttribute('aria-pressed')==='true');
  assert.equal(await page.locator('#samplerArm').getAttribute('aria-pressed'),'true');
  await page.locator('#samplerMode').selectOption('loop');await page.locator('#samplerRoot').fill('57');await page.locator('#samplerRoot').dispatchEvent('change');
  assert.equal(await page.locator('.sampler-key.root').getAttribute('data-sampler-pitch'),'57');
  const key=page.locator('[data-sampler-pitch="60"]');await key.scrollIntoViewIfNeeded();const box=await key.boundingBox();assert.ok(box);assert.ok(box.width>=44);assert.ok(box.height>=100);
  await page.mouse.move(box.x+box.width/2,box.y+box.height*.8);await page.mouse.down();await page.waitForFunction(()=>globalThis.__kvDiagnostics().samplerVoices===1);assert.equal(await key.evaluate(node=>node.classList.contains('active')),true);assert.equal(await page.locator('#samplerLab').evaluate(node=>node.classList.contains('playing')),true);assert.match(await page.locator('#samplerLiveStatus').textContent(),/LIVE · C4/);await page.mouse.up();await page.waitForFunction(()=>globalThis.__kvDiagnostics().samplerVoices===0);assert.equal(await key.evaluate(node=>node.classList.contains('active')),false);
  const samplerKey=page.locator('[data-sampler-pitch="61"]'),samplerIdleBackground=await samplerKey.evaluate(node=>globalThis.getComputedStyle(node).backgroundColor);
  await page.locator('.sampler-hint').click();await page.keyboard.down('w');await page.waitForFunction(()=>globalThis.__kvDiagnostics().samplerVoices===1);assert.equal(await samplerKey.evaluate(node=>node.classList.contains('active')),true);await page.waitForFunction(idle=>globalThis.getComputedStyle(document.querySelector('[data-sampler-pitch="61"]')).backgroundColor!==idle,samplerIdleBackground);assert.notEqual(await samplerKey.evaluate(node=>globalThis.getComputedStyle(node).backgroundColor),samplerIdleBackground);await page.keyboard.up('w');await page.waitForFunction(()=>globalThis.__kvDiagnostics().samplerVoices===0);
  await page.keyboard.press('z');assert.match(await page.locator('#samplerOctaveValue').textContent(),/C3–C4/);assert.equal(await page.locator('[data-sampler-pitch="48"] span').textContent(),'A');await page.keyboard.down('w');assert.equal(await page.locator('[data-sampler-pitch="49"]').evaluate(node=>node.classList.contains('active')),true);await page.keyboard.up('w');await page.keyboard.press('x');assert.match(await page.locator('#samplerOctaveValue').textContent(),/C4–C5/);
  await page.waitForFunction(()=>{const raw=globalThis.localStorage.getItem('kiber-vengance-project-v6');return Boolean(raw&&JSON.parse(raw).sampler?.assetId)});
  assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=document.documentElement.clientWidth),true);assert.deepEqual(errors,[]);
});

test('main performance keyboard exposes the full chromatic QWERTY row',async t=>{
  await ready();const browser=await launchBrowser();t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});
  const mapping=await page.locator('#keyboard .key').evaluateAll(keys=>keys.slice(0,13).map(key=>({source:key.dataset.source,pitch:key.dataset.pitch,label:key.textContent?.trim()})));
  assert.deepEqual(mapping.map(key=>key.source),['a','w','s','e','d','f','t','g','y','h','u','j','k']);
  assert.equal(mapping[1].label?.endsWith('W'),true);
  const chromatic=page.locator('#keyboard .key[data-source="w"]');
  await page.keyboard.down('w');
  await page.waitForFunction(()=>globalThis.__kvDiagnostics().liveVoices===1);
  assert.equal(await chromatic.evaluate(node=>node.classList.contains('active')),true);
  assert.equal(await chromatic.getAttribute('aria-pressed'),'true');
  assert.notEqual(await chromatic.evaluate(node=>globalThis.getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)');
  await page.keyboard.up('w');
  await page.waitForFunction(()=>globalThis.__kvDiagnostics().liveVoices===0);
  await goToView(page,'perform');
  const liveChromatic=page.locator('#performanceKeyboard .key[data-source="w"]');
  await page.keyboard.down('w');
  await page.waitForFunction(()=>globalThis.__kvDiagnostics().liveVoices===1);
  assert.equal(await liveChromatic.evaluate(node=>node.classList.contains('active')),true);
  assert.equal(await liveChromatic.getAttribute('aria-pressed'),'true');
  assert.notEqual(await liveChromatic.evaluate(node=>globalThis.getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)');
  await page.keyboard.up('w');
  await page.waitForFunction(()=>globalThis.__kvDiagnostics().liveVoices===0);
  assert.equal(await liveChromatic.getAttribute('aria-pressed'),'false');
});

test('header title, language and export controls keep a clear aligned desktop row',async t=>{
  await ready();const browser=await launchBrowser();t.after(()=>browser.close());
  for(const width of [1440,1600]){
    const page=await browser.newPage({viewport:{width,height:900}});
    await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});
    const boxes=await page.evaluate(()=>Object.fromEntries(['#title','#languageSelect','#exportBtn','#exportAsBtn'].map(selector=>{const box=document.querySelector(selector).getBoundingClientRect();return [selector,{x:box.x,y:box.y,width:box.width,height:box.height}]})));
    assert.equal(Math.abs(boxes['#title'].y-boxes['#languageSelect'].y)<.5,true);
    assert.equal(boxes['#title'].height,40);assert.equal(boxes['#languageSelect'].width,60);
    assert.equal(boxes['#exportBtn'].x-(boxes['#languageSelect'].x+boxes['#languageSelect'].width)>=12,true);
    assert.equal(boxes['#exportAsBtn'].x-(boxes['#exportBtn'].x+boxes['#exportBtn'].width)>=12,true);
    await page.locator('#languageSelect').selectOption('es');assert.equal(await page.locator('#languageSelect').inputValue(),'es');
    await page.close();
  }
});

test('shared controls expose hover, focus, range progress and immediate note feedback',async t=>{
  await ready();const browser=await launchBrowser();t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});
  for(const view of ['forge','perform']){
    await goToView(page,view);
    const id=view==='perform'?'performanceKeyboard':'keyboard';
    for(const key of 'awsedftgyhujk'){
      await page.keyboard.down(key);
      const note=page.locator(`#${id} [data-source="${key}"]`);
      assert.equal(await note.getAttribute('aria-pressed'),'true');
      assert.equal(await note.evaluate(node=>globalThis.getComputedStyle(node).transitionDuration),'0s');
      assert.notEqual(await note.evaluate(node=>globalThis.getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)');
      await page.keyboard.up(key);
      assert.equal(await note.getAttribute('aria-pressed'),'false');
    }
  }
  await goToView(page,'audio');
  const select=page.locator('#samplerMode');
  const idleBorder=await select.evaluate(node=>globalThis.getComputedStyle(node).borderColor);
  await select.hover();
  await page.waitForFunction(idle=>globalThis.getComputedStyle(document.querySelector('#samplerMode')).borderColor!==idle,idleBorder);
  const range=page.locator('.sampler-level input[type=range]');await range.fill('-6.9');
  assert.ok(Math.abs(parseFloat(await range.evaluate(node=>node.style.getPropertyValue('--range-fill')))-80.4545)<.01);
  await page.keyboard.press('Tab');await range.focus();assert.equal(await range.evaluate(node=>globalThis.getComputedStyle(node).outlineStyle),'solid');
  const disabled=page.locator('#samplerArm');assert.equal(await disabled.isDisabled(),true);
  await disabled.hover({force:true});assert.equal(await disabled.evaluate(node=>globalThis.getComputedStyle(node).cursor),'not-allowed');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.ok(await select.evaluate(node=>parseFloat(globalThis.getComputedStyle(node).transitionDuration)<.001));
  await page.setViewportSize({width:390,height:844});
  await page.locator('#samplerImport').setInputFiles({name:'mobile.wav',mimeType:'audio/wav',buffer:silentWav()});
  await page.waitForFunction(()=>document.querySelector('#samplerArm').getAttribute('aria-pressed')==='true');
  await page.locator('.sampler-hint').click();await page.keyboard.down('w');
  const visibleNote=page.locator('#samplerKeyboard [data-sampler-pitch="61"]');
  assert.equal(await visibleNote.getAttribute('aria-pressed'),'true');
  assert.equal(await visibleNote.evaluate(node=>{const key=node.getBoundingClientRect(),scroll=node.closest('.keyboard-scroll').getBoundingClientRect();return key.left>=scroll.left&&key.right<=scroll.right}),true);
  await page.keyboard.up('w');assert.equal(await visibleNote.getAttribute('aria-pressed'),'false');
});

test('installable build exposes its Cyrillic identity, manifest and service worker',async t=>{await ready();const browser=await launchBrowser();t.after(async()=>{await browser.close()});const page=await browser.newPage();await page.goto(url,{waitUntil:'networkidle'});assert.equal(await page.locator('.brand-word b').first().textContent(),'КИБЕР');assert.ok(await page.locator('.brand-emblem').count()>=4);assert.equal(await page.locator('link[rel="manifest"]').getAttribute('href'),'manifest.webmanifest');const manifest=await page.evaluate(async()=>await (await fetch('manifest.webmanifest')).json());assert.equal(manifest.name,'КИБЕР VENGANCE');await page.waitForFunction(()=>navigator.serviceWorker?.controller||navigator.serviceWorker?.ready);const registration=await page.evaluate(async()=>Boolean(await navigator.serviceWorker.getRegistration()));assert.equal(registration,true)});

test('appearance settings persist skins and preserve playable keyboards across workspaces',async t=>{
  await ready();const browser=await launchBrowser();t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});
  await page.locator('#settingsBtn').click();
  await page.locator('[data-skin-option="scarlett"]').click();
  await page.locator('#controlAccent').selectOption('violet');
  await page.locator('#keyGlow').fill('80');
  await page.locator('#keyShortcuts').uncheck();
  assert.equal(await page.locator('html').getAttribute('data-keyboard-skin'),'scarlett');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#appearanceDialog').evaluate(node=>node.open),false);
  assert.equal(await page.locator('#keyboard .keyboard-key > span').first().isVisible(),false);
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('html').getAttribute('data-keyboard-skin'),'scarlett');
  assert.equal(await page.locator('html').getAttribute('data-control-accent'),'violet');
  for(const skin of ['neon','terminal','ember','scarlett','classic']){
    await page.locator('#settingsBtn').click();
    await page.locator(`[data-skin-option="${skin}"]`).click();
    assert.equal(await page.locator(`[data-skin-option="${skin}"]`).getAttribute('aria-pressed'),'true');
    await page.keyboard.press('Escape');
    for(const view of ['forge','perform']){
      await goToView(page,view);
      await page.locator('#settingsBtn').focus();await page.locator('#settingsBtn').blur();
      const key=page.locator(`${view==='forge'?'#keyboard':'#performanceKeyboard'} [data-source="w"]`);
      const idle=await key.evaluate(node=>globalThis.getComputedStyle(node).background);
      await page.keyboard.down('w');assert.equal(await key.getAttribute('aria-pressed'),'true');
      assert.notEqual(await key.evaluate(node=>globalThis.getComputedStyle(node).background),idle);
      await page.keyboard.up('w');assert.equal(await key.getAttribute('aria-pressed'),'false');
    }
  }
  await goToView(page,'audio');
  await page.locator('#samplerImport').setInputFiles({name:'skins.wav',mimeType:'audio/wav',buffer:silentWav()});
  await page.waitForFunction(()=>document.querySelector('#samplerArm').getAttribute('aria-pressed')==='true');
  await page.locator('#settingsBtn').click();await page.keyboard.press('w');
  assert.equal(await page.locator('#samplerKeyboard .active').count(),0);
  await page.locator('[data-skin-option="scarlett"]').click();await page.keyboard.press('Escape');
  await page.locator('.sampler-hint').click();await page.keyboard.down('w');
  assert.equal(await page.locator('#samplerKeyboard [data-sampler-pitch="61"]').getAttribute('aria-pressed'),'true');
  await page.keyboard.up('w');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#menuBtn').click();await page.locator('#menuLanguageSelect').selectOption('es');
  await page.locator('#menuSettingsBtn').click();
  assert.equal(await page.locator('#appearanceTitle').textContent(),'Configuración');
  await page.locator('[data-skin-option="scarlett"]').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=globalThis.innerWidth),true);
  assert.equal(await page.locator('#appearanceDialog').evaluate(node=>node.scrollWidth<=node.clientWidth),true);
  await page.addScriptTag({content:axe.source});
  const audit=await page.evaluate(async()=>globalThis.axe.run(document.querySelector('#appearanceDialog')));
  assert.deepEqual(audit.violations.filter(item=>['serious','critical'].includes(item.impact)).map(item=>item.id),[]);
  await page.locator('#resetAppearance').click();
  assert.equal(await page.locator('html').getAttribute('data-keyboard-skin'),'neon');
  assert.equal(await page.locator('#keyGlow').inputValue(),'65');
  assert.equal(await page.locator('#keyShortcuts').isChecked(),true);
  await page.keyboard.press('Escape');await page.locator('#menuBtn').click();await page.locator('#menuSettingsBtn').click();
  assert.equal(await page.locator('#appearanceDialog').evaluate(node=>node.open),true);
  assert.deepEqual(errors,[]);
});

test('local AI is opt-in and handles missing GPU, cancellation and mobile settings honestly',async t=>{
  await ready();const browser=await launchBrowser();t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
  const modelRequests=[];page.on('request',request=>{if(/huggingface\.co|raw\.githubusercontent\.com/.test(request.url()))modelRequests.push(request.url())});
  await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});
  assert.deepEqual(modelRequests,[]);
  await page.locator('#menuBtn').click();await page.locator('#menuLanguageSelect').selectOption('es');
  await page.locator('#menuSettingsBtn').click();await page.locator('#openLocalAISettings').click();
  assert.equal(await page.locator('#localAITitle').textContent(),'Melodía por prompt');
  await page.locator('#localAIBackend').selectOption('gpu');
  assert.equal(await page.locator('#generateLocalAI').isDisabled(),true);
  await page.locator('#loadLocalAI').click();await page.locator('.ai-error').waitFor();
  assert.match(await page.locator('.ai-error').textContent(),/WebGPU/);
  assert.equal(await page.locator('#generateLocalAI').isDisabled(),true);
  assert.equal(await page.locator('#applyLocalAI').count(),0);
  assert.deepEqual(modelRequests,[]);
  assert.equal(await page.locator('#localAIDialog').evaluate(node=>node.scrollWidth<=node.clientWidth),true);
  await page.addScriptTag({content:axe.source});
  const audit=await page.evaluate(async()=>globalThis.axe.run(document.querySelector('#localAIDialog')));
  assert.deepEqual(audit.violations.filter(item=>['serious','critical'].includes(item.impact)).map(item=>item.id),[]);
  await page.evaluate(()=>Object.defineProperty(navigator,'gpu',{value:{requestAdapter:()=>new Promise(resolve=>setTimeout(()=>resolve(null),500))},configurable:true}));
  await page.locator('#loadLocalAI').click();await page.locator('#unloadLocalAI').click();
  await page.waitForTimeout(650);
  assert.equal(await page.locator('.ai-error').count(),0);
  assert.equal(await page.locator('#localAIStatus').textContent(),'Modelo sin cargar');
  assert.deepEqual(modelRequests,[]);
  await page.locator('#deleteLocalAI').click();
  await page.waitForFunction(()=>document.querySelector('.ai-detail')?.textContent.includes('eliminado')||document.querySelector('.ai-error'));
  assert.equal(await page.locator('.ai-error').count(),0);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#localAIDialog').evaluate(node=>node.open),false);
});

test('automatic local AI chooses CPU when a page GPU cannot run in its worker',async t=>{
  await ready();const browser=await launchBrowser();t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({features:new Set(['shader-f16'])})},configurable:true}));
  // Infrastructure fixture only: this worker reports no GPU. Model inference is
  // never mocked or reported successful; real CPU model requests are blocked.
  await page.route('**/inference-worker-*.js',route=>route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>self.postMessage({kind:"probed",supported:false});'}));
  const heldModelRequests=[];
  await page.route('https://huggingface.co/**',route=>{heldModelRequests.push(route)});
  await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});
  await page.locator('#settingsBtn').click();await page.locator('#openLocalAISettings').click();
  assert.equal(await page.locator('#localAIBackend').inputValue(),'auto');
  const requestedCPU=page.waitForRequest(request=>request.url().includes('SmolLM2-135M-Instruct-ONNX'),{timeout:30000});
  await page.locator('#loadLocalAI').click();await requestedCPU;
  assert.equal(await page.locator('.ai-result').count(),0);
  await page.locator('#unloadLocalAI').click();
  for(const route of heldModelRequests)await route.abort().catch(()=>{});
  assert.equal(await page.locator('#localAIStatus').textContent(),'Model not loaded');
  assert.equal(await page.locator('#generateLocalAI').isDisabled(),true);
});

test('workspace tabs stay consistent when returning to Compose and shared actions retain their handlers',async t=>{
  await ready();const browser=await launchBrowser();t.after(()=>browser.close());
  for(const viewport of [{width:1366,height:1000},{width:390,height:844}]){
    const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});
    for(const language of ['en','es']){
      await page.locator('#menuBtn').click();await page.locator('#menuLanguageSelect').selectOption(language);await page.keyboard.press('Escape');
      for(const destination of ['arrange','audio','perform','launch','mix']){
        await goToView(page,destination);
        const expected=destination==='mix'?0:2;
        assert.equal(await page.locator('.studio-subnav > nav button').count(),expected);
        if(expected){
          assert.equal(await page.locator('.studio-subnav > nav').isVisible(),true);
          assert.equal(await page.locator(`.studio-subnav [data-view="${destination}"]`).getAttribute('aria-current'),'page');
        }
        await goToView(page,'forge');
        assert.equal(await page.locator('.studio-subnav > nav').count(),0);
        assert.equal(await page.locator('.studio-subnav [data-view="forge"]').count(),0);
        assert.equal(await page.locator('#composeAIMelodyBtn').isVisible(),true);
        assert.equal(await page.locator('#commandBtn').count(),1);
        assert.equal(await page.locator('#tutorialBtn').isVisible(),true);
        await page.locator('#commandBtn').click();assert.equal(await page.locator('#commandDialog').evaluate(n=>n.open),true);await page.keyboard.press('Escape');
      }
    }
    for(const expanded of [true,false]){
      await page.locator('.studio-context-actions button[aria-pressed]').click();
      assert.equal(await page.locator('#app').evaluate(n=>n.classList.contains('instrument-expanded')),expanded);
      await goToView(page,'arrange');assert.equal(await page.locator('.studio-subnav > nav button').count(),2);
      await goToView(page,'forge');assert.equal(await page.locator('.studio-subnav > nav').count(),0);
    }
    await page.locator('#soundInspectorBtn').click();assert.equal(await page.locator('#soundInspectorBtn').getAttribute('aria-expanded'),'true');await setSoundInspector(page,false);
    await page.locator('#composeAIMelodyBtn').click();assert.equal(await page.locator('#localAIDialog').evaluate(n=>n.open),true);await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=globalThis.innerWidth),true);
    await page.screenshot({path:`${tmpdir()}/kiber-compose-tabs-fixed-${viewport.width}.png`});
    assert.deepEqual(errors,[]);await page.close();
  }
});

test('local AI is discoverable in Compose, the project menu and bilingual commands without loading a model',async t=>{
  await ready();const browser=await launchBrowser();t.after(()=>browser.close());
  for(const viewport of [{width:1366,height:1000},{width:390,height:844}]){
    const page=await browser.newPage({viewport});
    const requests=[];page.on('request',request=>{if(/huggingface\.co|inference-worker-|cpu-worker-/.test(request.url()))requests.push(request.url())});
    await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});
    await page.locator('.track[data-track="guitar"]').click();
    const clips=await page.locator('#clipSelect option').count(),notes=await page.locator('.note-block').count();
    assert.equal(await page.locator('#composeAIMelodyBtn').isVisible(),true);
    await page.locator('#composeAIMelodyBtn').click();
    assert.equal(await page.locator('#localAIDialog').evaluate(node=>node.open),true);
    assert.match(await page.locator('.ai-target').textContent(),/GUITAR/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#composeAIMelodyBtn').evaluate(node=>document.activeElement===node),true);
    await page.locator('#menuBtn').click();
    await page.locator('#menuLanguageSelect').selectOption('es');
    assert.equal(await page.locator('#menuAIMelodyBtn').textContent(),'Generar melodía con IA local');
    await page.locator('#menuAIMelodyBtn').click();
    assert.equal(await page.locator('#projectMenu').evaluate(node=>node.open),false);
    assert.equal(await page.locator('#localAITitle').textContent(),'Melodía por prompt');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#menuBtn').evaluate(node=>document.activeElement===node),true);
    assert.equal(await page.locator('#composeAIMelodyBtn').textContent(),'Melodía IA');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=globalThis.innerWidth),true);
    await goToView(page,'mix');
    for(const query of ['local ai','melodia']){
      await page.keyboard.press('Control+k');await page.locator('#commandSearch').fill(query);
      assert.match(await page.locator('.command-item').first().textContent(),/Generar melodía con IA local/);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#commandDialog').evaluate(node=>node.open),false);
      assert.equal(await page.locator('#localAIDialog').evaluate(node=>node.open),true);
      assert.equal(await page.locator('#generateLocalAI').isDisabled(),true);
      await page.keyboard.press('Escape');
    }
    await goToView(page,'forge');
    assert.equal(await page.locator('#clipSelect option').count(),clips);
    assert.equal(await page.locator('.note-block').count(),notes);
    assert.deepEqual(requests,[]);
    await page.close();
  }
});

test('melody and sound catalogs support recipes, native file and URL import, Vault and mobile controls',async t=>{
  await ready();const browser=await launchBrowser();t.after(()=>browser.close());
  const factory=JSON.parse(readFileSync(new URL('../public/presets/catalog-v1.json',import.meta.url),'utf8'));
  for(const viewport of [{width:1366,height:1000},{width:390,height:844}]){
    const page=await browser.newPage({viewport}),errors=[],models=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/huggingface\.co|inference-worker-|cpu-worker-/.test(r.url()))models.push(r.url())});
    await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});
    const clips=await page.locator('#clipSelect option').count(),notes=await page.locator('.note-block').count(),tempo=await page.locator('#tempo').inputValue();
    await page.locator('#composeAIMelodyBtn').click();await page.locator('#aiPresetCatalog > summary').click();
    assert.equal(await page.locator('#aiPresetFile').isVisible(),true);
    assert.equal(await page.locator('[data-ai-preset]').count(),15);
    await page.locator('#aiPresetSearch').fill('scarlett');assert.equal(await page.locator('[data-ai-preset]').count(),2);
    await page.locator('[data-ai-preset="scarlett-protocol"] button').click();
    assert.equal(await page.locator('#aiStyle').inputValue(),'darksynth');assert.equal(await page.locator('#aiRhythm').inputValue(),'driving');assert.equal(await page.locator('#aiTempo').inputValue(),'128');assert.equal(await page.locator('#aiKey').inputValue(),'C');
    assert.equal(await page.locator('#aiApplyTempo').isChecked(),false);
    await page.locator('[data-ai-preset="sound-scarlett-lead"] button').first().click();assert.match(await page.locator('.ai-target').textContent(),/Scarlett Razor/);
    await page.locator('#aiPresetSearch').fill('');await page.locator('#aiPresetKind').selectOption('sound');assert.equal(await page.locator('[data-ai-preset]').count(),6);
    assert.equal(await page.locator('[data-ai-preset="sound-reactor-bass"] button').first().isDisabled(),true);
    const custom={...factory.presets.find(p=>p.kind==='sound'),id:'import-test',name:'Imported Neon'};
    await page.locator('#aiPresetFile').setInputFiles({name:'native-bank.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'kiber-vengance-preset-bank',version:1,presets:[{...custom,kind:undefined}]}))});
    await page.locator('[data-ai-preset="import-test"]').waitFor();await page.locator('[data-ai-preset="import-test"] button').last().click();
    assert.match(await page.locator('#aiPresetCatalog [role=status]').textContent(),/Saved to Preset Vault/);
    await page.locator('#aiPresetFile').setInputFiles({name:'plugin.json',mimeType:'application/json',buffer:Buffer.from('{"plugin":"Vital"}')});
    assert.match(await page.locator('#aiPresetCatalog [role=alert]').textContent(),/compatible/);
    const remote={format:factory.format,version:1,presets:[{...factory.presets[0],id:'online-test',name:'Online Neon'}]};
    await page.route('https://example.com/presets.json',r=>r.fulfill({json:remote,headers:{'access-control-allow-origin':'*'}}));
    await page.locator('#aiPresetURL').fill('https://example.com/presets.json');await page.locator('#aiPresetFetch').click();
    await page.waitForFunction(()=>document.querySelector('#aiPresetCatalog [role=status]')?.textContent.includes('external URL'));
    await page.locator('#aiPresetKind').selectOption('melody');await page.locator('[data-ai-preset="online-test"]').waitFor();
    const canonical='https://raw.githubusercontent.com/suizman/kiber-vengance/master/public/presets/catalog-v1.json';
    await page.route(canonical,r=>r.fulfill({json:factory,headers:{'access-control-allow-origin':'*'}}));await page.locator('#aiPresetOfficial').click();
    await page.waitForFunction(()=>document.querySelector('#aiPresetCatalog [role=status]')?.textContent.includes('official catalog'));
    await page.route(canonical,r=>r.fulfill({status:404,body:'Not found',headers:{'access-control-allow-origin':'*'}}));await page.locator('#aiPresetOfficial').click();
    await page.waitForFunction(()=>document.querySelector('#aiPresetCatalog [role=alert]')?.textContent.includes('HTTP 404'));
    await page.locator('#aiTempo').fill('');assert.equal(await page.locator('#aiTempo').getAttribute('aria-invalid'),'true');
    await page.locator('#aiTempo').fill('124');assert.equal(await page.locator('#aiTempo').getAttribute('aria-invalid'),'false');
    await page.screenshot({path:`${tmpdir()}/kiber-presets-${viewport.width}.png`,fullPage:true});
    const a11y=await page.evaluate(async source=>{eval(source);return globalThis.axe.run(document.querySelector('#localAIDialog'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}})},axe.source);
    assert.deepEqual(a11y.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id),[]);
    assert.equal(await page.locator('#localAIDialog').evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
    await page.keyboard.press('Escape');assert.equal(await page.locator('#clipSelect option').count(),clips);assert.equal(await page.locator('.note-block').count(),notes);assert.equal(await page.locator('#tempo').inputValue(),tempo);
    await page.locator('#menuBtn').click();await page.locator('#presetLibraryBtn').click();await page.locator('#presetSearch').fill('Imported Neon');assert.equal(await page.locator('.preset-card').count(),1);
    assert.deepEqual(models,[]);assert.deepEqual(errors,[]);await page.close();
  }
});

test.after(()=>server.close());

test('releasing a touch key before audio startup completes cannot leave a stuck voice',async t=>{
  await ready();const browser=await launchBrowser();t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.addInitScript(()=>{
    const original=globalThis.Worklet.prototype.addModule;
    let release;const gate=new Promise(resolve=>{release=resolve});
    globalThis.__releaseAudioInit=release;globalThis.__audioInitRequested=false;
    globalThis.Worklet.prototype.addModule=async function(...args){globalThis.__audioInitRequested=true;await gate;return original.apply(this,args)};
  });
  await page.goto(`${url}/?qa=1`);await page.locator('#keyboard .key').first().waitFor();
  const key=page.locator('#keyboard .key').first();await key.evaluate(el=>el.scrollIntoView({block:'center'}));const box=await key.boundingBox();assert.ok(box);
  const session=await page.context().newCDPSession(page),point={x:box.x+box.width/2,y:box.y+box.height*.45};
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await page.waitForFunction(()=>globalThis.__audioInitRequested);
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.evaluate(()=>globalThis.__releaseAudioInit());
  await page.waitForFunction(()=>globalThis.__kvDiagnostics().contextState==='running');
  await page.waitForTimeout(150);assert.equal((await page.evaluate(()=>globalThis.__kvDiagnostics())).liveVoices,0);assert.equal(await page.locator('.key.active').count(),0);
  const scale=await page.evaluate(()=>globalThis.visualViewport.scale);for(let i=0;i<8;i++)await key.tap();
  await page.waitForFunction(()=>globalThis.__kvDiagnostics().liveVoices===0);assert.equal(await page.evaluate(()=>globalThis.visualViewport.scale),scale);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await page.waitForFunction(()=>globalThis.__kvDiagnostics().liveVoices===1);
  await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForFunction(()=>globalThis.__kvDiagnostics().liveVoices===0);assert.equal(await page.locator('.key.active').count(),0);
});


test('microphone capture, waveform seeking and keeping scratch audio form a persistent mobile workflow',async t=>{
  await ready();const browser=await launchBrowser('chromium',{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['microphone']});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${url}/?qa=1`);await goToView(page,'perform');
  await page.locator('#scratchMic').click();await page.waitForFunction(()=>document.querySelector('#scratchMic').getAttribute('aria-pressed')==='true');
  await page.waitForTimeout(400);await page.locator('#scratchMic').click();
  await page.waitForFunction(()=>globalThis.__kvDiagnostics().scratchReady&&!globalThis.__kvDiagnostics().scratchPlaying);
  const wave=page.locator('#scratchWaveform');await wave.evaluate(el=>el.scrollIntoView({block:'center'}));const box=await wave.boundingBox();assert.ok(box);
  await page.touchscreen.tap(box.x+box.width*.75,box.y+box.height/2);assert.equal(await wave.getAttribute('aria-valuenow'),'75');
  await wave.press('Home');assert.equal(await wave.getAttribute('aria-valuenow'),'0');
  await page.locator('#scratchDivision').selectOption('32');await page.locator('#scratchStutterBtn').click();assert.equal(await page.locator('#scratchStutterBtn').getAttribute('aria-pressed'),'true');
  await wave.press('ArrowRight');assert.equal(await page.locator('#scratchStutterBtn').getAttribute('aria-pressed'),'false');
  await page.locator('#scratchKeep').click();
  await page.waitForFunction(()=>{const raw=globalThis.localStorage.getItem('kiber-vengance-project-v6');return Boolean(raw&&JSON.parse(raw).audioLanes.some(lane=>lane.regions.length>0))});
  await goToView(page,'audio');assert.equal(await page.locator('.audio-region').count(),1);
  await page.reload();await goToView(page,'audio');assert.equal(await page.locator('.audio-region').count(),1);
  assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=document.documentElement.clientWidth),true);assert.deepEqual(errors,[]);
});

test("two live decks load independently, mix, seek and follow separate BPM controls", async (t) => {
  await ready();
  const browser = await launchBrowser("chromium");
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'selectAudioOutput', {value:async()=>({deviceId:'test-headphones'}),configurable:true});
    globalThis.HTMLMediaElement.prototype.setSinkId=async function(id){this.dataset.sink=id};
    globalThis.HTMLMediaElement.prototype.play=async function(){};
  });
  await page.goto(`${url}/?qa=1`);
  await goToView(page, "perform");
  assert.equal(await page.locator(".dual-deck-layout > section").count(), 2);
  await page
    .locator("#deckBImport")
    .setInputFiles({
      name: "track-b.wav",
      mimeType: "audio/wav",
      buffer: silentWav(),
    });
  await page.waitForFunction(() => globalThis.__kvDiagnostics().scratchReadyB);
  assert.equal(await page.locator('#scratchMix').isEnabled(),true);
  assert.equal((await page.evaluate(()=>globalThis.__kvDiagnostics())).scratchCrossfade,1);
  await page
    .locator("#scratchImport")
    .setInputFiles({
      name: "track-a.wav",
      mimeType: "audio/wav",
      buffer: silentWav(),
    });
  await page.waitForFunction(() => globalThis.__kvDiagnostics().scratchReady);
  assert.match(await page.locator("#scratchStatus").textContent(), /track-a/);
  assert.match(await page.locator("#deckBStatus").textContent(), /track-b/);
  assert.equal(
    (await page.evaluate(() => globalThis.__kvDiagnostics())).scratchCrossfade,
    0.5,
  );
  await page.waitForFunction(() => {
    const state = globalThis.__kvDiagnostics();
    return state.scratchGainA > 0.1 && state.scratchGainB > 0.1;
  });
  await page.locator('#deckCueOutput').click();
  assert.equal(await page.locator('#deckACue').isEnabled(),true);
  assert.equal(await page.locator('#deckBCue').isEnabled(),true);
  await page.locator('#deckBCue').click();
  await page.waitForFunction(()=>globalThis.__kvDiagnostics().scratchCueGainB>.5);
  assert.equal(await page.locator('#deckBCue').getAttribute('aria-pressed'),'true');
  assert.ok((await page.evaluate(()=>globalThis.__kvDiagnostics())).scratchGainA>.1);
  await page.locator('#deckACue').click();
  await page.waitForFunction(()=>globalThis.__kvDiagnostics().scratchCueGainA>.5&&globalThis.__kvDiagnostics().scratchCueGainB<.01);
  await page.locator("#deckBBpm").fill("100");
  await page.locator("#deckBSync").click();
  await page.waitForFunction(
    () => Math.abs(globalThis.__kvDiagnostics().scratchSpeedB - 1.32) < 0.02,
  );
  assert.ok(
    Math.abs(
      (await page.evaluate(() => globalThis.__kvDiagnostics())).scratchSpeed -
        1,
    ) < 0.001,
  );
  await page.locator("#scratchCrossfader").fill("1");
  assert.equal(
    (await page.evaluate(() => globalThis.__kvDiagnostics())).scratchCrossfade,
    1,
  );
  await page.waitForFunction(() => {
    const state = globalThis.__kvDiagnostics();
    return state.scratchGainA < 0.01 && state.scratchGainB > 0.5;
  });
  const wave = page.locator("#deckBWave");
  await wave.press("End");
  assert.equal(await wave.getAttribute("aria-valuenow"), "100");
  await page.locator("#deckBPlay").click();
  assert.equal(
    (await page.evaluate(() => globalThis.__kvDiagnostics())).scratchPlayingB,
    false,
  );
  assert.equal(
    (await page.evaluate(() => globalThis.__kvDiagnostics())).scratchPlaying,
    true,
  );
  await page.addScriptTag({content:axe.source});
  // Deck scope: the baseline release has five unrelated keyboard label mismatches.
  const audit=await page.evaluate(async()=>await globalThis.axe.run({include:[[".dual-deck-layout"],[".dual-deck-mixer"]]}));
  assert.deepEqual(audit.violations.filter(v=>['serious','critical'].includes(v.impact)).flatMap(v=>v.nodes.map(n=>`${v.id}: ${n.target.join(' > ')}`)),[]);
  assert.equal(
    await page.evaluate(
      () =>
        Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        ) <= document.documentElement.clientWidth,
    ),
    true,
  );
});

test('mobile note gestures move pitch and time and resize from the edge',async t=>{
  await ready();const browser=await launchBrowser();t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.goto(`${url}/?qa=1`);await page.locator('.note-block').first().waitFor();
  const note=page.locator('.note-block').first(),id=await note.getAttribute('data-note');
  const target=page.locator(`[data-note="${id}"]`);
  await target.evaluate(el=>el.scrollIntoView({block:'center',inline:'center'}));
  const session=await page.context().newCDPSession(page);
  const drag=async(x,y,dx,dy)=>{
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=5;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/5,y:y+dy*i/5}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  await target.evaluate(el=>{globalThis.__dragNode=el;globalThis.__gridNode=document.querySelector('#rollRuler').firstElementChild;globalThis.__noteMutationCount=0;const observer=new globalThis.MutationObserver(entries=>{globalThis.__noteMutationCount+=entries.filter(e=>e.type==='childList').length});observer.observe(document.querySelector('#sequencer'),{childList:true});globalThis.__dragObserver=observer;});
  const before=await target.evaluate(el=>({left:el.style.left,top:el.style.top,width:el.style.width}));
  let box=await target.boundingBox();
  await drag(box.x+box.width*.25,box.y+box.height/2,45,-box.height*2);
  assert.equal(await target.evaluate(el=>el===globalThis.__dragNode),true);
  assert.equal(await page.evaluate(()=>globalThis.__gridNode===document.querySelector('#rollRuler').firstElementChild),true);
  assert.equal(await page.evaluate(()=>globalThis.__noteMutationCount),0);
  await page.evaluate(()=>globalThis.__dragObserver.disconnect());
  const moved=await target.evaluate(el=>({left:el.style.left,top:el.style.top,width:el.style.width}));
  assert.notEqual(moved.left,before.left);assert.notEqual(moved.top,before.top);assert.equal(moved.width,before.width);
  await target.evaluate(el=>el.scrollIntoView({block:'center',inline:'center'}));
  box=await target.locator('.note-resize').boundingBox();
  await drag(box.x+box.width/2,box.y+box.height/2,55,0);
  assert.ok(parseFloat(await target.evaluate(el=>el.style.width))>parseFloat(moved.width));
  await page.locator('#undoBtn').click();
  assert.equal(await target.evaluate(el=>el.style.width),moved.width);
});

test('clip Bars changes keep playback and progress consistent with the full clip', async t => {
  await ready();
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${url}/?qa=1`, { waitUntil: 'networkidle' });
  await page.locator('#tempo').fill('220');
  await page.locator('#tempo').dispatchEvent('change');
  await goToView(page, 'arrange');
  await page.locator('#arrangeLoopEnd').fill('32');
  await page.locator('#arrangeLoopEnd').dispatchEvent('change');
  await page.locator('#arrangeLoopEnabled').check();
  await goToView(page, 'forge');
  await page.locator('#barsSelect').selectOption('2');
  await page.locator('#clipPosition').fill('28');
  await page.locator('#clipStartBtn').click();
  await page.waitForFunction(() => globalThis.__kvDiagnostics().position >= 31);
  const beforeResize = await page.evaluate(() => globalThis.__kvDiagnostics().position);
  await page.locator('#barsSelect').selectOption('4');
  assert.ok(await page.evaluate(() => globalThis.__kvDiagnostics().position) >= beforeResize);
  await page.waitForFunction(() => +document.querySelector('#clipPosition').value >= 48);
  const progress = await page.locator('.roll-playhead').evaluate(el => parseFloat(el.style.left));
  const zoom = await page.locator('#zoomRange').inputValue();
  assert.ok(progress >= 48 * +zoom);
  await page.waitForFunction(() => globalThis.__kvDiagnostics().position >= 65 && +document.querySelector('#clipPosition').value < 8);
  await page.locator('#clipStartBtn').click();
  await page.locator('#barsSelect').selectOption('8');
  await page.locator('#clipPosition').fill('120');
  await page.locator('#clipStartBtn').click();
  await page.waitForFunction(() => +document.querySelector('#clipPosition').value >= 124);
  await page.waitForFunction(() => globalThis.__kvDiagnostics().position >= 129 && +document.querySelector('#clipPosition').value < 8);
  await page.locator('#barsSelect').selectOption('1');
  await page.waitForFunction(() => parseFloat(document.querySelector('.roll-playhead').style.left) < 16 * +document.querySelector('#zoomRange').value);
  assert.equal(await page.locator('#clipPosition').getAttribute('max'), '15');
  await page.locator('#undoBtn').click();
  assert.equal(await page.locator('#barsSelect').inputValue(), '8');
  assert.equal(await page.locator('#clipPosition').getAttribute('max'), '127');
  await page.locator('#rewindBtn').click();
  assert.deepEqual(errors, []);
});

test('Sound inspector racks reopen after being collapsed', async t => {
  await ready();
  const browser = await launchBrowser();
  t.after(() => browser.close());
  for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
    const page = await context.newPage();
    await page.goto(`${url}/?qa=1`, { waitUntil: 'networkidle' });
    await setSoundInspector(page, true);
    for (const id of ['synthRack', 'motionRack', 'effectsRack', 'macroRack']) {
      const toggle = page.locator(`[data-rack="${id}"]`);
      await toggle.scrollIntoViewIfNeeded();
      const before = await page.locator(`#${id}`).evaluate(rack => rack.classList.contains('collapsed'));
      await toggle.click();
      assert.equal(await page.locator(`#${id}`).evaluate(rack => rack.classList.contains('collapsed')), !before);
      assert.equal(await toggle.getAttribute('aria-expanded'), String(before));
      assert.equal(await toggle.isVisible(), true);
      if (!await page.locator(`#${id}`).evaluate(rack => rack.classList.contains('collapsed'))) await toggle.click();
      assert.equal(await page.locator(`#${id}`).evaluate(rack => rack.classList.contains('collapsed')), true);
      assert.equal(await toggle.textContent(), '+');
      await toggle.scrollIntoViewIfNeeded();
      assert.equal(await toggle.evaluate(button => {
        const box = button.getBoundingClientRect(), rack = button.closest('.collapsible-rack').getBoundingClientRect();
        return box.top >= rack.top && box.bottom <= rack.bottom && box.left >= rack.left && box.right <= rack.right && document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === button;
      }), true, `${id}: the complete + control must remain visible and clickable when collapsed`);
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      await toggle.click();
      await page.locator(`#${id} :is(h1, strong)`).first().click();
      assert.equal(await page.locator(`#${id}`).evaluate(rack => rack.classList.contains('collapsed')), false);
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    }
    await context.close();
  }
});

test('project packages restore every binary including takes into a fresh browser and relink missing sources', {timeout:60000}, async t=>{
  await ready(); const browser=await launchBrowser(); t.after(()=>browser.close());
  const page=await browser.newPage(); await page.addInitScript(()=>Object.defineProperty(globalThis,'showSaveFilePicker',{value:undefined,configurable:true})); await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});
  const expected=await page.evaluate(async(wav)=>{
    const core=await import('/core.js'), p=core.createEmptyProject();
    p.sampler.assetId='shared-source'; p.sampler.name='Shared'; p.sampler.type='audio/wav';
    p.samples.push({id:'drum-source',name:'Drum',type:'audio/wav',slot:0,size:wav.length,trimStart:0,trimEnd:1,tune:0,attack:.002,release:.08,reverse:false});
    const lane=core.createAudioLane('Voice'); lane.regions.push(core.createAudioRegion('shared-source','Region',0,8,1)); p.audioLanes.push(lane);
    const take=core.createPerformanceTake('Recorded performance',8,[]); take.audioAssetId='take-source'; take.mimeType='audio/webm;codecs=opus'; p.performanceTakes.push(take);
    const request=globalThis.indexedDB.open('kiber-vengance-assets-v1',1); request.onupgradeneeded=()=>request.result.createObjectStore('assets'); const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    const bytes=new Uint8Array(wav);
    await new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(new globalThis.Blob([bytes],{type:'audio/wav'}),'shared-source');tx.objectStore('assets').put(new globalThis.Blob([bytes],{type:'audio/wav'}),'drum-source');tx.objectStore('assets').put(new globalThis.Blob([bytes],{type:take.mimeType}),'take-source');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
    globalThis.localStorage.setItem('kiber-vengance-project-v6',JSON.stringify(p)); return p;
  }, [...silentWav()]);
  await page.reload({waitUntil:'networkidle'}); await page.locator('#exportAsBtn').click();
  await page.locator('.export-advanced').nth(1).locator('summary').click();
  const downloadPromise=page.waitForEvent('download'); await page.locator('[data-export="bundle"]').click(); const download=await downloadPromise;
  const buffer=readFileSync(await download.path());
  const fresh=await browser.newPage(); await fresh.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});
  await fresh.locator('#menuBtn').click(); await fresh.locator('#importProject').setInputFiles({name:'portable.zip',mimeType:'application/zip',buffer});
  await fresh.waitForFunction(()=>JSON.parse(globalThis.localStorage.getItem('kiber-vengance-project-v6'))?.performanceTakes.length===1);
  const restored=await fresh.evaluate(async()=>{
    const db=await new Promise(resolve=>{const r=globalThis.indexedDB.open('kiber-vengance-assets-v1',1);r.onsuccess=()=>resolve(r.result)});
    const get=id=>new Promise(resolve=>{const r=db.transaction('assets').objectStore('assets').get(id);r.onsuccess=()=>resolve(r.result)});
    const result=[];for(const id of ['shared-source','take-source','drum-source']){const blob=await get(id);result.push({id,type:blob.type,bytes:[...new Uint8Array(await blob.arrayBuffer())]})}return result;
  });
  assert.deepEqual(restored,[{id:'shared-source',type:'audio/wav',bytes:[...silentWav()]},{id:'take-source',type:'audio/webm;codecs=opus',bytes:[...silentWav()]},{id:'drum-source',type:'audio/wav',bytes:[...silentWav()]}]);
  assert.equal(await fresh.evaluate(()=>JSON.parse(globalThis.localStorage.getItem('kiber-vengance-project-v6')).performanceTakes[0].audioAssetId),expected.performanceTakes[0].audioAssetId);
  await fresh.evaluate(async()=>{const db=await new Promise(resolve=>{const r=globalThis.indexedDB.open('kiber-vengance-assets-v1',1);r.onsuccess=()=>resolve(r.result)});await new Promise(resolve=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').delete('take-source');tx.oncomplete=resolve})});
  await fresh.reload({waitUntil:'networkidle'}); await fresh.locator('#missingAssetsDialog').waitFor();
  await fresh.locator('#missingAssetsDialog input').setInputFiles({name:'take.webm',mimeType:'audio/webm',buffer:silentWav()});
  await fresh.waitForFunction(()=>!document.querySelector('#missingAssetsDialog'));
});

test('local voice controls are opt-in, bilingual, cancellable and preserve captured insertion with undo', {timeout:60000}, async t=>{
  await ready();const browser=await launchBrowser();t.after(()=>browser.close());
  // Protocol fixture only: real speech evidence comes from test-local-voice.mjs.
  const fixture=`self.onmessage=({data})=>{if(data.kind==='load')self.postMessage({kind:'loaded'});if(data.kind==='generate')setTimeout(()=>{const pcm=new Float32Array(24000);for(let i=0;i<pcm.length;i++)pcm[i]=.1*Math.sin(i*2*Math.PI*220/24000);self.postMessage({kind:'audio',pcm,sampleRate:24000,phonemes:'fixture'})},300)};`;
  for(const viewport of [{width:1366,height:1000},{width:390,height:844}]){
    const page=await browser.newPage({viewport}),requests=[];page.on('request',request=>{if(/huggingface.co/.test(request.url()))requests.push(request.url())});
    await page.route('**/voice-worker-*.js',route=>route.fulfill({contentType:'text/javascript',body:fixture}));
    await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});await goToView(page,'audio');await page.locator('#localVoiceBtn').click();
    assert.equal(requests.length,0);assert.equal(await page.locator('#generateLocalVoice').isDisabled(),true);
    await page.locator('#voiceLanguage').selectOption('es');await page.locator('#voiceText').fill('Una frase de prueba.');
    await page.locator('#loadLocalVoice').click();await page.waitForFunction(()=>!globalThis.document.querySelector('#generateLocalVoice').disabled);
    await page.locator('#generateLocalVoice').click();await page.locator('#voicePreview').waitFor();
    await page.waitForFunction(()=>!globalThis.document.querySelector('#insertLocalVoice').disabled);
    await page.locator('#insertLocalVoice').click();await page.waitForFunction(()=>!globalThis.document.querySelector('#loadLocalVoice').disabled);
    await page.locator('#localVoiceDialog header button').click();assert.equal(await page.locator('.audio-region').count(),1);
    await page.locator('#undoBtn').click();assert.equal(await page.locator('.audio-region').count(),0);await page.locator('#redoBtn').click();assert.equal(await page.locator('.audio-region').count(),1);
    await page.locator('#localVoiceBtn').click();await page.locator('#generateLocalVoice').click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await page.locator('#voicePreview').count(),1);assert.equal(await page.locator('#generateLocalVoice').isDisabled(),true);
    await page.addScriptTag({content:axe.source});const audit=await page.evaluate(async()=>await globalThis.axe.run(globalThis.document.querySelector('#localVoiceDialog')));
    assert.deepEqual(audit.violations.filter(v=>['critical','serious'].includes(v.impact)).map(v=>v.id),[]);
    assert.equal(await page.locator('#localVoiceDialog').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth),true);
    await page.screenshot({path:`${tmpdir()}/kiber-voice-${viewport.width}.png`});await page.close();
  }
});

test('offline WAV uses the tempo map, global master and audio isolation', {timeout:60000}, async t=>{
  await ready();const browser=await launchBrowser();t.after(()=>browser.close());const page=await browser.newPage();await page.goto(`${url}/?qa=1`);
  const result=await page.evaluate(async()=>{
    const core=await import('/core.js'),{renderWav}=await import('/audio.js'),p=core.createEmptyProject();p.clips.forEach(clip=>clip.bars=1);p.swing=0;p.masterSettings.bypass=true;p.master=1;
    p.tempoMap=[{id:'a',step:0,bpm:120,curve:'jump'},{id:'b',step:8,bpm:60,curve:'jump'}];
    const context=new globalThis.OfflineAudioContext(2,44100,44100),buffer=context.createBuffer(1,44100*4,44100);const pcm=buffer.getChannelData(0);for(let i=0;i<pcm.length;i++)pcm[i]=.1*Math.sin(i*2*Math.PI*220/44100);
    const lane=core.createAudioLane('Reference');lane.regions.push(core.createAudioRegion('ref','Reference',0,16,4));p.audioLanes.push(lane);
    const options={song:true,bitDepth:32,sampleRate:44100,tailSeconds:0,audioAssets:new Map([['ref',buffer]])};
    const measure=async(project)=>{const wav=await renderWav(project,options),v=new DataView(await wav.arrayBuffer());let sum=0,count=0;for(let at=44;at<v.byteLength;at+=4){const n=v.getFloat32(at,true);sum+=n*n;count++}return {duration:(v.byteLength-44)/8/44100,rms:Math.sqrt(sum/count)}};
    const full=await measure(p);const automation=core.createAutomationLane('master.volume');automation.points=[{id:'zero',step:0,value:.5,curve:'jump'}];p.automationLanes.push(automation);const half=await measure(p);
    const isolated=globalThis.structuredClone(p);isolated.audioLanes=[];const silent=await measure(isolated);
    return {full,half,silent};
  });
  assert.equal(result.full.duration,3);assert.ok(result.full.rms>.02);assert.ok(Math.abs(result.half.rms/result.full.rms-.5)<.03);assert.equal(result.silent.rms,0);
});

test('recovery preserves unreadable autosave and flushes pending edits on page hide', {timeout:30000}, async t=>{
  await ready();const browser=await launchBrowser();t.after(()=>browser.close());const page=await browser.newPage();
  await page.addInitScript(()=>{if(!globalThis.sessionStorage.getItem('seeded')){globalThis.localStorage.setItem('kiber-vengance-project-v6','{broken autosave');globalThis.sessionStorage.setItem('seeded','1')}});
  await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>Object.keys(globalThis.localStorage).some(key=>key.startsWith('kiber-vengance-project-v6-unreadable-')&&globalThis.localStorage.getItem(key)==='{broken autosave')),true);
  await page.locator('#title').fill('Flushed before reload');await page.locator('#title').dispatchEvent('change');
  await page.evaluate(()=>globalThis.dispatchEvent(new globalThis.Event('pagehide')));
  assert.equal(await page.evaluate(()=>JSON.parse(globalThis.localStorage.getItem('kiber-vengance-project-v6')).title),'Flushed before reload');
  await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#title').inputValue(),'Flushed before reload');
  await page.evaluate(()=>{globalThis.Storage.prototype.setItem=()=>{throw new globalThis.DOMException('Quota full','QuotaExceededError')}});
  await page.locator('#title').fill('Still exportable');await page.locator('#title').dispatchEvent('change');await page.locator('#saveWarning').waitFor();
  await page.addInitScript(()=>Object.defineProperty(globalThis,'showSaveFilePicker',{value:undefined,configurable:true}));
  await page.evaluate(()=>Object.defineProperty(globalThis,'showSaveFilePicker',{value:undefined,configurable:true}));
  await page.locator('#exportAsBtn').click();await page.locator('.export-advanced').nth(1).locator('summary').click();const saved=page.waitForEvent('download');await page.locator('[data-export="project"]').click();assert.match((await saved).suggestedFilename(),/\.kiber.json$/);
});


test('audio region buses respond to instrument Solo while their source remains playing', {timeout:30000}, async t=>{
 await ready();const browser=await launchBrowser();t.after(()=>browser.close());const page=await browser.newPage();await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});await goToView(page,'audio');
 await page.locator('#audioImport').setInputFiles({name:'long-source.wav',mimeType:'audio/wav',buffer:silentWav(8)});await page.locator('.audio-region').waitFor();await page.locator('#playBtn').click();
 await page.waitForFunction(()=>globalThis.__kvDiagnostics().activeAudioRegions>0&&globalThis.__kvDiagnostics().audioLaneLevels.some(level=>level>.4));
 await page.locator('[data-solo="lead"]').click();await page.waitForFunction(()=>globalThis.__kvDiagnostics().audioLaneLevels.every(level=>level<.001));
 assert.ok((await page.evaluate(()=>globalThis.__kvDiagnostics())).activeAudioRegions>0);
 await page.locator('[data-solo="lead"]').click();await page.waitForFunction(()=>globalThis.__kvDiagnostics().audioLaneLevels.some(level=>level>.4));await page.locator('#pauseBtn').click();
 assert.equal((await page.evaluate(()=>globalThis.__kvDiagnostics())).audioLaneLevels.length,0);
});
