import {useEffect,useRef,useState} from 'react';
import {fetchVideos,type VideoFilter} from '../core/videos';
import type {Video} from '../core/model';
export function useVideos(filter:VideoFilter={}){
 const [videos,setVideos]=useState<Video[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false),[hasMore,setHasMore]=useState(false),[retry,setRetry]=useState(0);
 const signature=JSON.stringify(filter);const extra=useRef<AbortController|null>(null);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError(false);setVideos([]);setHasMore(false);
  const timer=setTimeout(()=>{fetchVideos(filter,undefined,controller.signal).then(result=>{if(controller.signal.aborted)return;setVideos(result.videos);setHasMore(result.hasMore);}).catch(()=>{if(!controller.signal.aborted)setError(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});},filter.query?250:0);
  return()=>{clearTimeout(timer);controller.abort();extra.current?.abort();};
 },[signature,retry]);
 async function more(){if(loading||!hasMore)return;setLoading(true);setError(false);const controller=new AbortController();extra.current=controller;try{const result=await fetchVideos(filter,videos.at(-1),controller.signal);if(controller.signal.aborted)return;setVideos(old=>[...old,...result.videos.filter(v=>!old.some(x=>x.id===v.id))]);setHasMore(result.hasMore);}catch{if(!controller.signal.aborted)setError(true);}finally{if(!controller.signal.aborted)setLoading(false);}}
 return {videos,loading,error,hasMore,more,refresh:()=>setRetry(n=>n+1)};
}
