import {describe,it,expect,vi} from 'vitest';
import {bibleTranslation,translationLanguage,validTranslation,type TranslationStore,type ScriptureTranslation} from './bible-translation';
const chapter={id:'JHN.3',reference:'John 3',verses:[{id:'JHN.3.1',number:'1',text:'Now there was a man of the Pharisees named Nicodemus, a ruler of the Jews.'},{id:'JHN.3.2',number:'2',text:'The same came to him by night.'}]};
const translated={supported:true,verses:[{id:'JHN.3.1',text:'Fear darbh ainm Nicodémus a bhí ann.'},{id:'JHN.3.2',text:'Tháinig sé chuige san oíche.'}]};
const env={OPENAI_API_KEY:'test-placeholder-key',OPENAI_BASE_URL:'https://gateway.example/openai',NCG_BIBLE_TRANSLATION_MODEL:'gpt-4.1-mini'};
const request=(body:unknown,headers:Record<string,string>={})=>new Request('https://ncg.example/api/bible-translation',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const body={language:'ga',chapter:'JHN.3',start:0};
function fixture(){const data=new Map<string,ScriptureTranslation>();return {get:vi.fn(async(key:string)=>data.get(key)||null),set:vi.fn(async(key:string,value:ScriptureTranslation)=>{data.set(key,value);}),claim:vi.fn(async()=>true)} satisfies TranslationStore;}
const completion=(value:unknown,finish='stop')=>new Response(JSON.stringify({choices:[{finish_reason:finish,message:{content:JSON.stringify(value)}}]}));
describe('unreviewed English-source Scripture assistance',()=>{
 it('accepts known language tags and prefers published versions, never text pretending to be sign language',()=>{
  expect(translationLanguage('ga')).toMatchObject({tag:'ga',published:false});expect(translationLanguage('es')).toMatchObject({published:true});expect(translationLanguage('kor')).toMatchObject({published:true});expect(translationLanguage('ase')).toBeNull();expect(translationLanguage('xyz-INVALID-!')).toBeNull();expect(translationLanguage('zzz')).toBeNull();
 });
 it('rejects arbitrary prompts, traversal, oversized ranges and cross-origin calls before provider use',async()=>{
  const fetcher=vi.fn();const store=fixture();
  for(const invalid of [{...body,text:'user supplied prompt'},{...body,chapter:'../../secret'},{...body,start:1},{...body,start:180}])expect((await bibleTranslation(request(invalid),env,{fetcher,store})).status).toBe(400);
  expect((await bibleTranslation(request(body,{Origin:'https://other.example'}),env,{fetcher,store})).status).toBe(403);
  expect((await bibleTranslation(request({...body,language:'ko'}),env,{fetcher,store})).status).toBe(409);expect(fetcher).not.toHaveBeenCalled();
 });
 it('uses server-owned English verses, fixes source and review labels, caches without another provider call',async()=>{
  const fetcher=vi.fn(async()=>completion(translated));const store=fixture();const readSource=vi.fn(async()=>chapter);
  const first=await bibleTranslation(request(body),env,{fetcher,store,readSource});expect(first.status).toBe(200);const data=await first.json();expect(data).toMatchObject({source:'WEBP',language:'ga',chapter:'JHN.3',start:0,reviewed:false,model:'gpt-4.1-mini',verses:translated.verses});
  const sent=JSON.parse((fetcher.mock.calls[0] as unknown as [URL,RequestInit])[1].body as string);expect(JSON.parse(sent.messages[1].content).verses).toEqual(chapter.verses.map(({id,text})=>({id,text})));expect(String((fetcher.mock.calls[0] as unknown as [URL])[0])).toBe('https://gateway.example/openai/v1/chat/completions');
  expect((await bibleTranslation(request(body),env,{fetcher,store,readSource})).status).toBe(200);expect(fetcher).toHaveBeenCalledTimes(1);expect(store.claim).toHaveBeenCalledTimes(1);
 });
 it('rejects missing, duplicated, reordered, unchanged or truncated verses without caching',async()=>{
  expect(validTranslation({supported:true,verses:[translated.verses[0]]},chapter.verses)).toBe(false);expect(validTranslation({supported:true,verses:[...translated.verses].reverse()},chapter.verses)).toBe(false);expect(validTranslation({supported:true,verses:[translated.verses[0],translated.verses[0]]},chapter.verses)).toBe(false);expect(validTranslation({supported:true,verses:chapter.verses},chapter.verses)).toBe(false);
  const store=fixture();const r=await bibleTranslation(request(body),env,{store,readSource:async()=>chapter,fetcher:async()=>completion(translated,'length')});expect(r.status).toBe(502);expect(store.set).not.toHaveBeenCalled();
 });
 it('fails closed on daily limits, missing provider, unsupported language and storage outage',async()=>{
  const store=fixture();const fetcher=vi.fn(async()=>completion(translated));const options={store,fetcher,readSource:async()=>chapter};store.claim.mockResolvedValue(false);expect((await bibleTranslation(request(body),env,options)).status).toBe(429);expect(fetcher).not.toHaveBeenCalled();
  expect((await bibleTranslation(request(body),{},options)).status).toBe(503);store.claim.mockResolvedValue(true);fetcher.mockImplementation(async()=>completion({supported:false,verses:[]}));expect((await bibleTranslation(request(body),env,options)).status).toBe(422);expect(store.set).not.toHaveBeenCalled();
  store.get.mockRejectedValue(new Error('storage unavailable'));expect((await bibleTranslation(request(body),env,options)).status).toBe(503);
 });
 it('does not ask the model to invent words for source verses that contain only a textual note',async()=>{
  const fetcher=vi.fn(async()=>completion(translated));const source={...chapter,verses:[...chapter.verses,{id:'JHN.3.3',number:'3',text:'',notes:['Omitted in this text.']}]};
  const r=await bibleTranslation(request(body),env,{store:fixture(),fetcher,readSource:async()=>source});expect(r.status).toBe(200);expect((await r.json()).verses).toHaveLength(2);
 });
});
