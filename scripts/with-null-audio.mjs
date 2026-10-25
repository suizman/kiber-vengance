// Optional CI wrapper for Linux hosts with no audio device.
// Usage: node scripts/with-null-audio.mjs node --test tests/browser.test.js tests/e2e.test.js
import { existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const [command,...args]=process.argv.slice(2);
if(!command)throw new Error('Pass a test command after with-null-audio.mjs');
const portable=resolve('..','.cache/pulse');
const binary=process.env.PULSEAUDIO_EXECUTABLE_PATH||(existsSync(join(portable,'usr/bin/pulseaudio'))?join(portable,'usr/bin/pulseaudio'):'pulseaudio');
if(spawnSync(binary,['--version'],{env:{...process.env,LD_LIBRARY_PATH:[join(portable,'usr/lib/x86_64-linux-gnu/pulseaudio'),join(portable,'usr/lib/x86_64-linux-gnu'),process.env.LD_LIBRARY_PATH||''].join(':')}}).error)throw new Error('Install pulseaudio or set PULSEAUDIO_EXECUTABLE_PATH for CI audio tests.');
const runtime=mkdtempSync(join(tmpdir(),'kiber-test-audio-')),socket=join(runtime,'native');
let modulePath;
const lib=join(portable,'usr/lib');
if(existsSync(lib)){const folder=readdirSync(lib).find(name=>name.startsWith('pulse-'));if(folder)modulePath=join(lib,folder,'modules')}
const env={...process.env,PULSE_RUNTIME_PATH:runtime,LD_LIBRARY_PATH:[modulePath||'',join(portable,'usr/lib/x86_64-linux-gnu/pulseaudio'),join(portable,'usr/lib/x86_64-linux-gnu'),process.env.LD_LIBRARY_PATH||''].filter(Boolean).join(':')};
const daemon=spawn(binary,['--daemonize=no','--exit-idle-time=-1','--use-pid-file=no','--disable-shm','-n',...(modulePath?[`--dl-search-path=${modulePath}`]:[]),`--load=module-native-protocol-unix socket=${socket} auth-anonymous=1`,'--load=module-null-sink sink_name=kiber_test'],{env,stdio:['ignore','ignore','pipe']});
let output='';daemon.stderr.on('data',data=>{output+=data});
let runner;
const cleanup=()=>{runner?.kill('SIGTERM');daemon.kill('SIGTERM')};
process.once('SIGINT',cleanup);process.once('SIGTERM',cleanup);
try{
 for(let i=0;i<100&&!existsSync(socket);i++){if(daemon.exitCode!==null)throw new Error(output);await new Promise(resolve=>setTimeout(resolve,50))}
 if(!existsSync(socket))throw new Error(`Null audio server did not start: ${output}`);
 runner=spawn(command,args,{env:{...process.env,PULSE_SERVER:`unix:${socket}`},stdio:'inherit'});
 process.exitCode=await new Promise((resolve,reject)=>{runner.on('error',reject);runner.on('exit',code=>resolve(code??1))});
}finally{cleanup();rmSync(runtime,{recursive:true,force:true})}
