// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {interfaceSource} from './interface-catalogue';
const mocks=vi.hoisted(()=>({loader:vi.fn()}));
vi.mock('./interface-seeds',()=>({interfaceSeed:()=>mocks.loader}));
let runtime:typeof import('./interface-runtime');
const complete=()=>({default:{language:'pt',reviewed:false,messages:Object.fromEntries(interfaceSource.map(r=>[r.en,r.en==='Home'?'Início':r.en])),sourceContext:Object.fromEntries(interfaceSource.map(r=>[r.en,r.ko]))}});
beforeEach(async()=>{localStorage.clear();vi.resetModules();mocks.loader.mockReset();vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('No translation calls expected')));runtime=await import('./interface-runtime');});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('reports a missing static file and never sends it to automatic translation',async()=>{
 mocks.loader.mockRejectedValue(new TypeError('Failed to fetch dynamically imported module'));
 const ready=await runtime.prepareInterface('pt');
 runtime.runtimeInterfaceMessage('Home','pt');await Promise.resolve();await Promise.resolve();
 expect(fetch).not.toHaveBeenCalled();expect(ready).toBe(false);expect(runtime.runtimeInterfaceStatus('pt')).toBe('unavailable');
});
it('rejects incomplete or changed-context static packs atomically',async()=>{
 const data=complete();data.default.sourceContext.Home='changed meaning';mocks.loader.mockResolvedValue(data);
 expect(await runtime.prepareInterface('pt')).toBe(false);
 expect(runtime.runtimeInterfaceMessage('Home','pt')).toBe('Home');expect(runtime.runtimeInterfaceMessage('Bible','pt')).toBe('Bible');
 await Promise.resolve();expect(fetch).not.toHaveBeenCalled();
});
it('bounds stalled downloads and ignores their late result',async()=>{
 vi.useFakeTimers();let finish!:(data:ReturnType<typeof complete>)=>void;
 mocks.loader.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const ready=runtime.prepareInterface('pt');await vi.advanceTimersByTimeAsync(10000);
 expect(await ready).toBe(false);finish(complete());await Promise.resolve();await Promise.resolve();
 expect(runtime.runtimeInterfaceMessage('Home','pt')).toBe('Home');expect(runtime.runtimeInterfaceStatus('pt')).toBe('unavailable');expect(fetch).not.toHaveBeenCalled();
});
it('retries static delivery and clears the failure when it succeeds',async()=>{
 mocks.loader.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(complete());
 expect(await runtime.prepareInterface('pt')).toBe(false);
 expect(await runtime.prepareInterface('pt')).toBe(true);
 expect(runtime.runtimeInterfaceMessage('Home','pt')).toBe('Início');expect(runtime.runtimeInterfaceStatus('pt')).toBe('automatic');expect(fetch).not.toHaveBeenCalled();
});
it('retains a fully validated saved pack when the network download fails',async()=>{
 localStorage.setItem('ncg:interface:v2:pt',JSON.stringify(interfaceSource.map(r=>({...r,text:r.en==='Home'?'Início':r.en}))));
 mocks.loader.mockRejectedValue(new Error('offline'));
 expect(await runtime.prepareInterface('pt')).toBe(true);expect(runtime.runtimeInterfaceMessage('Home','pt')).toBe('Início');expect(runtime.runtimeInterfaceStatus('pt')).toBe('automatic');expect(fetch).not.toHaveBeenCalled();
});
