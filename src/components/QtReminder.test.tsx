// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({user:'first' as string|null,rpc:vi.fn(),headers:vi.fn(),read:vi.fn(),permission:vi.fn(),subscribe:vi.fn(),existing:vi.fn(),fetch:vi.fn()}));
vi.mock('../auth',()=>({useAuth:()=>({session:mocks.user?{user:{id:mocks.user},access_token:`token-${mocks.user}`}:null}),supabase:{rpc:(...args:unknown[])=>({setHeader:(name:string,value:string)=>{mocks.headers(name,value);return mocks.rpc(...args);}}),from:()=>{const query:any={select:()=>query,eq:()=>query,maybeSingle:()=>query,setHeader:()=>mocks.read()};return query;}}}));
vi.mock('../state',()=>({useApp:()=>({state:{ui:'en',language:'en'},t:(_ko:string,en:string)=>en})}));
let root:Root,container:HTMLElement,QtReminder:typeof import('./QtReminder').QtReminder;
const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const button=(name:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent===name)!;
const render=()=>act(async()=>root.render(<QtReminder/>));
const subscription=()=>({endpoint:'https://fcm.googleapis.com/fake-device',toJSON:()=>({endpoint:'https://fcm.googleapis.com/fake-device'}),unsubscribe:vi.fn().mockResolvedValue(true)});
beforeEach(async()=>{
 vi.resetAllMocks();mocks.user='first';vi.stubEnv('PROD',true);vi.stubEnv('VITE_VAPID_PUBLIC_KEY','public-test-key');
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('Notification',{permission:'granted',requestPermission:mocks.permission});vi.stubGlobal('PushManager',{});vi.stubGlobal('isSecureContext',true);vi.stubGlobal('fetch',mocks.fetch);
 const registration={pushManager:{getSubscription:mocks.existing,subscribe:mocks.subscribe}};
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:vi.fn().mockResolvedValue(registration),register:vi.fn().mockResolvedValue(registration),ready:Promise.resolve(registration)}});
 mocks.permission.mockResolvedValue('granted');mocks.existing.mockResolvedValue(null);mocks.subscribe.mockResolvedValue(subscription());mocks.rpc.mockResolvedValue({data:'subscription-id',error:null});mocks.read.mockResolvedValue({data:null,error:null});mocks.fetch.mockImplementation(async()=>new Response(JSON.stringify({configured:true,publicKey:'public-test-key'})));
 ({QtReminder}=await import('./QtReminder'));document.body.innerHTML='<div id="root"></div>';container=document.getElementById('root')!;root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('does not request browser permission when the server is not configured',async()=>{
 mocks.fetch.mockResolvedValue(new Response(JSON.stringify({configured:false})));await render();
 expect(button('Enable QT reminders').disabled).toBe(true);await act(async()=>button('Enable QT reminders').click());expect(mocks.permission).not.toHaveBeenCalled();
});
it('rejects a server key that differs from this frontend build',async()=>{
 mocks.fetch.mockResolvedValue(new Response(JSON.stringify({configured:true,publicKey:'different-key'})));await render();expect(button('Enable QT reminders').disabled).toBe(true);
});
it('allows retrying a failed readiness check before subscribing',async()=>{
 mocks.fetch.mockRejectedValueOnce(Error('offline'));await render();expect(button('Enable QT reminders').disabled).toBe(true);
 await act(async()=>button('Check again').click());expect(button('Enable QT reminders').disabled).toBe(false);
});
it('serializes repeated clicks while browser consent is pending',async()=>{
 const consent=deferred();mocks.permission.mockReturnValue(consent.promise);await render();await act(async()=>{button('Enable QT reminders').click();button('Enable QT reminders').click();});
 expect(mocks.permission).toHaveBeenCalledTimes(1);expect([...container.querySelectorAll('input')].every(input=>input.disabled)).toBe(true);
 await act(async()=>consent.resolve('granted'));expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it('does not subscribe after the account changes during browser consent',async()=>{
 const consent=deferred();mocks.permission.mockReturnValue(consent.promise);await render();await act(async()=>button('Enable QT reminders').click());
 mocks.user='second';await render();await act(async()=>consent.resolve('granted'));expect(mocks.subscribe).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();expect(container.textContent).not.toContain('Daily QT reminders are enabled');
});
it('does not display an old account registration result for the next account',async()=>{
 const result=deferred();mocks.rpc.mockReturnValueOnce(result.promise);await render();await act(async()=>button('Enable QT reminders').click());
 mocks.user='second';await render();await act(async()=>result.resolve({data:'old-account-row',error:null}));expect(container.textContent).not.toContain('Daily QT reminders are enabled');expect(button('Turn off')).toBeUndefined();expect(mocks.headers).toHaveBeenCalledWith('Authorization','Bearer token-first');
});
it('does not enable while saved device settings are still loading',async()=>{
 const saved=deferred();mocks.existing.mockResolvedValue(subscription());mocks.read.mockReturnValue(saved.promise);await render();
 expect(button('Enable QT reminders').disabled).toBe(true);expect([...container.querySelectorAll('input')].every(input=>input.disabled)).toBe(true);
 await act(async()=>saved.resolve({data:{id:'saved',local_time:'09:15:00',time_zone:'Europe/London',language:'en',enabled:true},error:null}));expect(button('Save time & language').disabled).toBe(false);expect((container.querySelector('input[type=time]') as HTMLInputElement).value).toBe('09:15');
});
it('removes a newly created device subscription when registration fails',async()=>{
 const created=subscription();mocks.subscribe.mockResolvedValue(created);mocks.rpc.mockRejectedValue(Error('offline'));await render();await act(async()=>button('Enable QT reminders').click());
 expect(created.unsubscribe).toHaveBeenCalledOnce();expect(container.textContent).toContain('Unable to enable reminders');expect(button('Turn off')).toBeUndefined();
});
it('keeps turn-off available when the service has been paused',async()=>{
 const saved=subscription();mocks.existing.mockResolvedValue(saved);mocks.fetch.mockResolvedValue(new Response(JSON.stringify({configured:false})));mocks.read.mockResolvedValue({data:{id:'saved',local_time:'07:00:00',time_zone:'Asia/Seoul',language:'en',enabled:true},error:null});
 await render();expect(button('Save time & language').disabled).toBe(true);await act(async()=>button('Turn off').click());expect(mocks.rpc).toHaveBeenCalledWith('ncg_disable_push',{subscription_id:'saved'});expect(saved.unsubscribe).toHaveBeenCalledOnce();
});
it('cleans up a subscription created after leaving the account',async()=>{
 const pending=deferred(),created=subscription();mocks.subscribe.mockReturnValue(pending.promise);await render();await act(async()=>button('Enable QT reminders').click());mocks.user=null;await render();
 await act(async()=>pending.resolve(created));expect(created.unsubscribe).toHaveBeenCalledOnce();expect(mocks.rpc).not.toHaveBeenCalled();
});
it('recovers a device-settings error without silently overwriting unknown preferences',async()=>{
 mocks.existing.mockResolvedValue(subscription());mocks.read.mockRejectedValueOnce(Error('offline'));await render();expect(button('Enable QT reminders').disabled).toBe(true);expect(container.textContent).toContain('Unable to check reminders');
 await act(async()=>button('Check again').click());expect(button('Enable QT reminders').disabled).toBe(false);expect(container.querySelector('[role=alert]')).toBeNull();
});
