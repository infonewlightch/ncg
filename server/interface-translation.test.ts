import {beforeEach,describe,it,expect,vi} from 'vitest';
import {interfaceTranslation,type InterfaceStore} from './interface-translation';
import {interfaceBatch,interfaceRevision} from '../src/core/interface-catalogue';
const env={OPENAI_API_KEY:'test-only',OPENAI_BASE_URL:'https://provider.invalid'};
const req=(data:unknown,origin='https://example.test')=>new Request('https://example.test/api/interface-translation',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(data)});
const input={language:'pt',batch:0,revision:interfaceRevision};
const cachedReq=(language='pt',revision=interfaceRevision,extra='')=>new Request(`https://example.test/api/interface-translation?language=${language}&revision=${revision}${extra}`);
const translated=()=>({supported:true,messages:interfaceBatch(0).map(r=>({id:r.id,text:r.en==='Home'?'Início':r.en}))});
const answer=(data:unknown,finish_reason='stop')=>Response.json({choices:[{finish_reason,message:{content:JSON.stringify(data)}}]});
let store:InterfaceStore;beforeEach(()=>{store={get:vi.fn().mockResolvedValue(null),set:vi.fn().mockResolvedValue(undefined),claim:vi.fn().mockResolvedValue(true)};});
describe('public interface translation, only developer-owned catalogue text',()=>{
 it('delivers all cached batches with one GET even without model credentials or remaining budget',async()=>{
  const saved=new Map();store.get=vi.fn(async key=>saved.get(key)||null);store.set=vi.fn(async(key,value)=>{saved.set(key,value);});
  const fetcher=vi.fn().mockResolvedValue(answer(translated()));await interfaceTranslation(req(input),env,{store,fetcher});
  fetcher.mockClear();vi.mocked(store.claim).mockClear().mockResolvedValue(false);
  const response=await interfaceTranslation(cachedReq(),{},{store,fetcher});expect(response.status).toBe(200);
  const data=await response.json();expect(data.batches).toHaveLength(1);expect(data.complete).toBe(false);expect(data.batches[0].messages).toEqual(translated().messages);expect(response.headers.get('cache-control')).toContain('public');expect(fetcher).not.toHaveBeenCalled();expect(store.claim).not.toHaveBeenCalled();
 });
 it('does not publish corrupt, stale or wrong-language cached batches',async()=>{
  for(const change of [{language:'ar'},{revision:'old'},{messages:[{id:0,text:'<script>'}]}]){
   vi.mocked(store.get).mockResolvedValue({language:'pt',revision:interfaceRevision,batch:0,reviewed:false,messages:translated().messages,...change});
   const data=await (await interfaceTranslation(cachedReq(),{},{store})).json();expect(data.batches).toEqual([]);
  }
 });
 it('validates cache query fields before reading storage and keeps errors uncacheable',async()=>{
  for(const [request,status] of [[cachedReq('pt','old'),409],[cachedReq('ase'),422],[cachedReq('pt',interfaceRevision,'&language=ar'),400],[cachedReq('pt',interfaceRevision,'&text=private'),400]] as const){const response=await interfaceTranslation(request,{},{store});expect(response.status).toBe(status);expect(response.headers.get('cache-control')).toBe('no-store');}
  expect(store.get).not.toHaveBeenCalled();expect(store.claim).not.toHaveBeenCalled();
 });
 it('translates an exact script tag, stores a validated result and reuses cache without a model call',async()=>{
  const fetcher=vi.fn().mockResolvedValue(answer(translated()));const response=await interfaceTranslation(req({...input,language:'pt-BR'}),env,{store,fetcher});expect(response.status).toBe(200);const result=await response.json();expect(result.language).toBe('pt-BR');expect(result.reviewed).toBe(false);expect(store.claim).toHaveBeenCalledOnce();expect(store.set).toHaveBeenCalledOnce();
  vi.mocked(store.get).mockResolvedValue(result);fetcher.mockClear();expect((await interfaceTranslation(req({...input,language:'pt-BR'}),env,{store,fetcher})).status).toBe(200);expect(fetcher).not.toHaveBeenCalled();
 });
 it('rejects arbitrary text, different origins, stale catalogue IDs and unsupported sign languages before spending',async()=>{
  const fetcher=vi.fn();for(const [data,origin,status] of [[{...input,text:'private chat'},undefined,400],[input,'https://evil.test',403],[{...input,revision:'old'},undefined,409],[{...input,batch:999},undefined,400],[{...input,language:'ase'},undefined,422]] as const)expect((await interfaceTranslation(req(data,origin),env,{store,fetcher})).status).toBe(status);expect(fetcher).not.toHaveBeenCalled();expect(store.claim).not.toHaveBeenCalled();
 });
 it('does not publish missing IDs, changed placeholders, markup or truncated output',async()=>{
  const incomplete=translated();incomplete.messages.pop();const html=translated();html.messages[0].text='<script>alert(1)</script>';
  for(const data of [incomplete,html])expect((await interfaceTranslation(req(input),env,{store,fetcher:vi.fn().mockResolvedValue(answer(data))})).status).toBe(502);
  expect((await interfaceTranslation(req(input),env,{store,fetcher:vi.fn().mockResolvedValue(answer(translated(),'length'))})).status).toBe(502);expect(store.set).not.toHaveBeenCalled();
 });
 it('rejects a provider that claims support but returns the whole English batch unchanged',async()=>{const fetcher=vi.fn().mockResolvedValue(answer({supported:true,messages:interfaceBatch(0).map(r=>({id:r.id,text:r.en}))}));expect((await interfaceTranslation(req(input),env,{store,fetcher})).status).toBe(422);expect(store.set).not.toHaveBeenCalled();});
 it('honors the shared budget and provider refusal without labelling English as translated',async()=>{
  const fetcher=vi.fn().mockResolvedValue(answer({supported:false,messages:[]}));vi.mocked(store.claim).mockResolvedValue(false);expect((await interfaceTranslation(req(input),env,{store,fetcher})).status).toBe(429);expect(fetcher).not.toHaveBeenCalled();vi.mocked(store.claim).mockResolvedValue(true);expect((await interfaceTranslation(req(input),env,{store,fetcher})).status).toBe(422);expect(store.set).not.toHaveBeenCalled();
 });
});
