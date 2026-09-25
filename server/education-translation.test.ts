import {beforeEach,describe,it,expect,vi} from 'vitest';
import {educationTranslation,type EducationTranslationStore,type StoredEducationUnit} from './education-translation';
import {getEducationUnit,type EducationSourceUnit} from './education-source';
import {educationRevision,educationMessages,applyEducationMessages} from '../src/core/education-content';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const env={OPENAI_API_KEY:'test-only',OPENAI_BASE_URL:'https://provider.invalid'};
const input={language:'pt',revision:educationRevision,units:['lesson:newcomer:1']};
const request=(data:unknown=input,origin='https://example.test')=>new Request('https://example.test/api/education-translation',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(data)});
const cachedRequest=(data=input)=>new Request(`https://example.test/api/education-translation?${new URLSearchParams({language:data.language,revision:data.revision,units:data.units.join(',')})}`);
const answer=(data:unknown,finish_reason='stop')=>Response.json({choices:[{finish_reason,message:{content:JSON.stringify(data)}}]});
const provider=()=>vi.fn(async(_url:unknown,init:any)=>{const payload=JSON.parse(init.body);const rows=JSON.parse(payload.messages[1].content);return answer({supported:true,language:payload.messages[0].content.match(/Return language exactly ([^.]+)\./)[1],messages:rows.map((row:any)=>({id:row.id,text:`Tradução: ${row.text}`}))});});
let store:EducationTranslationStore,saved:Map<string,StoredEducationUnit>;
beforeEach(()=>{saved=new Map();store={get:vi.fn(async key=>saved.get(key)||null),set:vi.fn(async(key,value)=>{saved.set(key,value);}),claim:vi.fn().mockResolvedValue(true)};});
describe('education sources and immutable translated fields',()=>{
 it('ties the shared revision to all canonical source files',()=>{const text=['src/data/courses/en.json','src/data/catechism/en.json','public/quizzes/en.json'].map(path=>readFileSync(path,'utf8')).join('\n');expect(createHash('sha256').update('education-v1\n'+text).digest('hex').slice(0,20)).toBe(educationRevision);});
 it('exposes fixed source units and leaves private or nonexistent IDs unavailable',async()=>{
  const catalogue=await getEducationUnit('catalogue');expect(catalogue?.kind).toBe('catalogue');expect(catalogue?.messages).toHaveProperty('0.title');expect(catalogue?.messages).not.toHaveProperty('0.lessons.0.teaching.0');
  expect((await getEducationUnit('catechism:10'))?.data).toHaveLength(7);
  for(const id of ['lesson:deep:99','lesson:newcomer:01','catechism:11','quiz:00000000-0000-0000-0000-000000000000','../../.env'])expect(await getEducationUnit(id)).toBeNull();
 });
 it('preserves answer indexes, source refs, identity, option order and the original data',async()=>{
  for(const id of ['lesson:newcomer:1','quiz:25a76a77-1a25-4062-bcf1-44270d11cd9d']){
   const unit=(await getEducationUnit(id))!;const source:any=unit.data;const original=JSON.stringify(source);const messages=Object.fromEntries(Object.entries(unit.messages).map(([path,text])=>[path,`中文 ${text}`]));const translated:any=applyEducationMessages(unit.kind,source,messages);
   expect(JSON.stringify(source)).toBe(original);expect(translated.id).toBe(source.id);expect(translated.answer).toBe(source.answer);expect(translated.verseRef).toBe(source.verseRef);expect(translated.book).toBe(source.book);
   if(unit.kind==='lesson')expect(translated.questions.map((q:any)=>q.answer)).toEqual(source.questions.map((q:any)=>q.answer));
   else expect(translated.options).toEqual(source.options.map((text:string)=>`中文 ${text}`));
   expect(()=>applyEducationMessages(unit.kind,source,{...messages,answer:'2'})).toThrow();
  }
 });
});
describe('bounded public education translation',()=>{
 it('translates exact script-tag units and reuses each unit cache without provider credentials or budget',async()=>{
  const fetcher=provider(),body={...input,language:'zh-Hant-HK'};const response=await educationTranslation(request(body),env,{store,fetcher});expect(response.status).toBe(200);const value=await response.json();expect(value).toMatchObject({language:'zh-Hant-HK',revision:educationRevision,reviewed:false,complete:true});expect(value.units[0].id).toBe(input.units[0]);expect(store.claim).toHaveBeenCalledOnce();
  fetcher.mockClear();vi.mocked(store.claim).mockClear().mockResolvedValue(false);
  expect((await educationTranslation(request(body),{},{store,fetcher})).status).toBe(200);const result=await educationTranslation(cachedRequest({...body,units:[...body.units,'catechism:0']}),{},{store,fetcher});expect(result.headers.get('cache-control')).toContain('public');expect(await result.json()).toMatchObject({complete:false,units:value.units});expect(fetcher).not.toHaveBeenCalled();expect(store.claim).not.toHaveBeenCalled();
 });
 it('rejects arbitrary source text, origin changes, invalid revisions, duplicate IDs and unsupported languages before spending',async()=>{
  const fetcher=provider();for(const [body,origin,status] of [[{...input,text:'private material'},undefined,400],[input,'https://evil.test',403],[{...input,revision:'old'},undefined,409],[{...input,units:['catalogue','catalogue']},undefined,400],[{...input,units:Array(6).fill('catalogue')},undefined,400],[{...input,language:'ase'},undefined,422],[{...input,units:['lesson:newcomer:99']},undefined,404],[{...input,units:['../../.env']},undefined,400]] as const){expect((await educationTranslation(request(body,origin),env,{store,fetcher})).status).toBe(status);}expect(fetcher).not.toHaveBeenCalled();expect(store.claim).not.toHaveBeenCalled();
 });
 it('GET never generates and rejects duplicate or unknown query fields',async()=>{
  const fetcher=provider();const response=await educationTranslation(cachedRequest(),env,{store,fetcher});expect(await response.json()).toMatchObject({complete:false,units:[]});for(const suffix of ['&units=catalogue','&text=private'])expect((await educationTranslation(new Request(cachedRequest().url+suffix),env,{store,fetcher})).status).toBe(400);expect(fetcher).not.toHaveBeenCalled();expect(store.claim).not.toHaveBeenCalled();
 });
 it('does not serve stale, wrong-language or malformed cache entries',async()=>{
  const unit=(await getEducationUnit(input.units[0]))!;for(const change of [{language:'ar'},{revision:'stale'},{id:'catalogue'},{reviewed:true},{messages:{title:'<script>'}}]){vi.mocked(store.get).mockResolvedValue({id:unit.id,language:'pt',revision:educationRevision,reviewed:false,messages:unit.messages,...change} as StoredEducationUnit);expect((await (await educationTranslation(cachedRequest(),{},{store})).json()).units).toEqual([]);}
 });
 it('requires provider configuration and denies generation when the shared budget is exhausted',async()=>{
  const fetcher=provider();expect((await educationTranslation(request(),{},{store,fetcher})).status).toBe(503);expect(store.claim).not.toHaveBeenCalled();vi.mocked(store.claim).mockResolvedValue(false);expect((await educationTranslation(request(),env,{store,fetcher})).status).toBe(429);expect(fetcher).not.toHaveBeenCalled();
 });
 it('bounds uncached source characters before model calls',async()=>{
  const source=async(id:string):Promise<EducationSourceUnit>=>({id,kind:'catalogue',data:[],messages:{title:'A'.repeat(6001)}});const fetcher=provider();expect((await educationTranslation(request({...input,units:['catalogue']}),env,{store,fetcher,source})).status).toBe(413);expect(fetcher).not.toHaveBeenCalled();expect(store.claim).not.toHaveBeenCalled();
 });
 it('bounds long output envelopes even when source strings are short',async()=>{
  const source=async(id:string):Promise<EducationSourceUnit>=>({id,kind:'catalogue',data:[],messages:Object.fromEntries(Array.from({length:121},(_,i)=>[String(i),'A']))});const fetcher=provider();expect((await educationTranslation(request({...input,units:['catalogue']}),env,{store,fetcher,source})).status).toBe(413);expect(fetcher).not.toHaveBeenCalled();expect(store.claim).not.toHaveBeenCalled();
 });
 it('rejects incomplete, duplicate, injected, wrong-language and truncated provider output',async()=>{
  const source=(await getEducationUnit(input.units[0]))!;const rows=Object.entries(source.messages).map(([path,text])=>({id:`${source.id}/${path}`,text:`Tradução ${text}`}));const valid={supported:true,language:'pt',messages:rows};
  for(const bad of [{...valid,messages:rows.slice(1)},{...valid,messages:[rows[1],...rows.slice(1)]},{...valid,messages:[{...rows[0],text:'<img onerror="x">'},...rows.slice(1)]},{...valid,language:'es'}])expect((await educationTranslation(request(),env,{store,fetcher:vi.fn().mockResolvedValue(answer(bad))})).status).toBe(502);
  expect((await educationTranslation(request(),env,{store,fetcher:vi.fn().mockResolvedValue(answer(valid,'length'))})).status).toBe(502);expect(store.set).not.toHaveBeenCalled();
 });
 it('does not claim English output or a declined language is translated',async()=>{
  const source=(await getEducationUnit(input.units[0]))!;for(const result of [{supported:false,language:'pt',messages:[]},{supported:true,language:'pt',messages:Object.entries(source.messages).map(([path,text])=>({id:`${source.id}/${path}`,text}))}])expect((await educationTranslation(request(),env,{store,fetcher:vi.fn().mockResolvedValue(answer(result))})).status).toBe(422);expect(store.set).not.toHaveBeenCalled();
 });
 it('deduplicates simultaneous identical work into one model reservation',async()=>{
  let release!:()=>void;const wait=new Promise<void>(resolve=>release=resolve),real=provider();const fetcher=vi.fn(async(...args:any[])=>{await wait;return real(args[0],args[1]);});const first=educationTranslation(request(),env,{store,fetcher});await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());const second=educationTranslation(request(),env,{store,fetcher});release();expect((await first).status).toBe(200);expect((await second).status).toBe(200);expect(fetcher).toHaveBeenCalledOnce();expect(store.claim).toHaveBeenCalledOnce();
 });
});
