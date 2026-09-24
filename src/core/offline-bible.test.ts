import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {downloadOfflineBible,offlineBibleManifest,offlineStatus,OFFLINE_BIBLE_CACHE,PUBLIC_SHELL_CACHE,parseShellManifest,readOfflineWebp,storeVerifiedFiles} from './offline-bible';
import {bibleRequest} from './bible';

function file(path:string,text:string){return {path,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')};}
function fakeStore(){const saved=new Map<string,Response>();return {saved,match:vi.fn(async(path:RequestInfo|URL)=>saved.get(String(path))?.clone()),put:vi.fn(async(path:RequestInfo|URL,value:Response)=>{saved.set(String(path),value.clone());})};}
function setup(){
 const stores=new Map<string,ReturnType<typeof fakeStore>>();
 vi.stubGlobal('caches',{open:vi.fn(async(name:string)=>{if(!stores.has(name))stores.set(name,fakeStore());return stores.get(name)!;})});
 const bodies=new Map<string,string>();for(const entry of offlineBibleManifest.files)bodies.set(entry.path,readFileSync(`public${entry.path}`,'utf8'));
 const shellFiles=[['/offline-entry.html','<html>NCG</html>'],['/offline.html','offline'],['/assets/main-a1b2c3.js','console.log("NCG")']];
 for(const [path,body] of shellFiles)bodies.set(path.endsWith('.html')?`${path}.json`:path,path.endsWith('.html')?JSON.stringify({html:body}):body);
 bodies.set('/offline-shell.json',JSON.stringify({revision:'a'.repeat(20),files:shellFiles.map(([path,body])=>({...file(path,body),...path.endsWith('.html')?{source:`${path}.json`}:{}}))}));
 const fetch=vi.fn(async(path:RequestInfo|URL)=>bodies.has(String(path))?new Response(bodies.get(String(path))):new Response('missing',{status:404}));vi.stubGlobal('fetch',fetch);
 return {stores,bodies,fetch};
}
afterEach(()=>vi.unstubAllGlobals());
describe('verified offline Scripture',()=>{
 it('accepts multilingual builds above 100 assets while bounding total size and file count',()=>{
  const env=setup();const shell=JSON.parse(env.bodies.get('/offline-shell.json')!);
  const files=[...shell.files,...Array.from({length:350},(_,i)=>file(`/assets/locale-${i}.js`,'public language'))];
  expect(parseShellManifest({...shell,files}).files).toHaveLength(353);
  expect(()=>parseShellManifest({...shell,files:[...shell.files,...Array.from({length:1024},(_,i)=>file(`/assets/locale-${i}.js`,'x'))]})).toThrow('offline_integrity');
  expect(()=>parseShellManifest({...shell,files:files.map(f=>({...f,bytes:100000}))})).toThrow('offline_integrity');
 });
 it('keeps every downloaded chapter identical to its official import',()=>{
  let chapters=0;
  for(const entry of offlineBibleManifest.files){
   const content=readFileSync(`public${entry.path}`,'utf8');expect(file(entry.path,content).sha256).toBe(entry.sha256);
   if(entry.book==='index')continue;
   for(const [id,data] of Object.entries(JSON.parse(content))){expect(data).toEqual(JSON.parse(readFileSync(`public/bibles/webp/${id}.json`,'utf8')));chapters++;}
  }
  expect(chapters).toBe(1189);
 });
 it('downloads once, resumes cached books, and serves an exact range with no network',async()=>{
  const env=setup();const signal=new AbortController().signal;
  await downloadOfflineBible(signal,()=>{});
  expect(await offlineStatus()).toMatchObject({books:66,shellReady:true,bytes:offlineBibleManifest.bytes});
  expect(env.stores.has(OFFLINE_BIBLE_CACHE)).toBe(true);expect(env.stores.has(PUBLIC_SHELL_CACHE)).toBe(true);
  env.fetch.mockClear();await downloadOfflineBible(signal,()=>{});expect(env.fetch.mock.calls.map(([path])=>path)).toEqual(['/offline-shell.json']);
  env.fetch.mockRejectedValue(Error('offline'));env.fetch.mockClear();
  const reading=await bibleRequest<{verses:{number:string;text:string}[]}>('passage',{version:'webp',passage:'JHN.1.14-18'},signal);
  expect(reading.verses.map(v=>v.number)).toEqual(['14','15','16','17','18']);expect(env.fetch).not.toHaveBeenCalled();
  expect(await readOfflineWebp('passage','REV.22',signal)).toMatchObject({id:'REV.22'});
 });
 it('does not accept corrupt Scripture as saved, and repairs only that file',async()=>{
  const env=setup();const signal=new AbortController().signal;await downloadOfflineBible(signal,()=>{});
  const corrupt=offlineBibleManifest.files.find(f=>f.book==='JHN')!;
  env.stores.get(OFFLINE_BIBLE_CACHE)!.saved.set(corrupt.path,new Response('changed'));
  expect(await offlineStatus()).toMatchObject({books:65});expect(await readOfflineWebp('passage','JHN.1')).toBeNull();
  env.fetch.mockClear();await downloadOfflineBible(signal,()=>{});
  expect(env.fetch.mock.calls.map(([path])=>path)).toEqual(['/offline-shell.json',corrupt.path]);
 });
 it('keeps partial files for resuming without reporting success after cancellation',async()=>{
  setup();const controller=new AbortController();
  await expect(downloadOfflineBible(controller.signal,p=>{if(p.books===3)controller.abort();})).rejects.toThrow();
  expect(await offlineStatus()).toMatchObject({books:3,shellReady:false});
 });
 it('rejects provider/private/external shell entries and quota failures',async()=>{
  const env=setup();const shell=JSON.parse(env.bodies.get('/offline-shell.json')!);
  for(const path of ['/admin.html','/api/bible/versions','https://other.test/file.js','/assets/../secret.js'])expect(()=>parseShellManifest({...shell,files:[...shell.files,file(path,'private')]})).toThrow('offline_integrity');
  for(const source of ['/admin.html','https://other.test/index.json','/api/private'])expect(()=>parseShellManifest({...shell,files:shell.files.map((f:{path:string})=>f.path==='/offline-entry.html'?{...f,source}:f)})).toThrow('offline_integrity');
  setup();const store=fakeStore();store.put.mockRejectedValue(new DOMException('full','QuotaExceededError'));vi.stubGlobal('fetch',vi.fn(async()=>new Response('verified')));
  const progress=vi.fn();await expect(storeVerifiedFiles(store,[file('/example','verified')],new AbortController().signal,progress)).rejects.toThrow('full');expect(progress).not.toHaveBeenCalled();
 });
 it('rejects changed source bytes before saving them',async()=>{
  setup();const store=fakeStore();vi.stubGlobal('fetch',vi.fn(async()=>new Response('changed!')));
  await expect(storeVerifiedFiles(store,[file('/example','original')],new AbortController().signal,()=>{})).rejects.toThrow('offline_integrity');expect(store.put).not.toHaveBeenCalled();
 });
 it('preserves the verified app when hosting modifies online HTML',async()=>{
  const env=setup();env.bodies.set('/','<html>NCG</html><script src="/hosting-toolbar.js"></script>');
  await downloadOfflineBible(new AbortController().signal,()=>{});
  const store=env.stores.get(PUBLIC_SHELL_CACHE)!;store.saved.set('/',new Response(env.bodies.get('/')));
  expect(await offlineStatus()).toMatchObject({books:66,shellReady:true});
  expect(await store.saved.get('/offline-entry.html')!.clone().text()).toBe('<html>NCG</html>');
  expect(store.saved.get('/offline-entry.html')!.headers.get('Content-Type')).toContain('text/html');
  expect(env.fetch.mock.calls.some(([path])=>path==='/')).toBe(false);
 });
 it('rejects modified HTML transport before committing the offline entry',async()=>{
  const env=setup();env.bodies.set('/offline-entry.html.json',JSON.stringify({html:'<html>changed</html>'}));
  await expect(downloadOfflineBible(new AbortController().signal,()=>{})).rejects.toThrow('offline_integrity');
  expect(await offlineStatus()).toMatchObject({books:66,shellReady:false});
  expect(env.stores.get(PUBLIC_SHELL_CACHE)!.saved.has('/offline-entry.html')).toBe(false);
 });
});
