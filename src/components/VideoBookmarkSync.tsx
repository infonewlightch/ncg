import {useEffect,useState} from 'react';
import {supabase,useAuth} from '../auth';
import {useApp} from '../state';
import {progressDelta} from '../core/progress';
import {acknowledgeVideoBookmarks,cloudVideoIds,pullVideoBookmarks,readVideoIds} from '../core/video-bookmarks';

export function VideoBookmarkSync(){
 const {session}=useAuth();const {state,update,setVideoBookmarkStatus}=useApp();
 const [ready,setReady]=useState(false),[retry,setRetry]=useState(0);const pending=state.videoSync.pending;
 useEffect(()=>{
  if(!session)return;const refresh=()=>{if(document.visibilityState==='visible')setRetry(n=>n+1);};
  window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);const timer=setInterval(refresh,60000);
  return()=>{clearInterval(timer);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[session?.user.id]);
 useEffect(()=>{
  if(!supabase||!session)return;const controller=new AbortController();
  Promise.resolve(supabase.from('ncg_video_bookmarks').select('items,revision').eq('user_id',session.user.id).abortSignal(controller.signal).maybeSingle()).then(({data,error})=>{
   if(controller.signal.aborted)return;if(error){setVideoBookmarkStatus('error');return;}
   update(s=>({...s,...pullVideoBookmarks(readVideoIds(data?.items),s,Number(data?.revision||0))}));setReady(true);setVideoBookmarkStatus('synced');
  }).catch(()=>{if(!controller.signal.aborted)setVideoBookmarkStatus('error');});return()=>controller.abort();
 },[session?.user.id,retry]);
 useEffect(()=>{
  if(!ready||!session||pending)return;
  const timer=setTimeout(()=>update(s=>{
   if(s.videoSync.pending)return s;const current=cloudVideoIds(s.bookmarks,s.videos),delta=progressDelta(s.videoSync.baseline,current);if(!delta.added.length&&!delta.removed.length)return s;
   return {...s,videoSync:{...s.videoSync,pending:{...delta,id:crypto.randomUUID(),sent:current}}};
  }),600);return()=>clearTimeout(timer);
 },[ready,session?.user.id,state.bookmarks,state.videos,state.videoSync.baseline,pending?.id]);
 useEffect(()=>{
  if(!ready||!supabase||!session||!pending)return;const controller=new AbortController();setVideoBookmarkStatus('waiting');
  Promise.resolve(supabase.rpc('ncg_update_video_bookmarks',{operation_id:pending.id,added:pending.added,removed:pending.removed}).abortSignal(controller.signal)).then(({data,error})=>{
   if(controller.signal.aborted)return;if(error||!Array.isArray(data?.items)){
    if(error?.message==='bookmark_limit'){update(s=>s.videoSync.pending?.id===pending.id?{...s,videoSync:{...s.videoSync,pending:null}}:s);setReady(false);}
    setVideoBookmarkStatus('error');return;
   }
   update(s=>s.videoSync.pending?.id===pending.id?{...s,...acknowledgeVideoBookmarks(readVideoIds(data.items),s,pending,Number(data.revision||0))}:s);setVideoBookmarkStatus('synced');
  }).catch(()=>{if(!controller.signal.aborted)setVideoBookmarkStatus('error');});return()=>controller.abort();
 },[ready,session?.user.id,pending?.id,retry]);
 return null;
}
export function VideoBookmarkStatus(){
 const {session}=useAuth();const {state,videoBookmarkStatus,t}=useApp();
 const delta=progressDelta(state.videoSync.baseline,cloudVideoIds(state.bookmarks,state.videos));
 const waiting=videoBookmarkStatus==='waiting'||state.videoSync.pending||delta.added.length||delta.removed.length;
 return <div className="tiny muted"><p role="status">{!session?t('영상 책갈피는 이 기기에 저장됩니다. 로그인 후 마이페이지에서 가져올 수 있습니다.','Video bookmarks are saved on this device. Sign in and import them from My page.'):videoBookmarkStatus==='error'?t('영상 책갈피 동기화가 지연되고 있습니다. 기기에 보관하고 다시 연결되면 재시도합니다.','Video bookmark sync is delayed. Changes stay on this device and are retried when connected.'):waiting?t('교회 영상 책갈피를 계정에 저장하는 중입니다.','Saving church video bookmarks to your account.'):t('교회 영상 책갈피가 계정에 저장되었습니다.','Church video bookmarks are saved to your account.')}</p><p>{t('직접 등록한 영상과 해당 책갈피는 이 기기에만 보관됩니다. 교회가 비공개로 전환한 영상은 목록에 나타나지 않습니다.','Personally added videos and their bookmarks stay on this device. Church videos made private will not appear in the list.')}</p></div>;
}
