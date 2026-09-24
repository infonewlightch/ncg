import {useEffect,useState} from 'react';
import type {Video} from '../core/model';
import {useApp} from '../state';
type Copy={title:string;description:string};
const cache=new Map<string,Copy>();const pending=new Map<string,Promise<Copy>>();
const queue:(()=>void)[]=[];let active=0;
function schedule<T>(work:()=>Promise<T>){return new Promise<T>((resolve,reject)=>{const run=()=>{active++;void work().then(resolve,reject).finally(()=>{active--;queue.shift()?.();});};if(active<3)run();else queue.push(run);});}
export function useVideoTranslation(video:Video){
 const {state}=useApp();const [copy,setCopy]=useState<Copy|null>(null),[status,setStatus]=useState<'original'|'loading'|'done'|'unavailable'>('original'),[original,setOriginal]=useState(false);
 const target=state.language;
 useEffect(()=>{
  let alive=true;setCopy(null);setOriginal(false);setStatus('original');
  if(!video.official||video.language.toLowerCase()===target.toLowerCase())return;
  const key=JSON.stringify([video.id,video.title,video.description,video.language,target]);
  if(cache.has(key)){setCopy(cache.get(key)!);setStatus('done');return;}
  setStatus('loading');let task=pending.get(key);
  if(!task){task=schedule(async()=>{
   const response=await fetch('/api/video-translation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({videoId:video.id,target}),signal:AbortSignal.timeout(40000)});
   if(!response.ok)throw Error('translation_unavailable');const data=await response.json();
   if(data.id!==video.id||data.language!==target||typeof data.title!=='string'||!data.title.trim()||typeof data.description!=='string')throw Error('invalid_translation');
   const result={title:data.title,description:data.description};if(cache.size>=200)cache.delete(cache.keys().next().value!);cache.set(key,result);return result;
  });pending.set(key,task);void task.finally(()=>pending.delete(key)).catch(()=>{});}
  task.then(value=>{if(alive){setCopy(value);setStatus('done');}}).catch(()=>{if(alive)setStatus('unavailable');});return()=>{alive=false;};
 },[video.id,video.title,video.description,video.language,video.official,target]);
 return {title:copy&&!original?copy.title:video.title,description:copy&&!original?copy.description:video.description,status,original,toggle:()=>setOriginal(value=>!value),language:copy&&!original?target:video.language};
}
