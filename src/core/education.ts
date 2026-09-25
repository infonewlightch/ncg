import {educationRevision,educationMessages,applyEducationMessages,type EducationKind,type EducationUnitTranslation} from './education-content';
import {interfaceDirection} from './interface';

export type EducationSourceUnit={id:string;kind:EducationKind;data:any};
export class EducationError extends Error {constructor(public code:string){super(code);}}
export function educationLanguage(tag:string){
 try{const locale=new Intl.Locale(tag);if(locale.language==='zh'){if(locale.script&&!['Hans','Hant'].includes(locale.script))return `zh-${locale.script}`;return locale.maximize().script==='Hant'?'zh-Hant':'zh';}return locale.language==='tl'?'fil':locale.script?`${locale.language}-${locale.script}`:locale.language;}catch{return 'en';}
}
export const isOriginalEducationLanguage=(language:string)=>['ko','en','th'].includes(educationLanguage(language));
export const educationDirection=interfaceDirection;
const memory=new Map<string,EducationUnitTranslation>();
const staticPacks=new Map<string,Promise<Map<string,EducationUnitTranslation>>>();
const cachePrefix=`ncg:education:${educationRevision}:`;
function alive(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('Aborted','AbortError');}
function valid(unit:EducationSourceUnit,value:unknown):value is EducationUnitTranslation{
 if(!value||typeof value!=='object'||(value as EducationUnitTranslation).id!==unit.id)return false;
 try{applyEducationMessages(unit.kind,unit.data,(value as EducationUnitTranslation).messages);return true;}catch{return false;}
}
function remember(language:string,unit:EducationUnitTranslation){
 const key=cachePrefix+language+':'+unit.id;
 if(memory.size>=400)memory.delete(memory.keys().next().value!);memory.set(key,unit);
 try{
  // The oldest cached units are disposable; storage never includes private data.
  const keys=Object.keys(localStorage).filter(key=>key.startsWith('ncg:education:'));
  let bytes=keys.reduce((n,key)=>n+(localStorage.getItem(key)?.length||0),0);
  while(keys.length>=150||bytes>900000){const oldest=keys.shift();if(!oldest)break;bytes-=localStorage.getItem(oldest)?.length||0;localStorage.removeItem(oldest);}
  localStorage.setItem(key,JSON.stringify(unit));
 }catch{/* Memory cache still works when device storage is unavailable. */}
}
function saved(language:string,unit:EducationSourceUnit){
 const key=cachePrefix+language+':'+unit.id;let value:unknown=memory.get(key);
 if(!value)try{value=JSON.parse(localStorage.getItem(key)||'null');}catch{}
 return valid(unit,value)?value:null;
}
async function prepared(language:string){
 let pending=staticPacks.get(language);
 if(!pending){
  pending=(async()=>{
   const response=await fetch(`/education/${educationRevision}/${encodeURIComponent(language)}.json`,{signal:AbortSignal.timeout(6000)});
   if(!response.ok)return new Map<string,EducationUnitTranslation>();
   const data=await response.json();if(data.revision!==educationRevision||data.language!==language||data.reviewed!==false||!Array.isArray(data.units))return new Map<string,EducationUnitTranslation>();
   return new Map<string,EducationUnitTranslation>(data.units.filter((unit:any)=>unit&&typeof unit.id==='string').map((unit:EducationUnitTranslation)=>[unit.id,unit]));
  })().catch(()=>new Map<string,EducationUnitTranslation>());
  staticPacks.set(language,pending);
 }
 return pending;
}
function batches(units:EducationSourceUnit[]){
 const result:EducationSourceUnit[][]=[];let group:EducationSourceUnit[]=[],size=0,fields=0;
 for(const unit of units){const texts=Object.values(educationMessages(unit.kind,unit.data));const chars=texts.reduce((n,text)=>n+text.length,0);
  if(chars>6000)throw new EducationError('batch_too_large');
  if(group.length&&(group.length===5||size+chars>5000||fields+texts.length>100)){result.push(group);group=[];size=0;fields=0;}group.push(unit);size+=chars;fields+=texts.length;
 }if(group.length)result.push(group);return result;
}
export async function loadEducationUnits(language:string,units:EducationSourceUnit[],signal?:AbortSignal):Promise<Map<string,any>>{
 alive(signal);language=educationLanguage(language);const output=new Map<string,any>();
 if(language==='en'){for(const unit of units)output.set(unit.id,structuredClone(unit.data));return output;}
 const unique=[...new Map(units.map(unit=>[unit.id,unit])).values()];
 let missing=unique.filter(unit=>{const value=saved(language,unit);if(!value)return true;output.set(unit.id,applyEducationMessages(unit.kind,unit.data,value.messages));return false;});
 if(missing.length){const pack=await prepared(language);alive(signal);missing=missing.filter(unit=>{const value=pack.get(unit.id);if(!valid(unit,value))return true;remember(language,value);output.set(unit.id,applyEducationMessages(unit.kind,unit.data,value.messages));return false;});}
 const groups=batches(missing);let next=0;
 const siblingAbort=new AbortController();signal=signal?AbortSignal.any([signal,siblingAbort.signal]):siblingAbort.signal;
 await Promise.all(Array.from({length:Math.min(2,groups.length)},async()=>{
  while(next<groups.length){const group=groups[next++];alive(signal);
   const params=new URLSearchParams({language,revision:educationRevision,units:group.map(unit=>unit.id).join(',')});
   let data:any;
   try{
    const read=await fetch(`/api/education-translation?${params}`,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)});
    if(read.ok){const cached=await read.json();if(cached.complete)data=cached;}
   }catch(error){alive(signal);}
   if(!data){
    let response:Response;
    try{response=await fetch('/api/education-translation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language,revision:educationRevision,units:group.map(unit=>unit.id)}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(35000)]):AbortSignal.timeout(35000)});}catch(error){alive(signal);throw new EducationError('translation_unavailable');}
    try{data=await response.json();}catch{throw new EducationError('translation_unavailable');}
    if(!response.ok)throw new EducationError(typeof data?.error==='string'?data.error:'translation_unavailable');
   }
   alive(signal);
   if(data?.language!==language||data.revision!==educationRevision||data.reviewed!==false||!Array.isArray(data.units)||data.units.length!==group.length)throw new EducationError('invalid_translation');
   for(const unit of group){const matches=data.units.filter((value:EducationUnitTranslation)=>value.id===unit.id);if(matches.length!==1||!valid(unit,matches[0]))throw new EducationError('invalid_translation');}
   for(const unit of group){const value=data.units.find((value:EducationUnitTranslation)=>value.id===unit.id);remember(language,value);output.set(unit.id,applyEducationMessages(unit.kind,unit.data,value.messages));}
  }
 })).catch(error=>{siblingAbort.abort();throw error;});
 alive(signal);return output;
}
