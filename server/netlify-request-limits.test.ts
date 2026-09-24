import {it,expect,vi} from 'vitest';
import {createNetlifyRequestLimiter} from './netlify-request-limits';
it('keeps warm-worker windows until expiry and returns the actual remaining retry time',()=>{
 let time=1000;const limit=createNetlifyRequestLimiter({now:()=>time});
 for(let n=0;n<30;n++)expect(limit('community',{ip:'192.0.2.1'})).toBeNull();
 time+=1500;const response=limit('community',{ip:'192.0.2.1'})!;expect(response.status).toBe(429);expect(response.headers.get('retry-after')).toBe('179');expect(response.headers.get('cache-control')).toBe('no-store');
 expect(limit('community',{ip:'192.0.2.2'})).toBeNull();expect(limit('video',{ip:'192.0.2.1'})).toBeNull();time=181000;expect(limit('community',{ip:'192.0.2.1'})).toBeNull();
});
it('bounds active keys without evicting blocked clients and reclaims expired windows',()=>{
 let time=0;const limit=createNetlifyRequestLimiter({now:()=>time,maxKeys:2});
 expect(limit('push',{ip:'192.0.2.1'})).toBeNull();expect(limit('push',{ip:'192.0.2.2'})).toBeNull();expect(limit('push',{ip:'192.0.2.3'})!.status).toBe(429);
 for(let n=1;n<60;n++)expect(limit('push',{ip:'192.0.2.1'})).toBeNull();expect(limit('push',{ip:'192.0.2.1'})!.status).toBe(429);
 time=60000;expect(limit('push',{ip:'192.0.2.3'})).toBeNull();expect(limit('push',{ip:'192.0.2.1'})).toBeNull();
});
it('shares one conservative bucket for missing or invalid trusted addresses',()=>{
 const limit=createNetlifyRequestLimiter();for(let n=0;n<30;n++)expect(limit('community',{ip:`spoof-${n}`})).toBeNull();expect(limit('community')!.status).toBe(429);expect(limit('community',{ip:'2001:db8::1'})).toBeNull();
});
const mocks=vi.hoisted(()=>({storage:vi.fn(()=>({})),interface:vi.fn(async()=>Response.json({ok:true})),video:vi.fn(async()=>Response.json({ok:true})),gateway:vi.fn(async(_request:any,response:any)=>{response.writeHead(200);response.end('{}');})}));
vi.mock('@netlify/blobs',()=>({getStore:mocks.storage}));
vi.mock('./interface-translation.ts',()=>({interfaceTranslation:mocks.interface}));
vi.mock('./video-translation.ts',()=>({videoTranslation:mocks.video}));
vi.mock('./gateway.ts',()=>({createGateway:()=>mocks.gateway,gatewayServices:()=>({})}));
it.each([
 ['interface-translation',80,180],['video-translation',40,180],['translate',30,180],['push-status',60,60]
] as const)('protects the deployed %s handler before storage or upstream work, ignoring spoofed forwarding headers',async(name,count,seconds)=>{
 const {default:handler}=await import(`../netlify/functions/${name}.mts`);
 let forwarded=0;const request=()=>new Request(`https://ncg.example/api/${name}`,{headers:{'X-Forwarded-For':`192.0.2.${++forwarded}`}});
 for(let n=0;n<count;n++)expect((await handler(request(),{ip:'198.51.100.5'})).status).toBe(200);
 const calls=[mocks.storage.mock.calls.length,mocks.interface.mock.calls.length,mocks.video.mock.calls.length,mocks.gateway.mock.calls.length];
 const blocked=await handler(request(),{ip:'198.51.100.5'});expect(blocked.status).toBe(429);expect(Number(blocked.headers.get('retry-after'))).toBeLessThanOrEqual(seconds);expect(await blocked.json()).toEqual({error:'rate_limited'});
 expect([mocks.storage.mock.calls.length,mocks.interface.mock.calls.length,mocks.video.mock.calls.length,mocks.gateway.mock.calls.length]).toEqual(calls);
});
