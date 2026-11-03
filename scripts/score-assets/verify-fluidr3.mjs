import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const {launchBrowser}=await import('../../tests/browser-support.js');
const root=path.resolve(process.argv[2]||'public/soundfonts/fluidr3-gm-1');
const manifest=JSON.parse(await fs.readFile(root+'/manifest.json','utf8'));
for(const asset of [...manifest.programs,...manifest.drums,...manifest.samples,...manifest.licenses]){
 const data=await fs.readFile(path.join(root,asset.path));
 if(crypto.createHash('sha256').update(data).digest('hex')!==asset.sha256)throw Error(`Hash mismatch ${asset.path}`);
}
const server=createServer(async(req,res)=>{
 try{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);const target=path.resolve(root,rel||'manifest.json');if(!target.startsWith(root+'/')){res.writeHead(400);res.end();return}const b=await fs.readFile(target);res.setHeader('Content-Type',target.endsWith('.json')?'application/json':target.endsWith('.mp3')?'audio/mpeg':'application/octet-stream');res.end(b)}catch{res.writeHead(404);res.end()}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
const browser=await launchBrowser();
try{
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${port}/manifest.json`);
 const report=await page.evaluate(async()=>{
  const manifest=await fetch('/manifest.json').then(r=>r.json());const ctx=new OfflineAudioContext(1,1,44100),decoded=new Map(),errors=[];let totalFrames=0,channels={},silent=0,maxMB=0;
  for(const sample of manifest.samples){
   try{const bytes=await fetch('/'+sample.path).then(r=>r.arrayBuffer());const b=await ctx.decodeAudioData(bytes);let peak=0;for(let ch=0;ch<b.numberOfChannels;ch++){const data=b.getChannelData(ch);for(let i=0;i<data.length;i+=16)peak=Math.max(peak,Math.abs(data[i]));}const mb=b.length*b.numberOfChannels*4/1048576;maxMB=Math.max(maxMB,mb);totalFrames+=b.length*b.numberOfChannels;channels[b.numberOfChannels]=(channels[b.numberOfChannels]||0)+1;if(!peak)silent++;decoded.set(sample.sha256,{duration:b.duration,frames:b.length,channels:b.numberOfChannels,peak,pcmMB:mb});}catch(e){errors.push({path:sample.path,error:String(e)})}
  }
  const loopProblems=[],coverage=[],programMemory=[];
  for(const instrument of [...manifest.programs,...manifest.drums]){
   const meta=await fetch('/'+instrument.path).then(r=>r.json());const set=new Set();let decodedMB=0;
   for(const [i,z]of meta.zones.entries()){
    const b=decoded.get(z.sample.sha256);if(!b)continue;
    if(!set.has(z.sample.sha256)){decodedMB+=b.pcmMB;set.add(z.sample.sha256)}
    if(z.loopEnd>z.loopStart&&z.loopEnd/z.sampleRate>b.duration+1/44100)loopProblems.push({instrument:instrument.number,kind:meta.kind,zone:i,loopEndSeconds:z.loopEnd/z.sampleRate,duration:b.duration});
   }
   if(meta.kind==='program'){
    const gaps=[];for(let p=0;p<128;p++)if(!meta.zones.some(z=>p>=z.keyRangeLow&&p<=z.keyRangeHigh))gaps.push(p);
    if(gaps.length)coverage.push({program:instrument.number,gaps});programMemory.push({program:instrument.number,decodedMB:Number(decodedMB.toFixed(3))});
   }
  }
  return {decoded:decoded.size,errors,silent,totalDecodedMB:totalFrames*4/1048576,maxSampleMB:maxMB,channels,loopProblems,coverage,largestProgramMemory:programMemory.sort((a,b)=>b.decodedMB-a.decodedMB).slice(0,8)};
 });
 await fs.writeFile('docs/instrument-bank-verification.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({decoded:report.decoded,errors:report.errors.length,silent:report.silent,totalDecodedMB:report.totalDecodedMB,maxSampleMB:report.maxSampleMB,channels:report.channels,loopProblems:report.loopProblems.length,instrumentsWithRangeGaps:report.coverage.length,largestProgramMemory:report.largestProgramMemory}));
}finally{await browser.close();server.close()}
