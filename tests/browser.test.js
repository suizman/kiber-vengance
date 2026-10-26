import test from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, preview, goToView, setSoundInspector, setTransportSetting } from './browser-support.js';
import axe from 'axe-core';

const server=preview(4201),{url,ready}=server;
function silentWav(){const frames=8000,buffer=Buffer.alloc(44+frames*2);buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(8000,24);buffer.writeUInt32LE(16000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(frames*2,40);return buffer}

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

test('quick exports remember file handles and overwrite the same destination',async t=>{
  await ready();const browser=await launchBrowser();t.after(async()=>{await browser.close()});const page=await browser.newPage({viewport:{width:1280,height:900}});await page.addInitScript(()=>{globalThis.__quickSaves={pickers:0,writes:[]};Object.defineProperty(globalThis,'showSaveFilePicker',{configurable:true,value:async options=>{const name=options.suggestedName;globalThis.__quickSaves.pickers++;return{name,queryPermission:async()=>'granted',requestPermission:async()=>'granted',createWritable:async()=>({write:async data=>globalThis.__quickSaves.writes.push({name,size:data.size??data.byteLength??String(data).length}),close:async()=>{}})}}})});await page.goto(`${url}/?qa=1`,{waitUntil:'networkidle'});await page.locator('.note-block').first().waitFor();
  const waitForWrites=expected=>page.waitForFunction(count=>globalThis.__quickSaves.writes.length===count,expected,{timeout:30000});
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
  await goToView(page,'mix');assert.equal(await page.locator('.mixer-channel').count(),5);await page.locator('[data-mix-track="lead"] [data-mix="faderDb"]').fill('-8.6');assert.equal(await page.locator('[data-mix-track="lead"] .mix-fader output').textContent(),'-8.6 dB');await page.locator('[data-mix-track="lead"] [data-mix-solo]').click();assert.equal(await page.locator('[data-solo="lead"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#arrangeTimeline button').count(),4);
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
  await page.keyboard.up('w');
  await page.waitForFunction(()=>globalThis.__kvDiagnostics().liveVoices===0);
  await goToView(page,'perform');
  const liveChromatic=page.locator('#performanceKeyboard .key[data-source="w"]');
  await page.keyboard.down('w');
  await page.waitForFunction(()=>globalThis.__kvDiagnostics().liveVoices===1);
  assert.equal(await liveChromatic.evaluate(node=>node.classList.contains('active')),true);
  await page.keyboard.up('w');
  await page.waitForFunction(()=>globalThis.__kvDiagnostics().liveVoices===0);
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

test('installable build exposes its Cyrillic identity, manifest and service worker',async t=>{await ready();const browser=await launchBrowser();t.after(async()=>{await browser.close()});const page=await browser.newPage();await page.goto(url,{waitUntil:'networkidle'});assert.equal(await page.locator('.brand-word b').first().textContent(),'КИБЕР');assert.ok(await page.locator('.brand-emblem').count()>=4);assert.equal(await page.locator('link[rel="manifest"]').getAttribute('href'),'manifest.webmanifest');const manifest=await page.evaluate(async()=>await (await fetch('manifest.webmanifest')).json());assert.equal(manifest.name,'КИБЕР VENGANCE');await page.waitForFunction(()=>navigator.serviceWorker?.controller||navigator.serviceWorker?.ready);const registration=await page.evaluate(async()=>Boolean(await navigator.serviceWorker.getRegistration()));assert.equal(registration,true)});

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
  const audit=await page.evaluate(async()=>await globalThis.axe.run(document));
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
  const before=await target.evaluate(el=>({left:el.style.left,top:el.style.top,width:el.style.width}));
  let box=await target.boundingBox();
  await drag(box.x+box.width*.25,box.y+box.height/2,45,-box.height*2);
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
