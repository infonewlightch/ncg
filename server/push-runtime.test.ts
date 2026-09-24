import {it,expect,vi} from 'vitest';
import {createECDH} from 'node:crypto';
// @ts-ignore Node-only module
import {pushConfiguration,runQtPush} from './push-worker.mjs';
import {pushStatus} from '../netlify/functions/push-status.mts';
function env(){const pair=createECDH('prime256v1');pair.generateKeys();const pub=pair.getPublicKey().toString('base64url');return {NCG_QT_PUSH_ENABLED:'1',NCG_SUPABASE_URL:'https://yndtcpsajhmnyeqeozju.supabase.co',NCG_SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test',NCG_VAPID_PUBLIC_KEY:pub,VITE_VAPID_PUBLIC_KEY:pub,NCG_VAPID_PRIVATE_KEY:pair.getPrivateKey().toString('base64url')};}
it('requires explicit activation, the NCG project, a privileged server key and matching VAPID keys',()=>{
 const valid=env();expect(pushConfiguration(valid)).toBe(true);
 for(const patch of [{NCG_QT_PUSH_ENABLED:'0'},{NCG_SUPABASE_URL:'https://foreign.supabase.co'},{NCG_SUPABASE_SERVICE_ROLE_KEY:'sb_publishable_test'},{NCG_VAPID_PRIVATE_KEY:'not-a-key'},{VITE_VAPID_PUBLIC_KEY:'other-key'},{NCG_VAPID_PUBLIC_KEY:env().NCG_VAPID_PUBLIC_KEY}])expect(pushConfiguration({...valid,...patch})).toBe(false);
});
it('skips unconfigured dispatch without opening a database or sender',async()=>{const createClient=vi.fn(),setVapidDetails=vi.fn();expect(await runQtPush({}, {createClient,webpush:{setVapidDetails}})).toEqual({skipped:'not_configured'});expect(createClient).not.toHaveBeenCalled();expect(setVapidDetails).not.toHaveBeenCalled();});
it('uses a four-device batch and safe transport timeouts for a scheduled invocation',async()=>{
 const rpc=vi.fn(async()=>({data:[],error:null})),createClient=vi.fn((_url:string,_key:string,_options:any)=>({rpc})),setVapidDetails=vi.fn(),sendNotification=vi.fn();
 expect(await runQtPush(env(),{createClient,webpush:{setVapidDetails,sendNotification}})).toMatchObject({claimed:0,sent:0});expect(rpc).toHaveBeenCalledWith('ncg_claim_qt_push',{batch_size:4});expect(setVapidDetails.mock.calls[0][0]).toBe('mailto:infonewlightch@gmail.com');const options=createClient.mock.calls[0][2];expect(options.auth.persistSession).toBe(false);expect(typeof options.global.fetch).toBe('function');
});
it('sanitizes configuration and database failures',async()=>{const createClient=vi.fn(()=>({rpc:async()=>{throw Error('private-key-and-endpoint');}}));await expect(runQtPush(env(),{createClient,webpush:{setVapidDetails:()=>{},sendNotification:()=>{}}})).rejects.toThrow('QT reminder dispatch failed');});
it('publishes only readiness and the public key, never configuration secrets',async()=>{
 const settings=env(),request=new Request('https://newlightchurchglobal.com/api/push-status');
 const response=pushStatus(request,settings);expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toEqual({configured:true,publicKey:settings.NCG_VAPID_PUBLIC_KEY});
 expect(await pushStatus(request,{...settings,NCG_QT_PUSH_ENABLED:'0'}).json()).toEqual({configured:false});
 expect(pushStatus(new Request(request.url,{method:'POST'}),settings).status).toBe(405);
});
it('bounds database calls and rejects redirects without losing a caller cancellation',async()=>{
 const transport=vi.fn().mockResolvedValue(new Response('{}')),createClient=vi.fn((_url:string,_key:string,_options:any)=>({rpc:async()=>({data:[],error:null})}));vi.stubGlobal('fetch',transport);
 try{await runQtPush(env(),{createClient,webpush:{setVapidDetails:()=>{},sendNotification:()=>{}}});const fetch=createClient.mock.calls[0][2].global.fetch;
 const controller=new AbortController();controller.abort();await fetch('https://yndtcpsajhmnyeqeozju.supabase.co/rest/v1/rpc/test',{signal:controller.signal});const init=transport.mock.calls[0][1];expect(init.redirect).toBe('error');expect(init.signal.aborted).toBe(true);
 }finally{vi.unstubAllGlobals();}
});
