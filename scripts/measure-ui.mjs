// Local repeatable reference; these numbers are not mobile-network field metrics.
import { launchBrowser, preview } from '../tests/browser-support.js';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
const server=preview(4197);await server.ready();let browser;
try {
  browser=await launchBrowser();const runs=[];
  for(let i=0;i<5;i++) {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(`${server.url}/?qa=1`);await page.locator('.note-block').first().waitFor();
    runs.push(await page.evaluate(()=>{
      const navigation=performance.getEntriesByType('navigation')[0];
      return {uiVisibleCheckMs:performance.now(),domContentLoadedMs:navigation.domContentLoadedEventEnd,loadMs:navigation.loadEventEnd,domNodes:document.querySelectorAll('*').length};
    }));await page.close();
  }
  const assets=[];const scan=directory=>{for(const name of readdirSync(directory)){const path=resolve(directory,name);if(statSync(path).isDirectory())scan(path);else if(/\.(js|css|html)$/.test(name)){const data=readFileSync(path);assets.push({file:relative(resolve('dist'),path),bytes:data.length,gzipBytes:gzipSync(data).length})}}};scan(resolve('dist'));
  console.log(JSON.stringify({environment:'Chromium, localhost, 390x844, fresh page per run, no CPU/network throttling',runs,assets},null,2));
}finally{await browser?.close();server.close()}
