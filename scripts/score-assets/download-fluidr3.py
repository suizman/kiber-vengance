from pathlib import Path
import urllib.request,urllib.error,json,hashlib,concurrent.futures,time,argparse
parser=argparse.ArgumentParser();parser.add_argument('--root',default='.cache/score-assets');ROOT=Path(parser.parse_args().root)
COMMIT='23ca907d4370a04fd89ca483a92915e4d6159ab9'
BASE=f'https://raw.githubusercontent.com/surikov/webaudiofontdata/{COMMIT}/sound/'
CACHE=ROOT/'source-cache';CACHE.mkdir(parents=True,exist_ok=True)
jobs=[{'id':f'program-{n:03d}','kind':'program','number':n,'filename':f'{n:03d}0_FluidR3_GM_sf2_file.js'} for n in range(128)]
jobs += [{'id':f'drum-{n:03d}','kind':'drum','number':n,'filename':f'128{n}_0_FluidR3_GM_sf2_file.js'} for n in range(35,82)]
def download(job):
 url=BASE+job['filename'];path=CACHE/job['filename'];err=None
 for attempt in range(4):
  try:
   if path.exists():data=path.read_bytes()
   else:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Kiber-FluidR3-AssetBuilder'}),timeout=35) as response:
     data=response.read(33554433)
    if len(data)>33554432:raise ValueError('Asset exceeds 32 MiB per-file budget')
    path.write_bytes(data)
   return {**job,'sourceUrl':url,'sourceCommit':COMMIT,'sourcePath':str(path),'sourceBytes':len(data),'sourceSha256':hashlib.sha256(data).hexdigest()}
  except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError) as e:
   err=str(e)
   if isinstance(e,urllib.error.HTTPError) and e.code==404:break
   time.sleep(min(3,attempt+1))
 return {**job,'sourceUrl':url,'sourceCommit':COMMIT,'error':err}
results=[]
with concurrent.futures.ThreadPoolExecutor(6) as pool:
 for i,result in enumerate(pool.map(download,jobs)):
  results.append(result)
  if result.get('error'):print(json.dumps(result),flush=True)
  elif (i+1)%20==0:print(json.dumps({'downloaded':i+1,'of':len(jobs),'sourceBytes':sum(r.get('sourceBytes',0) for r in results)}),flush=True)
license_sources=[]
for name,url,encoding in [
 ('WebAudioFont-data-MIT.txt',f'https://raw.githubusercontent.com/surikov/webaudiofontdata/{COMMIT}/LICENSE','utf-8'),
 ('FluidR3-license-source.md','https://raw.githubusercontent.com/musescore/MuseScore/3224f342d12f4af8ea782e929c49f5ce85f97da6/share/sound/FluidR3Mono_License.md','latin-1')
]:
 with urllib.request.urlopen(url,timeout=35) as response:data=response.read()
 source=CACHE/name;source.write_bytes(data)
 license_sources.append({'name':name,'url':url,'encoding':encoding,'sourcePath':str(source),'sourceBytes':len(data),'sourceSha256':hashlib.sha256(data).hexdigest()})
(ROOT/'fluid-source-lock.json').write_text(json.dumps({'schemaVersion':1,'repository':'https://github.com/surikov/webaudiofontdata','commit':COMMIT,'assets':results,'licenseSources':license_sources},indent=2)+'\n')
print(json.dumps({'completed':len(results),'failures':sum('error' in r for r in results),'sourceBytes':sum(r.get('sourceBytes',0) for r in results)}),flush=True)
