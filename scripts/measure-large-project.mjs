// Reproducible lab benchmark. Optional first argument is an isolated baseline checkout.
import { launchBrowser, preview } from '../tests/browser-support.js';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createEmptyProject, activeClip, makeNote } from '../dist/core.js';
const baseline = process.argv[2];
const current = preview(4271); await current.ready();
let reference;
const targets = [{ name: 'v7', url: current.url }];
if (baseline) {
  reference = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: resolve(baseline), env: { ...process.env, PORT: '4272' }, stdio: 'ignore' });
  for (let i=0;i<100;i++) { try { if ((await fetch('http://127.0.0.1:4272')).ok) break; } catch {} await new Promise(r=>setTimeout(r,50)); }
  targets.unshift({ name: 'v6', url: 'http://127.0.0.1:4272' });
}
const browser = await launchBrowser(); const results = [];
try {
  for (const target of targets) for (const count of [1000,10000]) for (let run=0;run<3;run++) {
    const project=createEmptyProject(),clip=activeClip(project,'lead');
    project.version=6;clip.bars=64;clip.notes=Array.from({length:count},(_,i)=>makeNote((i*7)%1024,48+i%40,.75));
    const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
    await page.addInitScript(project=>{
      globalThis.localStorage.setItem('kiber-vengance-project-v6',JSON.stringify(project));
      globalThis.__longTasks=[];new globalThis.PerformanceObserver(list=>globalThis.__longTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});
    },project);
    const session=await page.context().newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:4});
    await page.goto(target.url+'/?qa=1');await page.locator('#app.studio-shell .note-block').first().waitFor();
    const result=await page.evaluate(()=>({readyMs:performance.now(),domNodes:document.querySelectorAll('*').length,longestTaskMs:Math.max(0,...globalThis.__longTasks)}));
    results.push({version:target.name,notes:count,run,...result});console.log(JSON.stringify(results.at(-1)));await page.close();
  }
  await writeFile('docs/performance-v7.json',JSON.stringify({environment:'Chromium; localhost; 390x844 touch; 4x CPU throttling; fresh storage; no network throttling; three runs; identical 64-bar fixture',baselineCommit:'31826ed4d37357f41179d21552705dd23ff77ad2',results},null,2)+'\n');
} finally { await browser.close();current.close();reference?.kill('SIGTERM'); }
