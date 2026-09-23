import {afterEach,it,expect,vi} from 'vitest';
import {createTranslationFunction} from '../netlify/functions/translate.mts';
import {gatewayServices,type GatewayServices} from './gateway';
const env={NCG_PUBLIC_ORIGIN:'https://newlightchurchglobal.com',NCG_SUPABASE_URL:'https://yndtcpsajhmnyeqeozju.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',OPENAI_API_KEY:'test-only',OPENAI_BASE_URL:'https://provider.example/v1'};
const postId='11111111-1111-4111-8111-111111111111',messageId='22222222-2222-4222-8222-222222222222';
const token='a'.repeat(30);
const request=(body:unknown,headers:Record<string,string>={})=>new Request('https://newlightchurchglobal.com/api/translate',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
function setup(){
 const services={...gatewayServices({}),verify:vi.fn(async()=>'member'),post:vi.fn(async()=>({body:'A public reflection.',language:'en',status:'published'})),message:vi.fn(async()=>({body:'A private greeting.',language:'en',status:'published'}))} as GatewayServices;
 const claim=vi.fn(async()=>true),provider=vi.fn(async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'번역된 문장'}}]}));vi.stubGlobal('fetch',provider);
 return {services,claim,provider,call:createTranslationFunction(env,services,claim)};
}
afterEach(()=>vi.unstubAllGlobals());
it('connects stored public text, shared budget and the configured AI endpoint',async()=>{
 const s=setup();const r=await s.call(request({postId,target:'ko',text:'Forged source'}),{ip:'192.0.2.1'});expect(r.status).toBe(200);expect(await r.json()).toMatchObject({translated:true,text:'번역된 문장'});expect(s.claim).toHaveBeenCalledWith(expect.objectContaining(env),'community',null);const [url,init]=s.provider.mock.calls[0] as unknown as [URL,RequestInit];expect(String(url)).toBe('https://provider.example/v1/chat/completions');expect(JSON.parse(String(init.body)).messages[1].content).toBe('A public reflection.');expect(r.headers.get('cache-control')).toBe('no-store');
});
it('forwards verified session only to the quota service and confines message source resolution',async()=>{
 const s=setup();const r=await s.call(request({messageId,target:'es'},{Authorization:`Bearer ${token}`}),{ip:'192.0.2.2'});expect(r.status).toBe(200);expect(s.services.message).toHaveBeenCalledWith(messageId,token,'member');expect(s.claim).toHaveBeenCalledWith(expect.any(Object),'community',token);const [,init]=s.provider.mock.calls[0] as unknown as [URL,RequestInit];expect(JSON.stringify(init)).not.toContain(token);
});
it('stops on inaccessible sources, invalid sessions and quota failures without provider leakage',async()=>{
 const s=setup();s.services.verify=vi.fn(async()=>null);const denied=createTranslationFunction(env,s.services,s.claim);expect((await denied(request({messageId,target:'ko'},{Authorization:`Bearer ${token}`}))).status).toBe(401);
 s.services.post=vi.fn(async()=>null);expect((await createTranslationFunction(env,s.services,s.claim)(request({postId,target:'ko'}))).status).toBe(404);
 s.services.post=vi.fn(async()=>({body:'Unique new public reflection',language:'en',status:'published'}));s.claim.mockRejectedValue(Error('secret credential'));const r=await createTranslationFunction(env,s.services,s.claim)(request({postId,target:'fr'}));expect(r.status).toBe(503);expect(await r.text()).not.toContain('secret');expect(s.provider).not.toHaveBeenCalled();
});
it('rejects foreign origins, oversized bodies and method misuse',async()=>{
 const s=setup();expect((await s.call(request({postId,target:'ko'},{Origin:'https://foreign.test'}))).status).toBe(403);expect((await s.call(request({text:'x'.repeat(13000)}))).status).toBe(413);expect((await s.call(new Request('https://newlightchurchglobal.com/api/translate'))).status).toBe(405);expect(s.provider).not.toHaveBeenCalled();
});
