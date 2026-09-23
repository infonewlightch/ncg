import {it,expect,vi} from 'vitest';
import {checkHostingConfig,verifyHostingConfig} from './check-hosting-config.mjs';
const env={VITE_SUPABASE_URL:'https://yndtcpsajhmnyeqeozju.supabase.co',NCG_SUPABASE_URL:'https://yndtcpsajhmnyeqeozju.supabase.co',NCG_PUBLIC_ORIGIN:'https://newlightchurchglobal.com',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only_placeholder'};
const jwt=role=>`header.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
it('blocks missing, incorrect-project and insecure-origin builds without echoing values',()=>{
 for(const name of Object.keys(env)){const copy={...env};delete copy[name];expect(()=>checkHostingConfig(copy)).toThrow(/Missing required/);}
 expect(()=>checkHostingConfig({...env,NCG_SUPABASE_URL:'https://other.supabase.co'})).toThrow(/NCG Supabase project/);
 expect(()=>checkHostingConfig({...env,NCG_PUBLIC_ORIGIN:'http://newlightchurchglobal.com'})).toThrow(/HTTPS/);
 for(const secret of ['sb_secret_do_not_log_this',jwt('service_role')]){
  let message='';try{checkHostingConfig({...env,VITE_SUPABASE_PUBLISHABLE_KEY:secret});}catch(error){message=error.message;}
  expect(message).toContain('public');expect(message).not.toContain(secret);
  expect(()=>checkHostingConfig({...env,VITE_OTHER_KEY:secret})).toThrow(/privileged/);
 }
 expect(checkHostingConfig({...env,VITE_SUPABASE_PUBLISHABLE_KEY:jwt('anon')})).toBeTruthy();
});
it('verifies the public connection without cookies and accepts disabled Google as an unfinished provider',async()=>{
 const request=vi.fn().mockResolvedValue({ok:true,json:async()=>({external:{google:false,email:true}})});
 await verifyHostingConfig(env,request);expect(request.mock.calls[0][1]).toMatchObject({credentials:'omit',cache:'no-store'});
 for(const result of [{ok:false},{ok:true,json:async()=>({})}])await expect(verifyHostingConfig(env,async()=>result)).rejects.toThrow();
 await expect(verifyHostingConfig(env,async()=>{throw Error(env.VITE_SUPABASE_PUBLISHABLE_KEY);})).rejects.toThrow('The public NCG authentication connection could not be verified. No build was started.');
});
