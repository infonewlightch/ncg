import {describe,it,expect,vi} from 'vitest';
import {inspectAuthReturn,resolveAuthReturnIssue,parseAuthMethods,loadAuthMethods,authIssueFromError} from './auth-flow';
describe('available authentication methods',()=>{
 it('reflects actual provider switches and registration policy',()=>{
  expect(parseAuthMethods({external:{google:false,email:true},disable_signup:false})).toEqual({google:false,email:true,signup:true});
  expect(parseAuthMethods({external:{google:true,email:false},disable_signup:true})).toEqual({google:true,email:false,signup:false});
  for(const value of [null,{}, {external:{email:true},disable_signup:false},{external:{google:'true',email:true},disable_signup:false}])expect(()=>parseAuthMethods(value)).toThrow('invalid_auth_settings');
 });
 it('fetches only public settings, without cookies, and rejects unsuccessful responses',async()=>{
  const request=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({external:{google:false,email:true},disable_signup:false}),{status:200}));
  await expect(loadAuthMethods('https://example.supabase.co','public-fixture',new AbortController().signal,request)).resolves.toEqual({google:false,email:true,signup:true});
  expect(String(request.mock.calls[0][0])).toBe('https://example.supabase.co/auth/v1/settings');
  expect(request.mock.calls[0][1]).toMatchObject({credentials:'omit',cache:'no-store',headers:{apikey:'public-fixture'}});
  await expect(loadAuthMethods('https://example.supabase.co','fixture',new AbortController().signal,async()=>new Response('',{status:503}))).rejects.toThrow('auth_settings_unavailable');
 });
});
describe('authentication callback recovery',()=>{
 it('preserves only a safe issue and fixed same-origin destination, never untrusted descriptions or redirect targets',()=>{
  const result=inspectAuthReturn('https://ncg.example/auth/callback?next=https://evil.example/#error=access_denied&error_code=otp_expired&error_description=SECRET');
  expect(result).toEqual({active:true,hasCode:false,issue:'expired',destination:'/#/profile'});
  expect(JSON.stringify(result)).not.toContain('SECRET');
  expect(inspectAuthReturn('https://ncg.example/admin.html?code=private')).toEqual({active:true,hasCode:true,issue:null,destination:'/admin.html'});
 });
 it('detects links opened without this browser verifier even when the SDK returns no error',()=>{
  const url='https://ncg.example/auth/callback?code=private',returned=inspectAuthReturn(url);
  expect(resolveAuthReturnIssue(returned,null,url)).toBe('browser');
  expect(resolveAuthReturnIssue(returned,null,'https://ncg.example/auth/callback')).toBeNull();
  expect(resolveAuthReturnIssue(returned,{code:'flow_state_expired'},url)).toBe('expired');
 });
 it('handles cancellation, provider errors, expiry and SDK nested errors without exposing raw errors',()=>{
  expect(inspectAuthReturn('https://ncg.example/#error=access_denied').issue).toBe('cancelled');
  expect(authIssueFromError({details:{code:'otp_expired'}})).toBe('expired');
  expect(authIssueFromError({code:'bad_code_verifier'})).toBe('browser');
  expect(authIssueFromError({status:503})).toBe('unavailable');
  expect(authIssueFromError(new Error('untrusted secret'))).toBe('invalid');
 });
 it('does not mistake app routes or normal admin visits for an auth return',()=>{
  expect(inspectAuthReturn('https://ncg.example/#/bible?passage=JHN.3').active).toBe(false);
  expect(inspectAuthReturn('https://ncg.example/admin.html').active).toBe(false);
  expect(inspectAuthReturn('https://ncg.example/other?error=access_denied').active).toBe(false);
 });
});
