import {useEffect,useState} from 'react';
import {supabase,useAuth} from '../auth';
import {useApp} from '../state';
import {acknowledgeQuiz,hasQuizDelta,pullQuiz,quizDelta,readQuiz} from '../core/quiz-progress';

export function QuizProgressSync(){
 const {session}=useAuth();const {state,update,setQuizStatus}=useApp();
 const [ready,setReady]=useState(false),[retry,setRetry]=useState(0);
 const pending=state.quizSync.pending;
 useEffect(()=>{
  if(!session)return;
  const refresh=()=>{if(document.visibilityState==='visible')setRetry(n=>n+1);};
  window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);
  const timer=setInterval(refresh,60000);
  return()=>{clearInterval(timer);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[session?.user.id]);
 useEffect(()=>{
  if(!supabase||!session)return;const controller=new AbortController();
  Promise.resolve(supabase.from('ncg_quiz_progress').select('answered,correct,rounds,best_score,best_streak,revision').eq('user_id',session.user.id).abortSignal(controller.signal).maybeSingle()).then(({data,error})=>{
   if(controller.signal.aborted)return;if(error){setQuizStatus('error');return;}
   const remote=readQuiz(data?{...data,bestScore:data.best_score,bestStreak:data.best_streak}:null);
   update(s=>({...s,...pullQuiz(remote,s.quiz,s.quizSync,Number(data?.revision||0))}));setReady(true);setQuizStatus('synced');
  }).catch(()=>{if(!controller.signal.aborted)setQuizStatus('error');});
  return()=>controller.abort();
 },[session?.user.id,retry]);
 useEffect(()=>{
  if(!ready||!session||pending||!hasQuizDelta(quizDelta(state.quizSync.baseline,state.quiz)))return;
  const timer=setTimeout(()=>update(s=>{
   if(s.quizSync.pending)return s;const delta=quizDelta(s.quizSync.baseline,s.quiz);if(!hasQuizDelta(delta))return s;
   return {...s,quizSync:{...s.quizSync,pending:{id:crypto.randomUUID(),delta,sent:{...s.quiz}}}};
  }),800);return()=>clearTimeout(timer);
 },[ready,session?.user.id,state.quiz,state.quizSync.baseline,pending?.id]);
 useEffect(()=>{
  if(!ready||!supabase||!session||!pending)return;const controller=new AbortController();setQuizStatus('waiting');
  Promise.resolve(supabase.rpc('ncg_update_quiz_progress',{operation_id:pending.id,delta:pending.delta}).abortSignal(controller.signal)).then(({data,error})=>{
   if(controller.signal.aborted)return;if(error||!data||typeof data.answered!=='number'){setQuizStatus('error');return;}
   const remote=readQuiz({...data,bestScore:data.best_score,bestStreak:data.best_streak});
   update(s=>s.quizSync.pending?.id===pending.id?{...s,...acknowledgeQuiz(remote,s.quiz,pending,Number(data.revision||0))}:s);setQuizStatus('synced');
  }).catch(()=>{if(!controller.signal.aborted)setQuizStatus('error');});
  return()=>controller.abort();
 },[ready,session?.user.id,pending?.id,retry]);
 return null;
}

export function QuizSaveStatus(){
 const {session}=useAuth();const {state,quizStatus,t}=useApp();
 const waiting=quizStatus==='waiting'||Boolean(state.quizSync.pending)||hasQuizDelta(quizDelta(state.quizSync.baseline,state.quiz));
 return <p className="tiny muted" role="status">{!session?t('퀴즈 기록은 이 기기에 저장됩니다. 로그인 후 마이페이지에서 가져올 수 있습니다.','Quiz progress is saved on this device. Sign in and import it from My page.'):quizStatus==='error'?t('퀴즈 동기화가 지연되고 있습니다. 기기에 보관하고 다시 연결되면 재시도합니다.','Quiz sync is delayed. Progress is kept on this device and retried when connected.'):waiting?t('퀴즈 기록을 계정에 저장하는 중입니다.','Saving quiz progress to your account.'):t('퀴즈 기록이 계정에 저장되었습니다.','Quiz progress is saved to your account.')}</p>;
}
