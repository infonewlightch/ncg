import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowRight,Mail,ShieldCheck} from 'lucide-react';
import {getAuthMethods,supabase,useAuth} from '../auth';
import {useApp} from '../state';
import type {AuthMethods} from '../core/auth-flow';

export function AuthPanel(){
 const {t}=useApp();const {configured,loading,clearIssue}=useAuth();
 const [methods,setMethods]=useState<AuthMethods|null>(null),[methodsError,setMethodsError]=useState(false),[retry,setRetry]=useState(0);
 const [email,setEmail]=useState(''),[requestedEmail,setRequestedEmail]=useState(''),[token,setToken]=useState('');
 const [sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[signup,setSignup]=useState(false);
 const [resendAt,setResendAt]=useState(0),[now,setNow]=useState(Date.now());const locked=useRef(false),alive=useRef(true);
 const remaining=Math.max(0,Math.ceil((resendAt-now)/1000));
 const redirectTo=new URL(location.pathname==='/admin.html'?'/admin.html':'/auth/callback',location.origin).href;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(!configured)return;const controller=new AbortController();setMethods(null);setMethodsError(false);
  getAuthMethods(controller.signal).then(value=>{if(!controller.signal.aborted){setMethods(value);if(!value.signup)setSignup(false);}}).catch(()=>{if(!controller.signal.aborted)setMethodsError(true);});
  return()=>controller.abort();
 },[configured,retry]);
 useEffect(()=>{if(!resendAt)return;setNow(Date.now());const timer=setInterval(()=>{const time=Date.now();setNow(time);if(time>=resendAt)clearInterval(timer);},1000);return()=>clearInterval(timer);},[resendAt]);
 function start(){if(locked.current||loading)return false;locked.current=true;setBusy(true);setError('');clearIssue();return true;}
 function finish(){locked.current=false;if(alive.current)setBusy(false);}
 async function google(){
  if(!supabase||!methods?.google||!start())return;
  try{const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}});if(error)throw error;}
  catch{if(alive.current)setError(t('Google 로그인에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.','Could not connect to Google sign-in. Please try again.'));finish();}
 }
 async function requestEmail(){
  if(!supabase||!methods?.email||signup&&!methods.signup||Date.now()<resendAt||!start())return;
  const address=email.trim();
  try{
   const {error}=await supabase.auth.signInWithOtp({email:address,options:{shouldCreateUser:signup,emailRedirectTo:redirectTo}});if(error)throw error;
   if(alive.current){setRequestedEmail(address);setToken('');setSent(true);setNow(Date.now());setResendAt(Date.now()+60000);}
  }catch(problem){if(alive.current){
   const rateLimited=(problem as {status?:number})?.status===429;
   setError(rateLimited?t('요청이 많습니다. 잠시 기다린 뒤 다시 시도해주세요.','Too many requests. Please wait before trying again.'):t('인증 메일을 보내지 못했습니다. 이메일 주소와 가입 여부를 확인하거나 잠시 후 다시 시도해주세요.','Unable to send the email. Check your address or try again later.'));
   if(rateLimited){setNow(Date.now());setResendAt(Date.now()+60000);}
  }}finally{finish();}
 }
 async function verify(e:FormEvent){
  e.preventDefault();if(!supabase||!requestedEmail||!/^[0-9]{6,8}$/.test(token)||!start())return;
  try{const {error}=await supabase.auth.verifyOtp({email:requestedEmail,token:token.trim(),type:'email'});if(error)throw error;}
  catch{if(alive.current)setError(t('인증 코드가 올바르지 않거나 만료되었습니다.','The code is invalid or has expired.'));}finally{finish();}
 }
 function changeMode(value:boolean){if(locked.current)return;setSignup(value);setSent(false);setToken('');setError('');}
 return <section className="auth-card">
  <div className="auth-intro"><span className="eyebrow">{t('NCG에 오신 것을 환영합니다','WELCOME TO NCG')}</span><h2>{t('믿음의 여정을, 함께 이어가요.','Continue your journey, together.')}</h2><p>{t('내 묵상과 배움을 모으고, 세계의 친구들과 연결되세요.','Keep your reflections and learning together. Connect with friends around the world.')}</p><ShieldCheck size={30} strokeWidth={1.3}/><small>{t('말씀과 교육은 로그인 없이도 볼 수 있습니다.','Scripture and lessons are open without signing in.')}</small></div>
  <div className="auth-form">
   <div className="tabs"><button className={!signup?'active':''} disabled={busy} onClick={()=>changeMode(false)}>{t('로그인','Sign in')}</button><button className={signup?'active':''} disabled={busy||!methods?.signup} onClick={()=>changeMode(true)}>{t('회원가입','Join NCG')}</button></div>
   {!configured?<p className="callout" role="status">{t('회원 서비스를 준비하고 있습니다. 인증 서버 연결 후 Google·이메일로 이용할 수 있습니다.','Member services are being prepared. Google and email sign-in will be available after setup.')}</p>:methodsError?<div className="callout" role="alert"><p>{t('로그인 방법을 확인하지 못했습니다. 연결을 확인한 뒤 다시 시도해주세요.','Could not check available sign-in methods. Check your connection and try again.')}</p><button className="text-link" onClick={()=>setRetry(n=>n+1)}>{t('다시 시도','Try again')}</button></div>:!methods?<p className="muted" role="status">{t('로그인 방법을 확인하고 있습니다.','Checking available sign-in methods.')}</p>:null}
   {methods&&!methods.signup&&<p className="muted">{t('현재 새 회원가입은 잠시 중단되어 있습니다. 기존 계정은 로그인할 수 있습니다.','New registrations are temporarily closed. Existing members can still sign in.')}</p>}
   <button className="button google-button" disabled={!configured||loading||busy||!methods?.google} onClick={google} aria-describedby={methods&&!methods.google?'google-availability':undefined}><span aria-hidden="true" className="google-letter">G</span>{t('Google로 계속하기','Continue with Google')}</button>
   {methods&&!methods.google&&<p id="google-availability" className="auth-method-note">{t('Google 로그인은 준비 중입니다.','Google sign-in is being prepared.')}</p>}
   <div className="auth-divider"><span>{t('또는 이메일','or email')}</span></div>
   {methods&&!methods.email&&<p className="auth-method-note">{t('이메일 로그인은 준비 중입니다.','Email sign-in is being prepared.')}</p>}
   {!sent?<form className="form-stack" onSubmit={e=>{e.preventDefault();void requestEmail();}}>
    <label>{t('이메일 주소','Email address')}<input type="email" autoComplete="email" required maxLength={254} disabled={busy} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
    <button className="button" disabled={!configured||loading||busy||!methods?.email||remaining>0}>{busy?t('전송 중…','Sending…'):t('인증 메일 보내기','Send sign-in email')}<Mail size={17}/></button>
    <small className="muted">{t('메일로 본인을 확인합니다. 비밀번호를 만들지 않아도 됩니다.','Verify through your inbox. No password to remember.')}</small>
   </form>:<>
    <p role="status">{t('인증 메일이 발송되었다면 받은 편지함의 링크를 열어주세요. 인증 코드가 있는 경우 아래에 입력할 수 있습니다.','If an email was sent, open the link in your inbox. If it includes a code, you can enter it below.')}</p><p className="auth-email-address">{requestedEmail}</p>
    <p className="auth-method-note">{t('링크는 인증 메일을 요청한 브라우저에서 열어주세요.','Open the link in the browser where you requested the email.')}</p>
    <form className="form-stack" onSubmit={verify}><label>{t('이메일 인증 코드','Email verification code')}<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,8}" minLength={6} maxLength={8} disabled={busy} value={token} onChange={e=>setToken(e.target.value.replace(/\D/g,''))} required/></label><button className="button" disabled={busy||loading||token.length<6}>{t('인증하고 계속','Verify and continue')}<ArrowRight size={17}/></button></form>
    <div className="auth-email-actions"><button className="text-link" disabled={busy} onClick={()=>{setSent(false);setToken('');setError('');}}>{t('다른 이메일 사용','Use another email')}</button><button className="text-link" disabled={busy||remaining>0||!methods?.email} onClick={()=>void requestEmail()}>{t('인증 메일 다시 요청','Request another email')}</button></div>
   </>}
   {remaining>0&&<p className="auth-method-note">{t('다시 요청하기까지 {seconds}초','Request again in {seconds} seconds').replace('{seconds}',String(remaining))}</p>}
   {error&&<p className="error" role="alert">{error}</p>}
  </div>
 </section>;
}
