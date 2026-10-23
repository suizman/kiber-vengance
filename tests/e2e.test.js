import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Builder, By, until } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { download as downloadGecko } from 'geckodriver';

const port=4199,url=`http://127.0.0.1:${port}`,server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port)},stdio:'ignore'});
async function ready(){for(let i=0;i<40;i++){try{if((await fetch(url)).ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw new Error('Preview server did not start')}

test('complete composition flow works in Firefox',async t=>{
  await ready();const binary=await downloadGecko('0.37.1'),options=new firefox.Options().addArguments('-headless').windowSize({width:1440,height:1000}),service=new firefox.ServiceBuilder(binary),driver=await new Builder().forBrowser('firefox').setFirefoxOptions(options).setFirefoxService(service).build();
  t.after(async()=>{await driver.quit();server.kill('SIGTERM')});
  await driver.get(`${url}/?qa=1`);await driver.wait(until.elementLocated(By.css('.note-block')),5000);
  assert.equal((await driver.findElements(By.css('.track'))).length,5);
  assert.ok((await driver.findElements(By.css('.pitch-label'))).length>=40);
  assert.ok((await driver.findElements(By.css('.note-block'))).length>5);
  assert.equal((await driver.findElements(By.css('[data-fx="saturation"]'))).length,1);

  const before=await driver.findElements(By.css('.note-block')),seq=await driver.findElement(By.id('sequencer'));
  await driver.executeScript("const el=arguments[0],r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+350,clientY:r.bottom-12}))",seq);
  assert.equal((await driver.findElements(By.css('.note-block'))).length,before.length+1);

  await driver.findElement(By.css('[data-view="arrange"]')).click();await driver.wait(until.elementLocated(By.css('.scene-clips')),2000);const sceneCount=(await driver.findElements(By.css('.scene'))).length;await driver.findElement(By.id('addSceneBtn')).click();assert.equal((await driver.findElements(By.css('.scene'))).length,sceneCount+1);assert.equal((await driver.findElements(By.css('.scene-clips select'))).length,(sceneCount+1)*5);

  await driver.findElement(By.id('playBtn')).click();await driver.sleep(5500);assert.match(await driver.findElement(By.id('audioState')).getText(),/RUNNING|COUNT/);
  await driver.findElement(By.css('[data-view="forge"]')).click();const liveKey=await driver.findElement(By.css('#keyboard .key'));await driver.executeScript('arguments[0].scrollIntoView({block:"center"})',liveKey);await driver.actions({async:true}).move({origin:liveKey}).press().perform();await driver.sleep(650);assert.equal((await driver.executeScript('return window.__kvDiagnostics()')).liveVoices,1);await driver.actions({async:true}).release().perform();await driver.sleep(250);assert.equal((await driver.executeScript('return window.__kvDiagnostics()')).liveVoices,0);
  await driver.findElement(By.id('playBtn')).click();
  await driver.findElement(By.id('exportBtn')).click();await driver.findElement(By.id('clipWavBtn')).click();await driver.wait(async()=>/WAV READY/.test(await driver.findElement(By.id('renderStatus')).getText()),20000);
  const stored=await driver.executeScript("return JSON.parse(localStorage.getItem('kiber-vengance-project-v4'))");assert.equal(stored.version,4);assert.ok(stored.clips.length>=10);assert.ok(stored.clips.every(clip=>clip.character?.fx&&clip.character?.macros));assert.deepEqual(await driver.executeScript('return window.__kvErrors'),[]);
});

test.after(()=>{if(!server.killed)server.kill('SIGTERM')});
