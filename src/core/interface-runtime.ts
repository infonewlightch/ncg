import {interfaceBatch,interfaceBatchSize,interfaceIds,interfaceRevision,validInterfaceMessages} from './interface-catalogue';
export type InterfaceStatus='bundled'|'loading'|'automatic'|'unavailable'|'unsupported';
type Pack={messages:Map<string,string>;wanted:Set<number>;failed:Set<number>;pending:Set<number>;unsupported:boolean};
const packs=new Map<string,Pack>();const listeners=new Set<()=>void>();let revision=0,scheduled=false,active=0;
export const subscribeInterface=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const interfaceSnapshot=()=>revision;
const emit=()=>{revision++;listeners.forEach(listener=>listener());};
function packFor(locale:string){
 let pack=packs.get(locale);if(pack)return pack;
 pack={messages:new Map(),wanted:new Set(),failed:new Set(),pending:new Set(),unsupported:false};packs.set(locale,pack);
 try{const cached=JSON.parse(localStorage.getItem(`ncg:interface:${interfaceRevision}:${locale}`)||'null');if(cached&&typeof cached==='object')for(const [batch,messages] of Object.entries(cached)){const rows=interfaceBatch(Number(batch));if(rows.length&&validInterfaceMessages(messages,rows))for(const m of messages)pack.messages.set(rows.find(r=>r.id===m.id)!.en,m.text);}}catch{}
 return pack;
}
function save(locale:string,pack:Pack){
 try{const batches:Record<string,{id:number;text:string}[]>={};for(const [en] of pack.messages){const batch=Math.floor(interfaceIds.get(en)!/interfaceBatchSize),rows=interfaceBatch(batch);if(rows.every(r=>pack.messages.has(r.en)))batches[batch]=rows.map(r=>({id:r.id,text:pack.messages.get(r.en)!}));}localStorage.setItem(`ncg:interface:${interfaceRevision}:${locale}`,JSON.stringify(batches));}catch{}
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;void drain();});}
async function load(locale:string,pack:Pack,batch:number){
 pack.pending.add(batch);active++;emit();
 try{
  const response=await fetch('/api/interface-translation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:locale,batch,revision:interfaceRevision}),signal:AbortSignal.timeout(32000)});
  const data=await response.json();if(!response.ok){if(data.error==='unsupported_language')pack.unsupported=true;throw Error();}
  const rows=interfaceBatch(batch);if(data.revision!==interfaceRevision||data.language!==locale||data.batch!==batch||!validInterfaceMessages(data.messages,rows))throw Error();
  for(const m of data.messages)pack.messages.set(rows.find(r=>r.id===m.id)!.en,m.text);pack.failed.delete(batch);save(locale,pack);
 }catch{pack.failed.add(batch);}finally{pack.pending.delete(batch);active--;emit();schedule();}
}
async function drain(){
 for(const [locale,pack] of packs){if(pack.unsupported)continue;for(const batch of pack.wanted){if(active>=2)return;const rows=interfaceBatch(batch);if(pack.pending.has(batch)||pack.failed.has(batch)||rows.every(r=>pack.messages.has(r.en)))continue;void load(locale,pack,batch);}}
}
export function runtimeInterfaceMessage(en:string,locale:string){
 const pack=packFor(locale);const translated=pack.messages.get(en);if(translated)return translated;
 const id=interfaceIds.get(en);if(id!==undefined&&!pack.unsupported){pack.wanted.add(Math.floor(id/interfaceBatchSize));schedule();}return en;
}
export function runtimeInterfaceStatus(locale:string):InterfaceStatus{
 const pack=packFor(locale);if(pack.unsupported)return 'unsupported';if(pack.failed.size)return 'unavailable';
 if([...pack.wanted].some(b=>!interfaceBatch(b).every(r=>pack.messages.has(r.en))))return 'loading';return pack.messages.size?'automatic':'loading';
}
export function retryInterface(locale:string){const pack=packFor(locale);pack.failed.clear();pack.unsupported=false;schedule();emit();}
