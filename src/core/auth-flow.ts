export type AuthMethods={google:boolean;email:boolean;signup:boolean};
export type AuthIssue='cancelled'|'expired'|'browser'|'unavailable'|'invalid';
export type AuthReturn={active:boolean;hasCode:boolean;issue:AuthIssue|null;destination:string};
export function parseAuthMethods(value:unknown):AuthMethods{
 if(!value||typeof value!=='object')throw Error('invalid_auth_settings');
 const data=value as {external?:Record<string,unknown>;disable_signup?:unknown};
 if(!data.external||typeof data.external.email!=='boolean'||typeof data.external.google!=='boolean'||typeof data.disable_signup!=='boolean')throw Error('invalid_auth_settings');
 return {google:data.external.google,email:data.external.email,signup:!data.disable_signup};
}
export async function loadAuthMethods(endpoint:string,key:string,signal:AbortSignal,request:typeof fetch=fetch){
 const response=await request(new URL('/auth/v1/settings',endpoint),{headers:{apikey:key},credentials:'omit',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});
 if(!response.ok)throw Error('auth_settings_unavailable');
 return parseAuthMethods(await response.json());
}
export function authIssueFromError(error:unknown):AuthIssue{
 const e=error&&typeof error==='object'?error as {code?:unknown;status?:unknown;details?:{code?:unknown}}:{};
 const code=String(e.code||e.details?.code||'');
 if(code==='otp_expired'||code==='flow_state_expired')return 'expired';
 if(code==='access_denied')return 'cancelled';
 if(['bad_code_verifier','flow_state_not_found','pkce_verifier_not_found'].includes(code))return 'browser';
 if(e.status===0||typeof e.status==='number'&&e.status>=500)return 'unavailable';
 return 'invalid';
}
export function inspectAuthReturn(href:string):AuthReturn{
 const url=new URL(href);const destination=url.pathname==='/admin.html'?'/admin.html':'/#/profile';
 if(!['/','/auth/callback','/admin.html'].includes(url.pathname))return {active:false,hasCode:false,issue:null,destination};
 const query=url.searchParams,hash=new URLSearchParams(url.hash.slice(1));
 const get=(key:string)=>query.get(key)||hash.get(key);
 const hasCode=Boolean(query.get('code'));
 const hasError=Boolean(get('error')||get('error_code')||get('error_description'));
 return {active:url.pathname==='/auth/callback'||hasCode||hasError||Boolean(get('access_token')),hasCode,issue:hasError?authIssueFromError({code:get('error_code')||get('error')}):null,destination};
}
export function resolveAuthReturnIssue(returned:AuthReturn,initializationError:unknown,currentHref:string):AuthIssue|null{
 if(returned.issue)return returned.issue;
 if(initializationError)return authIssueFromError(initializationError);
 // Without this browser's PKCE verifier the SDK deliberately skips the code exchange.
 if(returned.hasCode&&new URL(currentHref).searchParams.has('code'))return 'browser';
 return null;
}
