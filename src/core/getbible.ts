import type {BibleBook,BibleChapter,BibleIndex,BiblePassage,BibleVersion} from './bible';
import bookCodes from '../data/bible-books.json';
import {approvedEdition,canonicalBook,canonicalChapter} from './bible-policy';
const catalogue=async()=>({default:{versions:(await import('../data/bible-reader-catalogue.json')).default.getbible}});
const canonical=(language:string)=>{try{return new Intl.Locale(language).language;}catch{return language;}};
export async function getBibleVersions(language:string):Promise<BibleVersion[]>{
 const {default:data}=await catalogue();return data.versions.filter(v=>approvedEdition('getbible',v.id)&&canonical(v.language)===canonical(language)).map(v=>({id:`eb-gb-${v.id}`,title:v.description||v.title,localized_title:v.description||v.title,abbreviation:v.id.toUpperCase(),localized_abbreviation:v.id.toUpperCase(),language_tag:v.language,copyright:`${v.license} · getBible / CrossWire`,info:v.about.replace(/\\par/g,'\n').replace(/\\/g,''),publisher_url:'https://github.com/getbible/v2',youversion_deep_link:`https://api.getbible.net/v2/${v.id}.json`,promotional_content:'',access:'reader'}));
}
function numberOf(code:string){const index=bookCodes.findIndex(book=>book.code===code);return index>=0?index+1:/^X\d{2}$/.test(code)?Number(code.slice(1)):0;}
function codeOf(number:number){return bookCodes[number-1]?.code||`X${String(number).padStart(2,'0')}`;}
async function request(version:string,resource:string,signal:AbortSignal,book?:string,chapter?:string){
 const response=await fetch(`/api/bible-source?${new URLSearchParams({provider:'getbible',version,resource,...(book?{book:String(numberOf(book))}:{}),...(chapter?{chapter}:{})})}`,{signal});
 if(!response.ok)throw Error('bible_source_unavailable');return response.json();
}
export function parseGetBibleChapters(data:Record<string,{chapter:number}>,book:string):BibleChapter[]{
 const chapters=Object.values(data).map(c=>c.chapter);if(!chapters.length||chapters.some(c=>!Number.isInteger(c)||c<1||c>999)||new Set(chapters).size!==chapters.length)throw Error('bible_source_unavailable');
 return chapters.sort((a,b)=>a-b).map(id=>({id,title:id,passage_id:`${book}.${id}`,verses:[],versesKnown:false}));
}
export function parseGetBiblePassage(data:{book_nr:number;chapter:number;name:string;verses:{verse:number;chapter:number;text:string}[]},book:string,chapter:number):BiblePassage{
 if(data.book_nr!==numberOf(book)||data.chapter!==chapter||!Array.isArray(data.verses)||!data.verses.length||data.verses.length>300)throw Error('bible_source_unavailable');
 const id=`${book}.${chapter}`;const verses=data.verses.map(v=>{
  if(!Number.isInteger(v.verse)||v.verse<1||v.chapter!==chapter||typeof v.text!=='string'||!v.text.trim())throw Error('bible_source_unavailable');
  // Preserve provider wording; React renders the returned string as text, never HTML.
  return {id:`${id}.${v.verse}`,number:String(v.verse),text:v.text.replace(/<FI>|<Fi>/g,'')};
 });if(new Set(verses.map(v=>v.id)).size!==verses.length)throw Error('bible_source_unavailable');
 return {id,reference:data.name||id,verses,content:verses.map(v=>v.text).join('\n')};
}
export async function getBibleRequest<T>(resource:string,params:Record<string,string>,signal:AbortSignal):Promise<T>{
 const {default:data}=await catalogue();const edition=data.versions.find(v=>`eb-gb-${v.id}`===params.version);if(!edition||!approvedEdition('getbible',edition.id))throw Error('bible_source_unavailable');
 if(resource==='book'&&!canonicalBook(params.book)||resource==='passage'&&!canonicalChapter(params.passage?.split('.')[0],Number(params.passage?.split('.')[1])))throw Error('invalid_reference');
 if(resource==='index'){
  const source=await request(edition.id,'index',signal) as Record<string,{nr:number;name:string}>;
  const books:BibleBook[]=Object.values(source).filter(b=>Number.isInteger(b.nr)&&b.nr>=1&&b.nr<=66&&typeof b.name==='string').sort((a,b)=>a.nr-b.nr).map(b=>({id:codeOf(b.nr),title:b.name,full_title:b.name,abbreviation:codeOf(b.nr),canon:b.nr<=39?'old_testament':'new_testament',chaptersKnown:false,chapters:[{id:1,title:1,passage_id:`${codeOf(b.nr)}.1`,verses:[],versesKnown:false}]}));
  if(!books.length)throw Error('bible_source_unavailable');const selected=books.find(b=>b.id===params.passage?.split('.')[0])||books[0];selected.chapters=parseGetBibleChapters(await request(edition.id,'book',signal,selected.id),selected.id);selected.chaptersKnown=true;
  return {books,text_direction:edition.direction==='RTL'?'rtl':'ltr',license:`${edition.license}\n${edition.about.replace(/\\par/g,'\n').replace(/\\/g,'')}\nSource: getBible / CrossWire`} as BibleIndex as T;
 }
 if(resource==='book')return parseGetBibleChapters(await request(edition.id,'book',signal,params.book),params.book) as T;
 if(resource==='passage'){
  const match=/^([A-Z0-9]{3})\.([1-9]\d{0,2})$/.exec(params.passage);if(!match)throw Error('invalid_reference');
  return parseGetBiblePassage(await request(edition.id,'passage',signal,match[1],match[2]),match[1],Number(match[2])) as T;
 }throw Error('invalid_request');
}
