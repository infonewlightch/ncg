import {useEffect,useRef,useState} from 'react';
import {supabase,useAuth} from '../auth';
import {useApp} from '../state';
import {progressDelta,pullProgress,acknowledgeProgress} from '../core/progress';

export function CloudSync(){
 const {session}=useAuth();const {state,update,t}=useApp();
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 const initialized=useRef(false),savedLanguage=useRef('');
 const pending=state.progressSync.pending;
 useEffect(()=>{
  if(!session)return;
  const refresh=()=>{if(document.visibilityState==='visible')setRetry(value=>value+1);};
  window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);
  const timer=setInterval(refresh,60000);
  return()=>{clearInterval(timer);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[session?.user.id]);
 useEffect(()=>{
  if(!supabase||!session)return;const controller=new AbortController();
  const first=!initialized.current;
  (async()=>{
   const [profile,progress]=await Promise.all([
    first?supabase!.from('ncg_profiles').select('display_name,nationality,language').eq('id',session.user.id).abortSignal(controller.signal).single():Promise.resolve(null),
    supabase!.from('ncg_progress').select('completed,revision').eq('user_id',session.user.id).abortSignal(controller.signal).maybeSingle()
   ]);
   if(controller.signal.aborted)return;if(profile?.error||progress.error)throw Error('sync_failed');
   const remote=progress.data?.completed||[];
   update(s=>({...s,...pullProgress(remote,s.completed,s.progressSync,Number(progress.data?.revision||0)),...(profile?.data?{profile:{name:profile.data.display_name,nationality:profile.data.nationality},language:profile.data.language}:{})}));
   if(profile?.data)savedLanguage.current=profile.data.language;
   initialized.current=true;setReady(true);setFailed(false);
  })().catch(()=>{if(!controller.signal.aborted)setFailed(true);});
  return()=>controller.abort();
 },[session?.user.id,retry]);
 useEffect(()=>{
  if(!ready||!session||pending)return;
  const delta=progressDelta(state.progressSync.baseline,state.completed);if(!delta.added.length&&!delta.removed.length)return;
  const timer=setTimeout(()=>update(s=>{
   if(s.progressSync.pending)return s;
   const changes=progressDelta(s.progressSync.baseline,s.completed);if(!changes.added.length&&!changes.removed.length)return s;
   return {...s,progressSync:{...s.progressSync,pending:{...changes,id:crypto.randomUUID(),sent:[...s.completed]}}};
  }),600);
  return()=>clearTimeout(timer);
 },[ready,session?.user.id,state.completed,state.progressSync.baseline,pending?.id]);
 useEffect(()=>{
  if(!ready||!session||!supabase||!pending)return;const controller=new AbortController();
  Promise.resolve(supabase.rpc('ncg_update_progress',{operation_id:pending.id,added:pending.added,removed:pending.removed}).abortSignal(controller.signal)).then(({data,error})=>{
   if(controller.signal.aborted)return;
   if(error||!Array.isArray(data?.completed)){setFailed(true);return;}
   update(s=>s.progressSync.pending?.id===pending.id?{...s,...acknowledgeProgress(data.completed,s.completed,pending,Number(data.revision||0))}:s);setFailed(false);
  }).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
  return()=>controller.abort();
 },[ready,session?.user.id,pending?.id,retry]);
 useEffect(()=>{
  if(!ready||!session||!supabase||savedLanguage.current===state.language)return;
  const language=state.language,controller=new AbortController();
  const timer=setTimeout(()=>{supabase!.from('ncg_profiles').update({language}).eq('id',session.user.id).abortSignal(controller.signal).then(({error})=>{if(controller.signal.aborted)return;if(error)setFailed(true);else savedLanguage.current=language;});},600);
  return()=>{clearTimeout(timer);controller.abort();};
 },[ready,session?.user.id,state.language,retry]);
 return failed?<div className="system-notice" role="status"><span>{t('계정 동기화가 지연되고 있습니다. 이 기기의 기록을 보관하고 연결되면 다시 시도합니다.','Account sync is delayed. Your work is kept on this device and retried when connected.')}</span><button className="text-link" onClick={()=>setRetry(value=>value+1)}>{t('다시 시도','Try again')}</button></div>:null;
}
