// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const seeds=vi.hoisted(()=>({load:vi.fn()}));
vi.mock('./interface-seeds',()=>({interfaceSeed:()=>seeds.load}));
import {interfaceSource} from './interface-catalogue';
let runtime:typeof import('./interface-runtime');
const context=Object.fromEntries(interfaceSource.map(row=>[row.en,row.ko]));
beforeEach(async()=>{localStorage.clear();seeds.load.mockReset();vi.resetModules();runtime=await import('./interface-runtime');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'unavailable'},{status:503})));});
afterEach(()=>vi.unstubAllGlobals());
it('retries a failed static preload on selection without requesting a model',async()=>{
 seeds.load.mockRejectedValueOnce(Error('temporary network failure')).mockResolvedValue({default:{language:'de',messages:{Home:'Startseite'},sourceContext:context}});
 await runtime.prepareInterface('de');await runtime.prepareInterface('de');
 expect(seeds.load).toHaveBeenCalledTimes(2);expect(runtime.runtimeInterfaceMessage('Home','de')).toBe('Startseite');expect(fetch).not.toHaveBeenCalled();
});
it('does not reintroduce old-context text from a static pack into the persistent cache',async()=>{
 seeds.load.mockResolvedValue({default:{language:'de',messages:{Home:'Stale',Bible:'Bibel'},sourceContext:{...context,Home:'changed'}}});
 await runtime.prepareInterface('de');
 const saved=JSON.parse(localStorage.getItem('ncg:interface:v2:de')!);expect(saved.map((row:{en:string})=>row.en)).toEqual(['Bible']);
 expect(runtime.runtimeInterfaceMessage('Bible','de')).toBe('Bibel');expect(runtime.runtimeInterfaceMessage('Home','de')).toBe('Home');
});
