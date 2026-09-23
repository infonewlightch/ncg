import type {BibleBook,BibleChapter,BibleIndex,BiblePassage,BibleVersion} from './bible';

type Entry={id:string;language:string;title:string;shortTitle:string;description:string;copyright:string;redistributable:boolean;certified:boolean;direction:string;script:string;dialect:string};
const base='https://ebible.org/';
const normalize=(value:string)=>value.replace(/\s+/g,' ').trim();
// Decimal numeral blocks are sequences of ten; retain their original display label.
const decimalDigits=(value:string)=>value.replace(/\p{Decimal_Number}/gu,char=>{const code=char.codePointAt(0)!;let start=code;while(start>0&&/\p{Decimal_Number}/u.test(String.fromCodePoint(start-1)))start--;return String((code-start)%10);}).replace(/–/g,'-');
const canonical=(code:string)=>{try{return new Intl.Locale(code).language;}catch{return code.toLowerCase();}};
const catalog=()=>import('../data/bible-catalogue.json');
const cache=new Map<string,string>();
const allowedFile=/^(?:index|copyright|[A-Z0-9]{3}(?:\d{2,3})?)\.htm$/;
export async function ebibleVersions(language:string):Promise<BibleVersion[]>{
 const {default:data}=await catalog();const code=canonical(language);
 return data.versions.filter(v=>canonical(v.language)===code&&v.id!=='engwebp').sort((a,b)=>Number(b.redistributable)-Number(a.redistributable)||Number(b.certified)-Number(a.certified)).map(v=>({id:`eb-${v.id}`,title:v.shortTitle||v.description,localized_title:v.title,abbreviation:v.id,localized_abbreviation:v.shortTitle||v.id,language_tag:code,copyright:v.copyright,info:[v.dialect,v.script].filter(Boolean).join(' · '),publisher_url:`${base}${v.id}/copyright.htm`,youversion_deep_link:`${base}${v.id}/`,promotional_content:'',access:v.redistributable?'reader':'external'}));
}
async function entry(version:string):Promise<Entry>{const {default:data}=await catalog();const found=data.versions.find(v=>`eb-${v.id}`===version);if(!found||!found.redistributable||!/^[a-zA-Z0-9_-]+$/.test(found.id))throw Error('bible_source_unavailable');return found;}
async function html(id:string,file:string,signal:AbortSignal){
 if(!allowedFile.test(file))throw Error('invalid_reference');const url=`${base}${id}/${file}`;const stored=cache.get(url);if(stored)return parse(stored);
 const r=await fetch(`/api/bible-source?${new URLSearchParams({version:id,file})}`,{signal});if(!r.ok)throw Error('bible_unavailable');const data=await r.json();const text=data.html;if(typeof text!=='string')throw Error('bible_source_unavailable');if(text.length>1500000)throw Error('bible_source_unavailable');if(signal.aborted)throw signal.reason;
 if(cache.size>120)cache.delete(cache.keys().next().value!);cache.set(url,text);return parse(text);
}
function parse(text:string){const doc=new DOMParser().parseFromString(text,'text/html');doc.querySelectorAll('script,style,iframe,object,embed,img,link').forEach(n=>n.remove());return doc;}
function sourceBooks(doc:Document):BibleBook[]{
 const used=new Set<string>();return Array.from(doc.querySelectorAll('.bookList a[href]')).flatMap(a=>{const match=/^([A-Z0-9]{3})(\d{2,3})\.htm$/.exec(a.getAttribute('href')||'');if(!match||used.has(match[1]))return [];used.add(match[1]);const id=match[1],title=normalize(a.textContent||id),chapter=Number(match[2]);return [{id,title,full_title:title,abbreviation:id,canon:a.classList.contains('oo')?'old_testament':a.classList.contains('nn')?'new_testament':'other',chaptersKnown:false,chapters:[{id:chapter,title:chapter,passage_id:`${id}.${chapter}`,verses:[],versesKnown:false,sourceFile:match[0]}]}];});
}
export function parseEbibleChapters(doc:Document,book:string):BibleChapter[]{
 const used=new Set<string>();return Array.from(doc.querySelectorAll('.tnav a[href]')).flatMap(a=>{const match=/^([A-Z0-9]{3})(\d{2,3})\.htm$/.exec(a.getAttribute('href')||'');if(!match||match[1]!==book||used.has(match[0]))return [];used.add(match[0]);const id=Number(match[2]);return [{id,title:normalize(a.textContent||'')||id,passage_id:`${book}.${id}`,verses:[],versesKnown:false,sourceFile:match[0]}];});
}
/** Plain text only: preserve inline words, retain source headings and separate footnotes. */
export function parseEbiblePassage(doc:Document,passage:string):BiblePassage{
 const main=doc.querySelector('.main');if(!main)throw Error('bible_source_unavailable');
 const verses:NonNullable<BiblePassage['verses']>=[];let current:typeof verses[number]|undefined;let heading='';
 function walk(node:Node){
  if(node.nodeType===3){if(current)current.text+=node.textContent||'';return;}
  if(node.nodeType!==1)return;const el=node as Element;
  if(el.matches('.tnav,.footnote,.copyright,.chapterlabel,script,style'))return;
  if(el.matches('.verse')){const label=normalize(el.textContent||''),number=decimalDigits(label);if(!/^\d+(?:-\d+)?$/.test(number))throw Error('bible_source_unavailable');current={id:`${passage}.${number}`,number,...(label!==number?{label}:{}),text:'',...(heading?{heading}:{} )};heading='';verses.push(current);return;}
  if(el.matches('.s,.s1,.s2,.ms,.ms1,.d')){heading=[heading,normalize(el.textContent||'')].filter(Boolean).join(' ');return;}
  if(el.matches('.notemark')){const note=normalize(el.querySelector('.popup')?.textContent||'');if(note&&current)(current.notes??=[]).push(note);return;}
  if(el.matches('br')&&current)current.text+=' ';
  for(const child of el.childNodes)walk(child);
  if(el.matches('div,p')&&current)current.text+=' ';
 }
 walk(main);for(const v of verses)v.text=normalize(v.text);
 if(!verses.length||new Set(verses.map(v=>v.id)).size!==verses.length||verses.some(v=>!v.text&&!v.notes?.length))throw Error('bible_source_unavailable');
 const book=normalize(doc.querySelector('.tnav a[href="index.htm"]')?.textContent||passage.split('.')[0]);
 return {id:passage,reference:`${book} ${passage.split('.')[1]}`,content:verses.map(v=>v.text).join('\n'),verses};
}
async function license(id:string,signal:AbortSignal){
 const doc=await html(id,'copyright.htm',signal);const text=normalize(doc.body.textContent||'');
 // Catalogue permission must also be supported by the edition's own licence page.
 const permitted=/public domain/i.test(text)||Array.from(doc.querySelectorAll('a[href]')).some(a=>/^https?:\/\/creativecommons\.org\/(?:licenses\/by(?:-sa|-nd|-nc|-nc-sa|-nc-nd)?\/|publicdomain\/)/i.test(a.getAttribute('href')||''));
 if(!permitted)throw Error('bible_license_review');return text;
}
export async function ebibleRequest<T>(resource:string,params:Record<string,string>,signal:AbortSignal):Promise<T>{
 const v=await entry(params.version);const copyright=await license(v.id,signal);
 if(resource==='index'){
  const books=sourceBooks(await html(v.id,'index.htm',signal));if(!books.length)throw Error('bible_source_unavailable');
  const selected=books.find(b=>b.id===params.passage?.split('.')[0])||books[0];const chapters=parseEbibleChapters(await html(v.id,`${selected.id}.htm`,signal),selected.id);if(!chapters.length)throw Error('bible_source_unavailable');selected.chapters=chapters;selected.chaptersKnown=true;
  return {text_direction:v.direction==='rtl'?'rtl':'ltr',books,license:copyright} as BibleIndex as T;
 }
 if(resource==='book'){
  if(!/^[A-Z0-9]{3}$/.test(params.book))throw Error('invalid_reference');const chapters=parseEbibleChapters(await html(v.id,`${params.book}.htm`,signal),params.book);if(!chapters.length)throw Error('bible_source_unavailable');return chapters as T;
 }
 if(resource==='passage'){
  const match=/^([A-Z0-9]{3})\.([1-9]\d{0,2})$/.exec(params.passage);if(!match)throw Error('invalid_reference');
  const chapters=parseEbibleChapters(await html(v.id,`${match[1]}.htm`,signal),match[1]);const chapter=chapters.find(c=>c.passage_id===params.passage);if(!chapter?.sourceFile)throw Error('passage_unavailable');
  return parseEbiblePassage(await html(v.id,chapter.sourceFile,signal),params.passage) as T;
 }
 throw Error('invalid_request');
}
