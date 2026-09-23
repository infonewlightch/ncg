import {useEffect,useState} from 'react';
import {supabase,useAuth} from '../auth';
import {useApp} from '../state';
import {acknowledgeBookmarks,bookmarkDelta,pullBookmarks,readBookmarks} from '../core/bible-bookmarks';

export function BibleBookmarkSync(){
 const {session}=useAuth();const {state,update,setBookmarkStatus}=useApp();
 const [ready,setReady]=useState(false),[retry,setRetry]=useState(0);
 const pending=state.bibleSync.pending;
 useEffect(()=>{
  if(!session)return;
  const refresh=()=>{if(document.visibilityState==='visible')setRetry(n=>n+1);};
  window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);
  const timer=setInterval(refresh,60000);
  return()=>{clearInterval(timer);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[session?.user.id]);
 useEffect(()=>{
  if(!supabase||!session)return;const controller=new AbortController();
  Promise.resolve(supabase.from('ncg_bible_bookmarks').select('items,revision').eq('user_id',session.user.id).abortSignal(controller.signal).maybeSingle()).then(({data,error})=>{
   if(controller.signal.aborted)return;if(error){setBookmarkStatus('error');return;}
   update(s=>({...s,...pullBookmarks(readBookmarks(data?.items),s.bibleBookmarks,s.bibleSync,Number(data?.revision||0))}));
   setReady(true);setBookmarkStatus('synced');
  }).catch(()=>{if(!controller.signal.aborted)setBookmarkStatus('error');});
  return()=>controller.abort();
 },[session?.user.id,retry]);
 useEffect(()=>{
  if(!ready||!session||pending)return;
  const delta=bookmarkDelta(state.bibleSync.baseline,state.bibleBookmarks);if(!delta.added.length&&!delta.removed.length)return;
  const timer=setTimeout(()=>update(s=>{
   if(s.bibleSync.pending)return s;const changes=bookmarkDelta(s.bibleSync.baseline,s.bibleBookmarks);if(!changes.added.length&&!changes.removed.length)return s;
   return {...s,bibleSync:{...s.bibleSync,pending:{...changes,id:crypto.randomUUID(),sent:[...s.bibleBookmarks]}}};
  }),500);return()=>clearTimeout(timer);
 },[ready,session?.user.id,state.bibleBookmarks,state.bibleSync.baseline,pending?.id]);
 useEffect(()=>{
  if(!ready||!supabase||!session||!pending)return;const controller=new AbortController();setBookmarkStatus('waiting');
  Promise.resolve(supabase.rpc('ncg_update_bible_bookmarks',{operation_id:pending.id,added:pending.added,removed:pending.removed}).abortSignal(controller.signal)).then(({data,error})=>{
   if(controller.signal.aborted)return;if(error||!Array.isArray(data?.items)){
    if(error?.message==='bookmark_limit'){
     // A definite server rollback permits a new operation after local removals.
     update(s=>s.bibleSync.pending?.id===pending.id?{...s,bibleSync:{...s.bibleSync,pending:null}}:s);setReady(false);
    }
    setBookmarkStatus('error');return;
   }
   update(s=>s.bibleSync.pending?.id===pending.id?{...s,...acknowledgeBookmarks(readBookmarks(data.items),s.bibleBookmarks,pending,Number(data.revision||0))}:s);setBookmarkStatus('synced');
  }).catch(()=>{if(!controller.signal.aborted)setBookmarkStatus('error');});
  return()=>controller.abort();
 },[ready,session?.user.id,pending?.id,retry]);
 return null;
}
