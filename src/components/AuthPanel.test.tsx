import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {parseHTML} from 'linkedom';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({methods:vi.fn(),oauth:vi.fn(),otp:vi.fn(),verify:vi.fn(),clear:vi.fn()}));
vi.mock('../auth',()=>({getAuthMethods:mocks.methods,supabase:{auth:{signInWithOAuth:mocks.oauth,signInWithOtp:mocks.otp,verifyOtp:mocks.verify}},useAuth:()=>({configured:true,loading:false,clearIssue:mocks.clear})}));
vi.mock('../state',()=>({useApp:()=>({t:(_ko:string,en:string)=>en})}));
import {AuthPanel} from './AuthPanel';
let root:Root,container:HTMLElement;
const button=(text:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent===text)!;
beforeEach(()=>{
 vi.resetAllMocks();
 const {window}=parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
 vi.stubGlobal('window',window);vi.stubGlobal('document',window.document);vi.stubGlobal('navigator',{userAgent:'unit test'});vi.stubGlobal('location',{pathname:'/',origin:'https://ncg.example'});vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 container=document.getElementById('root')!;root=createRoot(container);
 mocks.methods.mockResolvedValue({google:false,email:true,signup:true});
});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();vi.useRealTimers();});
describe('sign-in UI with real provider availability states',()=>{
 it('keeps disabled Google from starting OAuth while leaving email available',async()=>{
  await act(async()=>root.render(<AuthPanel/>));
  expect(button('GContinue with Google').disabled).toBe(true);expect(container.textContent).toContain('Google sign-in is being prepared.');
  expect(button('Send sign-in email').disabled).toBe(false);
  await act(async()=>button('GContinue with Google').click());expect(mocks.oauth).not.toHaveBeenCalled();
 });
 it('shows a retry after settings failure and enables Google only after a successful check',async()=>{
  mocks.methods.mockRejectedValueOnce(new Error('offline'));await act(async()=>root.render(<AuthPanel/>));
  expect(button('GContinue with Google').disabled).toBe(true);expect(button('Send sign-in email').disabled).toBe(true);
  mocks.methods.mockResolvedValueOnce({google:true,email:true,signup:false});await act(async()=>button('Try again').click());
  expect(button('GContinue with Google').disabled).toBe(false);expect(button('Join NCG').disabled).toBe(true);
 });
 it('locks repeated email submission and applies a resend cooldown without making real requests',async()=>{
  let resolve!:(value:{error:null})=>void;mocks.otp.mockReturnValue(new Promise(done=>{resolve=done;}));
  await act(async()=>root.render(<AuthPanel/>));
  // Direct form events test the action lock independently of browser form validation.
  const form=container.querySelector('form')!;
  await act(async()=>{form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));});
  expect(mocks.otp).toHaveBeenCalledTimes(1);expect(button('Join NCG').disabled).toBe(true);
  await act(async()=>resolve({error:null}));
  expect(container.textContent).toContain('Open the link in the browser where you requested the email.');
  expect(button('Request another email').disabled).toBe(true);expect(container.textContent).toMatch(/Request again in 60 seconds/);
 });
});
