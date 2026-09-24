// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
vi.mock('./interface-seeds',()=>({interfaceSeed:()=>undefined}));
import {interfaceBatch,interfaceIds,interfaceBatchSize,interfaceRevision,validInterfaceMessages} from './interface-catalogue';
let runtime:typeof import('./interface-runtime');
beforeEach(async()=>{localStorage.clear();vi.resetModules();runtime=await import('./interface-runtime');});
afterEach(()=>vi.unstubAllGlobals());
const batch=Math.floor(interfaceIds.get('Home')!/interfaceBatchSize);
const response=(language:string,home:string)=>Response.json({language,batch,revision:interfaceRevision,messages:interfaceBatch(batch).map(r=>({id:r.id,text:r.en==='Home'?home:r.en}))});
it('keeps late responses in their own language and reuses a valid local cache',async()=>{
 let finishPortuguese!:(r:Response)=>void;const fetcher=vi.fn((url:string,options:any)=>{if(!options.body)return Promise.resolve(Response.json({language:new URL(url,'https://example.test').searchParams.get('language'),revision:interfaceRevision,batches:[]}));const lang=JSON.parse(options.body).language;return lang==='pt'?new Promise<Response>(resolve=>{finishPortuguese=resolve;}):Promise.resolve(response('fr','Accueil'));});vi.stubGlobal('fetch',fetcher);
 expect(runtime.runtimeInterfaceMessage('Home','pt')).toBe('Home');expect(runtime.runtimeInterfaceMessage('Home','fr')).toBe('Home');await vi.waitFor(()=>expect(runtime.runtimeInterfaceMessage('Home','fr')).toBe('Accueil'));finishPortuguese(response('pt','Início'));await vi.waitFor(()=>expect(runtime.runtimeInterfaceMessage('Home','pt')).toBe('Início'));expect(runtime.runtimeInterfaceMessage('Home','fr')).toBe('Accueil');
 vi.resetModules();runtime=await import('./interface-runtime');fetcher.mockClear();expect(runtime.runtimeInterfaceMessage('Home','pt')).toBe('Início');expect(fetcher).not.toHaveBeenCalled();
});
it('loads every available shared batch in one read without starting model requests',async()=>{
 const home=await response('lo','ໜ້າຫຼັກ').json();
 const fetcher=vi.fn().mockResolvedValue(Response.json({language:'lo',revision:interfaceRevision,batches:[home]}));vi.stubGlobal('fetch',fetcher);
 runtime.runtimeInterfaceMessage('Home','lo');await vi.waitFor(()=>expect(runtime.runtimeInterfaceMessage('Home','lo')).toBe('ໜ້າຫຼັກ'));
 expect(fetcher).toHaveBeenCalledOnce();expect(fetcher.mock.calls[0][0]).toContain('?language=lo&revision=');expect(fetcher.mock.calls[0][1].method).toBeUndefined();
 vi.resetModules();runtime=await import('./interface-runtime');fetcher.mockClear();expect(runtime.runtimeInterfaceMessage('Home','lo')).toBe('ໜ້າຫຼັກ');expect(fetcher).not.toHaveBeenCalled();
});
it('loads a newly selected language cache while previous-language model slots are still busy',async()=>{
 const finish:{batch:number;resolve:(response:Response)=>void}[]=[];
 const home=await response('fr','Accueil').json();
 const fetcher=vi.fn((url:string,options:any)=>{
  if(!options.body){const language=new URL(url,'https://example.test').searchParams.get('language');return Promise.resolve(Response.json({language,revision:interfaceRevision,batches:language==='fr'?[home]:[]}));}
  const {batch}=JSON.parse(options.body);return new Promise<Response>(resolve=>finish.push({batch,resolve}));
 });vi.stubGlobal('fetch',fetcher);
 runtime.runtimeInterfaceMessage(interfaceBatch(0)[0].en,'pt');runtime.runtimeInterfaceMessage(interfaceBatch(1)[0].en,'pt');
 await vi.waitFor(()=>expect(finish).toHaveLength(2));
 runtime.runtimeInterfaceMessage('Home','fr');await vi.waitFor(()=>expect(runtime.runtimeInterfaceMessage('Home','fr')).toBe('Accueil'));
 expect(fetcher.mock.calls.filter(([,options])=>options.body)).toHaveLength(2);
 for(const work of finish)work.resolve(Response.json({language:'pt',batch:work.batch,revision:interfaceRevision,messages:interfaceBatch(work.batch).map(row=>({id:row.id,text:row.en}))}));
});
it('rejects another language or stale cached batch and falls back to the exact language request',async()=>{
 const wrong=await response('fr','Wrong language').json();
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({language:'lo',revision:interfaceRevision,batches:[wrong,{...wrong,language:'lo',revision:'stale'}]})).mockResolvedValueOnce(response('lo','ໜ້າຫຼັກ'));vi.stubGlobal('fetch',fetcher);
 runtime.runtimeInterfaceMessage('Home','lo');await vi.waitFor(()=>expect(runtime.runtimeInterfaceMessage('Home','lo')).toBe('ໜ້າຫຼັກ'));
 expect(fetcher).toHaveBeenCalledTimes(2);expect(JSON.parse(fetcher.mock.calls[1][1].body).language).toBe('lo');
});
it('stops remaining generation batches after the daily limit and can still deliver cached text',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({language:'lo',revision:interfaceRevision,batches:[]})).mockImplementation(()=>Promise.resolve(Response.json({error:'translation_daily_limit'},{status:429})));vi.stubGlobal('fetch',fetcher);
 for(const b of [0,1,2,3,4])runtime.runtimeInterfaceMessage(interfaceBatch(b)[0].en,'lo');
 await vi.waitFor(()=>expect(runtime.runtimeInterfaceStatus('lo')).toBe('unavailable'));
 await new Promise(resolve=>setTimeout(resolve,0));expect(fetcher).toHaveBeenCalledTimes(3); // one cache read, at most two already in flight
 runtime.runtimeInterfaceMessage(interfaceBatch(5)[0].en,'lo');await new Promise(resolve=>setTimeout(resolve,0));expect(fetcher).toHaveBeenCalledTimes(3);
});
it('does not silently retry errors or report failed responses as translated',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({error:'unsupported_language'},{status:422}));vi.stubGlobal('fetch',fetcher);runtime.runtimeInterfaceMessage('Home','vi');await vi.waitFor(()=>expect(runtime.runtimeInterfaceStatus('vi')).toBe('unsupported'));runtime.runtimeInterfaceMessage('Bible','vi');expect(fetcher).toHaveBeenCalledOnce();
});
it('rejects corrupt cache entries and substitutions of placeholders or URLs',()=>{
 expect(validInterfaceMessages([{id:1,text:'Pregunta 8'}],[{id:1,en:'Question {number}'}])).toBe(false);expect(validInterfaceMessages([{id:1,text:'https://evil.test'}],[{id:1,en:'https://newlightchurchglobal.com'}])).toBe(false);
});
it('reuses individual translations after a release but rejects changed context and corrupt entries',()=>{
 const row=interfaceBatch(batch).find(row=>row.en==='Home')!;
 localStorage.setItem('ncg:interface:v2:de',JSON.stringify([{en:row.en,ko:row.ko,text:'Startseite'},{en:'Bible',ko:'old meaning',text:'wrong'},{en:'Removed message',ko:'old',text:'ignored'}]));
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 expect(runtime.runtimeInterfaceMessage('Home','de')).toBe('Startseite');
 expect(runtime.runtimeInterfaceMessage('Bible','de')).toBe('Bible');
 expect(fetcher).not.toHaveBeenCalled();
});
