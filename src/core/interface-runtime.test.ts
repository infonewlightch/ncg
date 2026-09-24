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
 let finishPortuguese!:(r:Response)=>void;const fetcher=vi.fn((_url:string,options:any)=>{const lang=JSON.parse(options.body).language;return lang==='pt'?new Promise<Response>(resolve=>{finishPortuguese=resolve;}):Promise.resolve(response('fr','Accueil'));});vi.stubGlobal('fetch',fetcher);
 expect(runtime.runtimeInterfaceMessage('Home','pt')).toBe('Home');expect(runtime.runtimeInterfaceMessage('Home','fr')).toBe('Home');await vi.waitFor(()=>expect(runtime.runtimeInterfaceMessage('Home','fr')).toBe('Accueil'));finishPortuguese(response('pt','Início'));await vi.waitFor(()=>expect(runtime.runtimeInterfaceMessage('Home','pt')).toBe('Início'));expect(runtime.runtimeInterfaceMessage('Home','fr')).toBe('Accueil');
 vi.resetModules();runtime=await import('./interface-runtime');fetcher.mockClear();expect(runtime.runtimeInterfaceMessage('Home','pt')).toBe('Início');expect(fetcher).not.toHaveBeenCalled();
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
