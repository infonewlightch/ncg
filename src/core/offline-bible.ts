import manifest from '../data/offline-webp.json';
import type {BiblePassage} from './bible';

export const offlineBibleManifest=manifest;
export const OFFLINE_BIBLE_CACHE=`ncg-webp-download-${manifest.revision}`;
export const PUBLIC_SHELL_CACHE='ncg-public-shell-v2';
const SHELL_MANIFEST='/offline-shell.json';
const OFFLINE_ENTRY='/offline-entry.html';
type FileEntry={path:string;source?:string;bytes:number;sha256:string};
type ShellManifest={revision:string;files:FileEntry[]};
export type OfflineProgress={books:number;total:number;bytes:number;shellReady:boolean};
type Store=Pick<Cache,'match'|'put'>;
export function offlineSupported(){return typeof caches!=='undefined'&&typeof crypto?.subtle!=='undefined';}
export async function verifiedResponse(response:Response|undefined,file:FileEntry){
 if(!response?.ok||response.type==='opaque')return false;
 const bytes=await response.clone().arrayBuffer();
 if(bytes.byteLength!==file.bytes)return false;
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 return hash===file.sha256;
}
export function parseShellManifest(value:unknown):ShellManifest{
 const data=value as ShellManifest;
 if(!data||!Array.isArray(data.files)||data.files.length<3||data.files.length>100||!/^[a-f0-9]{20}$/.test(data.revision))throw Error('offline_integrity');
 const validPath=(path:string)=>[OFFLINE_ENTRY,'/offline.html','/brand/newlight-symbol.png'].includes(path)||/^\/assets\/[A-Za-z0-9_-]+\.(js|css|woff2?|png|svg)$/.test(path);
 const validSource=(f:FileEntry)=>f.path.endsWith('.html')?f.source===`${f.path}.json`:f.source===undefined;
 if(data.files.some(f=>!f||typeof f.path!=='string'||!validPath(f.path)||!validSource(f)||!Number.isInteger(f.bytes)||f.bytes<1||f.bytes>5_000_000||!/^[a-f0-9]{64}$/.test(f.sha256))||new Set(data.files.map(f=>f.path)).size!==data.files.length||!data.files.some(f=>f.path===OFFLINE_ENTRY)||!data.files.some(f=>f.path.endsWith('.js')))throw Error('offline_integrity');
 return data;
}
export async function storeVerifiedFiles(store:Store,files:FileEntry[],signal:AbortSignal,onFile:(file:FileEntry)=>void){
 for(const file of files){
  signal.throwIfAborted();
  let response=await store.match(file.path);
  if(!await verifiedResponse(response,file)){
   response=await fetch(file.source||file.path,{signal:AbortSignal.any([signal,AbortSignal.timeout(120000)]),credentials:'omit',cache:'no-store',redirect:'error'});
   if(file.source){
    if(!response.ok)throw Error('offline_unavailable');
    const data=await response.json();if(typeof data?.html!=='string')throw Error('offline_integrity');
    const headers=new Headers(response.headers);headers.set('Content-Type','text/html; charset=utf-8');headers.delete('Content-Length');headers.delete('Content-Encoding');
    response=new Response(data.html,{headers});
   }
   if(!await verifiedResponse(response,file))throw Error('offline_integrity');
   signal.throwIfAborted();await store.put(file.path,response!);
  }
  signal.throwIfAborted();onFile(file);
 }
}
async function shellIsReady(store:Store){
 try{const response=await store.match(SHELL_MANIFEST);if(!response)return false;const shell=parseShellManifest(await response.json());for(const file of shell.files)if(!await verifiedResponse(await store.match(file.path),file))return false;return true;}catch{return false;}
}
export async function offlineStatus():Promise<OfflineProgress>{
 const result={books:0,total:66,bytes:0,shellReady:false};if(!offlineSupported())return result;
 const cache=await caches.open(OFFLINE_BIBLE_CACHE);
 let indexReady=false;
 for(const file of manifest.files)if(await verifiedResponse(await cache.match(file.path),file)){result.bytes+=file.bytes;if(file.book==='index')indexReady=true;else result.books++;}
 result.shellReady=indexReady&&await shellIsReady(await caches.open(PUBLIC_SHELL_CACHE));return result;
}
export async function downloadOfflineBible(signal:AbortSignal,onProgress:(value:OfflineProgress)=>void){
 if(!offlineSupported())throw Error('offline_unsupported');
 const result={books:0,total:66,bytes:0,shellReady:false};
 const shellResponse=await fetch(SHELL_MANIFEST,{signal:AbortSignal.any([signal,AbortSignal.timeout(120000)]),credentials:'omit',cache:'no-store',redirect:'error'});
 if(!shellResponse.ok)throw Error('offline_unavailable');
 const shell=parseShellManifest(await shellResponse.json());
 const cache=await caches.open(OFFLINE_BIBLE_CACHE);
 await storeVerifiedFiles(cache,manifest.files,signal,file=>{result.bytes+=file.bytes;if(file.path.includes('/offline/'))result.books++;onProgress({...result});});
 const shellStore=await caches.open(PUBLIC_SHELL_CACHE);
 // Commit the entry HTML last, after all its script dependencies are available.
 await storeVerifiedFiles(shellStore,[...shell.files.filter(f=>f.path!==OFFLINE_ENTRY),...shell.files.filter(f=>f.path===OFFLINE_ENTRY)],signal,()=>{});
 signal.throwIfAborted();await shellStore.put(SHELL_MANIFEST,new Response(JSON.stringify(shell),{headers:{'Content-Type':'application/json'}}));
 result.shellReady=true;onProgress({...result});return result;
}
export async function readOfflineWebp(resource:string,passage?:string,signal?:AbortSignal):Promise<unknown|null>{
 if(!offlineSupported())return null;
 const book=resource==='index'?'index':passage?.split('.')[0];const file=manifest.files.find(f=>f.book===book);if(!file)return null;
 try{
  const cache=await caches.open(OFFLINE_BIBLE_CACHE);const response=await cache.match(file.path);
  if(!await verifiedResponse(response,file))return null;
  signal?.throwIfAborted();const data=await response!.json();return resource==='index'?data:(data[passage||''] as BiblePassage)||null;
 }catch(error){if(signal?.aborted)throw error;return null;}
}
