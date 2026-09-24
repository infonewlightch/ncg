import {useEffect,useRef,useState} from 'react';
import {Globe,RefreshCw} from 'lucide-react';
import {supabase,useAuth} from '../auth';
import {useApp} from '../state';
import {SharedPost} from './Sharing';
import type {Post} from '../core/model';
export type ServerPost=Post&{authorId:string;status:'pending'|'published'|'rejected';prayerCount:number;hasPrayed:boolean};
export function SharedFeed({topic,parent,category,mine=false,onCompose}:{topic?:string;parent?:string;category?:string;mine?:boolean;onCompose?:()=>void}){
 const {state,t}=useApp();const {session}=useAuth();const [posts,setPosts]=useState<ServerPost[]>([]);const [loading,setLoading]=useState(Boolean(supabase));const [error,setError]=useState(false);const [more,setMore]=useState(false);const [busy,setBusy]=useState(false);const [reload,setReload]=useState(0);const view=useRef<AbortController|null>(null),page=useRef<AbortController|null>(null);
 const scope=mine?'mine':topic?'qt':'community';const qtId=topic?.startsWith('qt:')?topic.slice(3):null;const canLoad=Boolean(supabase&&(!mine||session)&&(!qtId||/^[0-9a-f-]{36}$/.test(qtId)));
 const local=parent?[]:state.posts.filter(p=>(mine||topic?p.topic===topic||mine:!p.topic)&&(!category||category==='all'||p.category===category));
 useEffect(()=>{
  const c=new AbortController();view.current=c;page.current?.abort();page.current=null;setBusy(false);setPosts([]);setError(false);setMore(false);setLoading(canLoad);
  if(canLoad)Promise.resolve(supabase!.rpc(parent?'ncg_comments':'ncg_feed',parent?{parent}:{scope,qt_id:qtId,kind:category&&category!=='all'?category:null}).abortSignal(c.signal)).then(({data,error})=>{
   if(c.signal.aborted)return;setError(Boolean(error));setPosts(error?[]:data||[]);setMore(!error&&data?.length===30);setLoading(false);
  }).catch(()=>{if(!c.signal.aborted){setError(true);setLoading(false);}});
  return()=>{c.abort();page.current?.abort();};
 },[canLoad,scope,qtId,parent,category,reload,session?.user.id]);
 async function loadMore(){
  const current=view.current;if(!supabase||page.current||!posts.length||!current||current.signal.aborted)return;
  const c=new AbortController();page.current=c;setBusy(true);const last=posts.at(-1)!;
  try{
   const {data,error}=await supabase.rpc(parent?'ncg_comments':'ncg_feed',{...(parent?{parent}:{scope,qt_id:qtId,kind:category&&category!=='all'?category:null}),before_time:last.createdAt,before_id:last.id}).abortSignal(c.signal);
   if(c.signal.aborted||current.signal.aborted)return;if(error)throw error;
   setPosts(p=>[...p,...(data||[]).filter((item:ServerPost)=>!p.some(x=>x.id===item.id))]);setMore(data?.length===30);setError(false);
  }catch{if(!c.signal.aborted&&!current.signal.aborted)setError(true);}
  finally{if(page.current===c){page.current=null;setBusy(false);}}
 }
 return <div className="shared-feed">{canLoad&&<button className="text-link feed-refresh" disabled={loading} onClick={()=>setReload(n=>n+1)}><RefreshCw size={14}/>{t('나눔 새로고침','Refresh reflections')}</button>}{loading&&<p role="status" className="muted">{t('함께 나눈 이야기를 불러오는 중…','Loading shared reflections…')}</p>}{error&&<div className="callout" role="alert"><span>{t('나눔을 불러오지 못했습니다. 연결을 확인하고 다시 시도해주세요.','Unable to load reflections. Check your connection and try again.')}</span></div>}{posts.map(post=><SharedPost key={post.id} post={post} remote={post} comment={Boolean(parent)} onChanged={()=>setReload(n=>n+1)}/>)}{more&&<button className="button secondary" disabled={busy} onClick={()=>void loadMore()}>{busy?t('불러오는 중…','Loading…'):t('나눔 더 보기','More reflections')}</button>}{local.length>0&&<><p className="tiny muted">{t('이 기기에 저장한 나눔','Reflections saved on this device')}</p>{local.map(post=><SharedPost key={post.id} post={post}/>)}</>}{!loading&&!error&&!posts.length&&!local.length&&<div className="qt-empty"><Globe size={48} strokeWidth={1}/><h3>{parent?t('아직 댓글이 없습니다.','No comments yet.'):t('당신의 묵상으로 시작해요.','Begin with your reflection.')}</h3>{!parent&&<p>{t('말씀 안에서 만난 감사와 기도, 삶의 이야기를 나누어보세요.','Share your gratitude, prayers, and life in the Word.')}</p>}{onCompose&&<button className="text-link" onClick={onCompose}>{t('첫 나눔 남기기','Write a reflection')} →</button>}</div>}</div>;
}
