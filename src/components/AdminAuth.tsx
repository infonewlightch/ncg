import {useRef,useState,type FormEvent} from 'react';
import {supabase,useAuth} from '../auth';

/** Authentication never grants administration; the admin entry checks its server role separately. */
export function AdminLogin(){
 const {configured,clearIssue}=useAuth();const [email,setEmail]=useState('');const [password,setPassword]=useState('');
 const [reset,setReset]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');const locked=useRef(false);
 async function submit(e:FormEvent){
  e.preventDefault();if(!supabase||locked.current)return;locked.current=true;setBusy(true);setError('');setNotice('');clearIssue();
  try{
   const result=reset?await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:new URL('/admin.html',location.origin).href}):await supabase.auth.signInWithPassword({email:email.trim(),password});
   if(result.error)throw result.error;
   setPassword('');if(reset)setNotice('등록된 계정이라면 비밀번호 설정 메일이 발송됩니다. 이 브라우저에서 메일의 링크를 열어주세요.');
  }catch{setError(reset?'메일을 보내지 못했습니다. 주소를 확인하고 잠시 후 다시 시도해주세요.':'이메일 또는 비밀번호를 확인해주세요. 비밀번호가 없다면 아래에서 처음 설정할 수 있습니다.');}
  finally{locked.current=false;setBusy(false);}
 }
 return <section className="panel admin-login"><span className="eyebrow">NCG ADMIN</span><h2>{reset?'비밀번호 설정 · 재설정':'관리자 로그인'}</h2><p className="muted">{reset?'이메일로 본인 확인 후 비밀번호를 설정합니다.':'등록된 관리자 계정의 이메일과 비밀번호를 입력하세요.'}</p><form className="form-stack" onSubmit={submit}><label>이메일 주소<input type="email" autoComplete="username" required maxLength={254} value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label>{!reset&&<label>비밀번호<input type="password" autoComplete="current-password" required maxLength={128} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label>}<button className="button" disabled={!configured||busy}>{busy?'처리 중…':reset?'비밀번호 설정 메일 보내기':'로그인'}</button></form><button className="text-link" disabled={busy} onClick={()=>{setReset(!reset);setPassword('');setError('');setNotice('');}}>{reset?'이메일·비밀번호로 로그인':'비밀번호를 잊었거나 처음 설정하시나요?'}</button>{notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}</section>;
}
export function AdminPassword({onDone}:{onDone:()=>void}){
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);const locked=useRef(false);
 async function save(e:FormEvent){e.preventDefault();if(!supabase||locked.current)return;setError('');if(password.length<8||password.length>128||password!==confirm){setError('8자 이상인 비밀번호를 두 칸에 동일하게 입력해주세요.');return;}locked.current=true;setBusy(true);try{const {error}=await supabase.auth.updateUser({password});if(error)throw error;setPassword('');setConfirm('');setSaved(true);}catch{setError('비밀번호를 저장하지 못했습니다. 인증이 만료되었다면 설정 메일을 다시 요청해주세요.');}finally{locked.current=false;setBusy(false);}}
 return <section className="panel admin-login"><h2>관리자 비밀번호 설정</h2>{saved?<><p role="status">비밀번호를 저장했습니다. 다음부터 이메일과 비밀번호로 로그인할 수 있습니다.</p><button className="button" onClick={onDone}>운영 화면으로</button></>:<form className="form-stack" onSubmit={save}><label>새 비밀번호<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label><label>새 비밀번호 확인<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirm} disabled={busy} onChange={e=>setConfirm(e.target.value)}/></label><p className="tiny muted">비밀번호는 이 화면에 직접 입력하세요. 대화로 보내지 마세요.</p><div className="button-row"><button className="button" disabled={busy}>{busy?'저장 중…':'비밀번호 저장'}</button><button className="button secondary" type="button" disabled={busy} onClick={onDone}>취소</button></div>{error&&<p className="error" role="alert">{error}</p>}</form>}</section>;
}
