import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import * as installedPlaywright from 'playwright';
// Keep Chromium's current launch flags; legacy all-browser launchers can stall
// AudioWorklet even with a compatible Chromium executable on older macOS.
const chromium=installedPlaywright.chromium;
const firefox=process.env.FIREFOX_PLAYWRIGHT_MODULE?(await import(process.env.FIREFOX_PLAYWRIGHT_MODULE)).firefox:installedPlaywright.firefox;

export function browserOptions(kind='chromium') {
  const type=kind==='firefox'?firefox:chromium;
  const explicit=process.env[kind==='firefox'?'FIREFOX_EXECUTABLE_PATH':'CHROMIUM_EXECUTABLE_PATH'];
  if(explicit) return {headless:true,executablePath:explicit};
  if(existsSync(type.executablePath())) return {headless:true};
  if(kind==='chromium'&&existsSync('/usr/bin/chromium')) return {headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']};
  for(const cache of [resolve('.cache/ms-playwright'),resolve('..','.cache/ms-playwright')]) {
    if(!existsSync(cache))continue;
    const prefix=kind==='firefox'?'firefox-':'chromium-';
    for(const entry of readdirSync(cache).filter(name=>name.startsWith(prefix)).sort().reverse()) {
      const path=resolve(cache,entry,kind==='firefox'?'firefox/firefox':'chrome-linux64/chrome');
      if(existsSync(path))return {headless:true,executablePath:path,...(kind==='firefox'?{firefoxUserPrefs:{'media.autoplay.default':0,'media.autoplay.block-webaudio':false}}:{})};
    }
  }
  throw new Error(`Missing ${kind} browser. Run npx playwright install ${kind}, or set ${kind.toUpperCase()}_EXECUTABLE_PATH. Tests are not skipped.`);
}

export async function launchBrowser(kind='chromium',overrides={}) {
  const options=browserOptions(kind);
  const browser=await (kind==='firefox'?firefox:chromium).launch({...options,...overrides,args:[...(options.args||[]),...(overrides.args||[])]});
  const newPage=browser.newPage.bind(browser);browser.newPage=async options=>{const page=await newPage(options);page.setDefaultTimeout(10000);return page};
  return browser;
}

export function preview(port) {
  const root=resolve(dirname(new URL(import.meta.url).pathname),'..');
  const url=`http://127.0.0.1:${port}`;
  const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  let output='';server.stdout.on('data',chunk=>{output+=chunk});server.stderr.on('data',chunk=>{output+=chunk});
  let failure;server.on('error',error=>{failure=error});
  const ready=async()=>{for(let i=0;i<100;i++){if(failure)throw failure;if(server.exitCode!==null)throw new Error(`Preview exited: ${output}`);try{if((await fetch(url)).ok)return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw new Error(`Preview did not start: ${output}`)};
  return {url,ready,close:()=>{if(!server.killed)server.kill('SIGTERM')}};
}

// New grouped navigation and the original DOM both expose the same feature views.
export async function goToView(page,view) {
  // Navigation must wait for Preact to bind the visible shell, rather than
  // clicking the unbound controls in the static HTML during a cold load.
  await page.locator('#app.studio-shell .studio-nav [data-space]').first().waitFor({state:'attached'});
  if(await page.locator('#soundInspectorBtn[aria-expanded=true]').count())await setSoundInspector(page,false);
  const direct=page.locator(`[data-view="${view}"]`);
  for(let i=0;i<await direct.count();i++)if(await direct.nth(i).isVisible()){await direct.nth(i).click();return}
  const space={forge:'compose',audio:'arrange',arrange:'arrange',launch:'live',perform:'live',mix:'mix'}[view];
  const spaceButton=page.locator(`[data-space="${space}"]`);
  if(await spaceButton.count())await spaceButton.first().click();
  const tab=page.locator(`[data-view="${view}"]`).filter({visible:true});if(await tab.count())await tab.first().click();
  await page.waitForFunction(expected=>document.querySelector('#app')?.dataset.activeView===expected||document.querySelector(`#${expected}View`)?.classList.contains('active'),view);
}

export async function setSoundInspector(page,open=true) {
  const toggle=page.locator('#soundInspectorBtn');
  if(await toggle.count()) {
    if((await toggle.getAttribute('aria-expanded')==='true')!==open){if(!open&&await page.locator('#studioInspector button[aria-label]').count())await page.locator('#studioInspector button[aria-label]').first().click();else await toggle.click()}
    return;
  }
  const tab=page.locator(`[data-studio-tab="${open?'sound':'clips'}"]`).filter({visible:true}).first();
  await tab.click();
}

export async function setTransportSetting(page,id,value) {
  if(await page.locator('#soundInspectorBtn[aria-expanded=true]').count())await setSoundInspector(page,false);
  const details=page.locator('details.transport-settings');
  const opened=await details.count()&&!await details.evaluate(el=>el.open);
  if(opened)await page.locator('#transportSettingsBtn').click();
  const control=page.locator('#'+id);
  if(await control.evaluate(el=>el.tagName==='SELECT'))await control.selectOption(value);else await control.fill(value);
  if(opened)await page.locator('#transportSettingsBtn').click();
}
