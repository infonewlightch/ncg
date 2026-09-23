import {readOfflineWebp} from './offline-bible';
export type BibleVersion={id:string;title:string;localized_title:string;abbreviation:string;localized_abbreviation:string;language_tag:string;copyright:string;info:string;publisher_url:string;youversion_deep_link:string;promotional_content:string};
export type BibleVerse={id:number|string;passage_id:string;title:number|string};
export type BibleChapter={id:number|string;passage_id:string;title:number|string;verses:BibleVerse[]};
export type BibleBook={id:string;title:string;full_title:string;abbreviation:string;canon:string;chapters:BibleChapter[]};
export type BibleIndex={text_direction:'ltr'|'rtl';books:BibleBook[]};
export type BiblePassage={id:string;reference:string;content:string;verses?:{id:string;number:string;text:string;heading?:string;notes?:string[]}[]};
export type ReaderPreferences={versions:Record<string,string>;passage:string;fontSize:number;theme:'light'|'warm'|'dark';bookmarks:{version:string;passage:string;reference:string;language:string}[]};
export const defaultReader:ReaderPreferences={versions:{},passage:'JHN.3',fontSize:20,theme:'light',bookmarks:[]};
export function parsePassage(value:string){
 const match=/^([A-Z0-9]{3})\.([1-9]\d{0,2})(?:\.([1-9]\d{0,2})(?:-([1-9]\d{0,2}))?)?$/.exec(value);
 if(!match||match[4]&&Number(match[4])<Number(match[3]))return null;
 return {book:match[1],chapter:Number(match[2]),from:match[3]?Number(match[3]):null,to:match[4]?Number(match[4]):match[3]?Number(match[3]):null};
}
export function readReaderPreferences(raw:unknown):ReaderPreferences{
 const s=(raw&&typeof raw==='object'?raw:{}) as Partial<ReaderPreferences>;
 return {versions:Object.fromEntries(Object.entries(s.versions||{}).filter(([k,v])=>/^[a-zA-Z0-9-]{2,40}$/.test(k)&&typeof v==='string'&&/^(webp|[1-9][0-9]{0,8})$/.test(v))),passage:typeof s.passage==='string'&&parsePassage(s.passage)?s.passage:defaultReader.passage,fontSize:typeof s.fontSize==='number'&&Number.isFinite(s.fontSize)?Math.min(30,Math.max(16,s.fontSize)):20,theme:['light','warm','dark'].includes(s.theme||'')?s.theme!:'light',bookmarks:Array.isArray(s.bookmarks)?s.bookmarks.filter(x=>x&&typeof x.version==='string'&&/^(webp|[1-9][0-9]{0,8})$/.test(x.version)&&typeof x.reference==='string'&&typeof x.language==='string'&&typeof x.passage==='string'&&parsePassage(x.passage)).slice(0,300):[]};
}
export function chapterOf(passage:string){return passage.split('.').slice(0,2).join('.');}
export function adjacentChapter(index:BibleIndex,passage:string,step:-1|1){
 const chapters=index.books.flatMap(b=>b.chapters);const n=chapters.findIndex(c=>c.passage_id===chapterOf(passage));
 return n<0?null:chapters[n+step]?.passage_id||null;
}
export function resolvePassage(index:BibleIndex,requested:string){
 const chapters=index.books.flatMap(b=>b.chapters);const chapter=chapters.find(c=>c.passage_id===chapterOf(requested));
 if(!chapter)return chapters[0]?.passage_id||requested;
 const range=parsePassage(requested);
 return requested===chapter.passage_id||range?.from&&chapter.verses.some(v=>Number(v.id)===range.from)&&chapter.verses.some(v=>Number(v.id)===range.to)?requested:chapter.passage_id;
}
export function safeBibleLink(value:string|undefined){try{const url=new URL(value||'');return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
export class BibleError extends Error{}
export function isKoreanRevisedVersion(version:BibleVersion){
 if(version.language_tag?.split('-')[0]!=='ko')return false;
 return [version.abbreviation,version.localized_abbreviation].some(value=>value?.toUpperCase()==='NKRV')||[version.title,version.localized_title].some(value=>value?.includes('개역개정')||/^New Korean Revised Version(?:\b|$)/i.test(value));
}
export function preferredBibleVersion(versions:BibleVersion[],language:string,preferred?:string){
 return versions.find(v=>String(v.id)===preferred)|| (language.split('-')[0]==='ko'?versions.find(isKoreanRevisedVersion):undefined)||versions[0];
}
export function koreanRevisedLink(passage:string){
 const range=parsePassage(passage);return `https://bible.bskorea.or.kr/bible/NKRV/${range?`${range.book}.${range.chapter}`:'GEN.1'}`;
}
export async function bibleRequest<T>(resource:string,params:Record<string,string>,signal:AbortSignal):Promise<T>{
 if(params.version==='webp')return localBible<T>(resource,params.passage,signal);
 if(resource==='versions'&&params.language.split('-')[0]==='en'&&typeof navigator!=='undefined'&&!navigator.onLine)return {data:[webVersion],providerStatus:'bible_unavailable'} as T;
 let response:Response;let data;
 try{response=await fetch(`/api/bible/${resource}?${new URLSearchParams(params)}`,{signal});data=await response.json();}
 catch(e){if(!signal.aborted&&resource==='versions'&&params.language.split('-')[0]==='en')return {data:[webVersion],providerStatus:'bible_unavailable'} as T;throw e;}
 if(resource==='versions'){
  const local=params.language.split('-')[0]==='en'?[webVersion]:[];
  if(!response.ok&&local.length)return {data:local,providerStatus:data.error} as T;
  if(response.ok)return {data:[...local,...data.data.map((v:BibleVersion)=>({...v,id:String(v.id)}))]} as T;
 }
 if(!response.ok)throw new BibleError(data.error||'bible_unavailable');
 return data as T;
}

export const webVersion:BibleVersion={id:'webp',title:'World English Bible · Protestant Edition',localized_title:'World English Bible · Protestant Edition',abbreviation:'WEBP',localized_abbreviation:'WEBP',language_tag:'en',copyright:'World English Bible — Public Domain. World English Bible is a trademark of eBible.org.',info:'66 books · Source: eBible.org · 2026-09-23',publisher_url:'https://ebible.org/engwebp/copyright.htm',youversion_deep_link:'https://ebible.org/engwebp/',promotional_content:''};
async function localBible<T>(resource:string,passage:string,signal:AbortSignal):Promise<T>{
 if(resource==='index'){
  let data=await readOfflineWebp('index',undefined,signal) as {books:(Omit<BibleBook,'chapters'>&{chapters:{id:number;verses:string[]}[]})[]}|null;
  if(!data){const response=await fetch('/bibles/webp/index.json',{signal});if(!response.ok)throw new BibleError('bible_unavailable');data=await response.json();}
  return {...data,books:data!.books.map(b=>({...b,chapters:b.chapters.map(c=>({id:c.id,title:c.id,passage_id:`${b.id}.${c.id}`,verses:c.verses.map(v=>({id:v,title:v,passage_id:`${b.id}.${c.id}.${v}`}))}))}))} as T;
 }
 const range=parsePassage(passage);
 if(resource!=='passage'||!range)throw new BibleError('invalid_reference');
 let data=await readOfflineWebp('passage',chapterOf(passage),signal) as BiblePassage|null;
 if(!data){const response=await fetch(`/bibles/webp/${chapterOf(passage)}.json`,{signal});if(!response.ok)throw new BibleError('bible_unavailable');data=await response.json() as BiblePassage;}
 if(!range.from)return data as T;
 const verses=data.verses?.filter(v=>Number(v.number)>=range.from!&&Number(v.number)<=range.to!);
 if(!verses?.length||Number(verses[0].number)!==range.from||Number(verses.at(-1)!.number)!==range.to)throw new BibleError('passage_unavailable');
 return {id:passage,reference:`${data.reference}:${passage.split('.')[2]}`,content:verses.map(v=>v.text).join('\n'),verses} as T;
}
