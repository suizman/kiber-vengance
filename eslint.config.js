const readonly='readonly';
const browserGlobals=Object.fromEntries(['window','self','document','navigator','localStorage','location','caches','indexedDB','crypto','structuredClone','Blob','DOMException','URL','URLSearchParams','Event','prompt','confirm','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout','setInterval','clearInterval','Audio','AudioContext','OfflineAudioContext','AudioWorkletNode','AudioWorkletProcessor','MediaRecorder','AbortController','registerProcessor','sampleRate','performance','Uint8Array','Float32Array','ArrayBuffer','DataView','TextDecoder','TextEncoder','console','fetch'].map(name=>[name,readonly]));
const nodeGlobals=Object.fromEntries(['process','Buffer','URL','TextDecoder','fetch','document','navigator','Event','PointerEvent','setTimeout','clearTimeout','console'].map(name=>[name,readonly]));

export default [
  {ignores:['node_modules/**']},
  {files:['dist/**/*.js'],languageOptions:{ecmaVersion:'latest',sourceType:'module',globals:browserGlobals},rules:{'no-undef':'error','no-unreachable':'error','no-dupe-keys':'error','no-constant-binary-expression':'error','no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_',caughtErrors:'none'}]}},
  {files:['tests/**/*.js','scripts/**/*.js','eslint.config.js'],languageOptions:{ecmaVersion:'latest',sourceType:'module',globals:nodeGlobals},rules:{'no-undef':'error','no-unreachable':'error','no-dupe-keys':'error','no-constant-binary-expression':'error','no-unused-vars':['error',{argsIgnorePattern:'^_',caughtErrors:'none'}]}}
];
