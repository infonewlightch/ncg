import {interfaceBatch,interfaceBatchSize,interfaceIds,interfaceRevision,interfaceSource,validInterfaceMessages} from './interface-catalogue';
import {interfaceSeed} from './interface-seeds';
export type InterfaceStatus='bundled'|'loading'|'automatic'|'unavailable'|'unsupported';
type Pack={messages:Map<string,string>;wanted:Set<number>;failed:Set<number>;pending:Set<number>;unsupported:boolean;seeding:boolean;seedFailed?:boolean;ready?:Promise<void>;cacheChecked?:boolean;hydrating?:boolean;limited?:boolean};
const packs=new Map<string,Pack>();const listeners=new Set<()=>void>();let revision=0,scheduled=false,active=0;
export const subscribeInterface=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const interfaceSnapshot=()=>revision;
const emit=()=>{revision++;listeners.forEach(listener=>listener());};
function packFor(locale:string){
 let pack=packs.get(locale);if(pack)return pack;
 const seed=interfaceSeed(locale);
 pack={messages:new Map(),wanted:new Set(),failed:new Set(),pending:new Set(),unsupported:false,seeding:Boolean(seed)};packs.set(locale,pack);
 // Keep valid individual messages when unrelated source text changes in a new release.
 try{const cached=JSON.parse(localStorage.getItem(`ncg:interface:v2:${locale}`)||'null');if(Array.isArray(cached))for(const row of cached){const id=interfaceIds.get(row?.en);if(id!==undefined&&row.ko===interfaceSource[id].ko&&validInterfaceMessages([{id,text:row.text}],[{id,en:row.en}]))pack.messages.set(row.en,row.text);}}catch{}
 try{const cached=JSON.parse(localStorage.getItem(`ncg:interface:${interfaceRevision}:${locale}`)||'null');if(cached&&typeof cached==='object')for(const [batch,messages] of Object.entries(cached)){const rows=interfaceBatch(Number(batch));if(rows.length&&validInterfaceMessages(messages,rows))for(const m of messages)pack.messages.set(rows.find(r=>r.id===m.id)!.en,m.text);}}catch{}
 if(seed)loadSeed(locale,pack);
 return pack;
}
function loadSeed(locale:string,pack:Pack){
 const seed=interfaceSeed(locale);if(!seed||pack.ready&&!pack.seedFailed)return;
 pack.seeding=true;pack.seedFailed=false;
 pack.ready=seed().then(({default:data})=>{
  if(!data.messages)throw Error('invalid_pack');
  for(const [en,text] of Object.entries(data.messages)){
   const id=interfaceIds.get(en);
   if(id!==undefined&&(data.sourceContext?.[en]===undefined||data.sourceContext[en]===interfaceSource[id].ko)&&validInterfaceMessages([{id,text}],[{id,en}]))pack.messages.set(en,text);
  }
  save(locale,pack);
 }).catch(()=>{pack.seedFailed=true;}).finally(()=>{pack.seeding=false;emit();schedule();});
}

function save(locale:string,pack:Pack){
 try{const messages=interfaceSource.flatMap(({en,ko})=>{const text=pack.messages.get(en);return text?[{en,ko,text}]:[];});localStorage.setItem(`ncg:interface:v2:${locale}`,JSON.stringify(messages));}catch{}
}
// Hover/focus and selection can load a static pack without starting model requests.
export function prepareInterface(locale:string){const pack=packFor(locale);if(pack.seedFailed)loadSeed(locale,pack);return pack.ready||Promise.resolve();}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;void drain();});}
async function loadCached(locale:string,pack:Pack){
 pack.cacheChecked=true;pack.hydrating=true;
 try{
  const response=await fetch(`/api/interface-translation?${new URLSearchParams({language:locale,revision:interfaceRevision})}`,{signal:AbortSignal.timeout(4000)});
  const data=await response.json();
  if(!response.ok){if(data.error==='unsupported_language')pack.unsupported=true;return;}
  if(data.language!==locale||data.revision!==interfaceRevision||!Array.isArray(data.batches)||data.batches.length>Math.ceil(interfaceSource.length/interfaceBatchSize))return;
  const seen=new Set<number>();
  for(const saved of data.batches){
   if(!Number.isInteger(saved?.batch)||saved.batch<0||seen.has(saved.batch)||saved.language!==locale||saved.revision!==interfaceRevision)continue;
   const rows=interfaceBatch(saved.batch);if(!rows.length||!validInterfaceMessages(saved.messages,rows))continue;
   seen.add(saved.batch);for(const m of saved.messages)pack.messages.set(interfaceSource[m.id].en,m.text);
  }
  save(locale,pack);
 }catch{}finally{pack.hydrating=false;emit();schedule();}
}
async function load(locale:string,pack:Pack,batch:number){
 pack.pending.add(batch);active++;emit();
 try{
  const response=await fetch('/api/interface-translation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:locale,batch,revision:interfaceRevision}),signal:AbortSignal.timeout(32000)});
  const data=await response.json();if(!response.ok){if(data.error==='unsupported_language')pack.unsupported=true;if(data.error==='translation_daily_limit'||data.error==='translation_not_configured')pack.limited=true;throw Error();}
  const rows=interfaceBatch(batch);if(data.revision!==interfaceRevision||data.language!==locale||data.batch!==batch||!validInterfaceMessages(data.messages,rows))throw Error();
  for(const m of data.messages)pack.messages.set(rows.find(r=>r.id===m.id)!.en,m.text);pack.failed.delete(batch);save(locale,pack);
 }catch{pack.failed.add(batch);}finally{pack.pending.delete(batch);active--;emit();schedule();}
}
async function drain(){
 for(const [locale,pack] of packs){
  if(pack.unsupported||pack.seeding||pack.hydrating||pack.limited)continue;
  const missing=[...pack.wanted].filter(batch=>!interfaceBatch(batch).every(row=>pack.messages.has(row.en)));
  if(missing.length&&!pack.cacheChecked){void loadCached(locale,pack);continue;}
  for(const batch of missing){if(active>=2)break;if(pack.pending.has(batch)||pack.failed.has(batch))continue;void load(locale,pack,batch);}
 }
}
export function runtimeInterfaceMessage(en:string,locale:string){
 const pack=packFor(locale);const translated=pack.messages.get(en);if(translated)return translated;
 const id=interfaceIds.get(en);if(id!==undefined&&!pack.unsupported){pack.wanted.add(Math.floor(id/interfaceBatchSize));schedule();}return en;
}
export function runtimeInterfaceStatus(locale:string):InterfaceStatus{
 const pack=packFor(locale);if(pack.unsupported)return 'unsupported';if(pack.failed.size)return 'unavailable';
 if([...pack.wanted].some(b=>!interfaceBatch(b).every(r=>pack.messages.has(r.en))))return 'loading';return pack.messages.size?'automatic':'loading';
}
export function retryInterface(locale:string){const pack=packFor(locale);pack.failed.clear();pack.unsupported=false;pack.limited=false;pack.cacheChecked=false;if(pack.seedFailed)loadSeed(locale,pack);schedule();emit();}
