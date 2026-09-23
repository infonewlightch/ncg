import {afterEach,it,expect,vi} from 'vitest';
import {gatewayServices} from './gateway';
const env={NCG_SUPABASE_URL:'https://yndtcpsajhmnyeqeozju.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const token='verified-test-token',member='member-id';
afterEach(()=>vi.unstubAllGlobals());
it.each([{sender:'someone',recipient:'another',status:'published',allowed:true},{sender:member,recipient:'peer',status:'pending',allowed:true},{sender:member,recipient:'peer',status:'published',allowed:false}])('keeps unrelated, reviewed and blocked messages out of translation',async(row)=>{
 const fetcher=vi.fn(async(input:RequestInfo|URL)=>String(input).includes('/rpc/')?Response.json(row.allowed):Response.json({...row,body:'Private original',language:'en'}));vi.stubGlobal('fetch',fetcher);
 expect(await gatewayServices(env).message!('id',token,member)).toBeNull();
 for(const call of fetcher.mock.calls){expect(String(call[0])).toContain('yndtcpsajhmnyeqeozju.supabase.co');}
});
it('uses the member bearer for both message RLS and current friendship/block checks',async()=>{
 const fetcher=vi.fn(async(input:RequestInfo|URL)=>String(input).includes('/rpc/')?Response.json(true):Response.json({sender:member,recipient:'peer',status:'published',body:'Stored original',language:'en'}));vi.stubGlobal('fetch',fetcher);
 expect(await gatewayServices(env).message!('id',token,member)).toMatchObject({body:'Stored original'});expect(fetcher).toHaveBeenCalledTimes(2);
 for(const [,init] of fetcher.mock.calls as unknown as [unknown,RequestInit][]){expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`);expect(init.redirect).toBe('error');}
});
it('never uses a different Supabase project or secret key for source reads',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);for(const invalid of [{...env,NCG_SUPABASE_URL:'https://foreign.supabase.co'},{...env,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_test'}])expect(await gatewayServices(invalid).message!('id',token,member)).toBeNull();expect(fetcher).not.toHaveBeenCalled();
});
