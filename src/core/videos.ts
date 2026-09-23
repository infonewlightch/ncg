import {supabase} from '../auth';
import {parseMedia} from './media';
import type {Video} from './model';
export type VideoFilter={category?:Video['category'];language?:string;query?:string;saved?:string[]};
export function videoFromRow(row:Record<string,unknown>):Video|null{
 if(typeof row.id!=='string'||typeof row.title!=='string'||typeof row.url!=='string'||!parseMedia(row.url)||typeof row.language!=='string'||!['sermon','worship'].includes(String(row.category)))return null;
 return {id:row.id,title:row.title,description:String(row.description||''),url:row.url,language:row.language,category:row.category as Video['category'],createdAt:String(row.created_at),publishedAt:String(row.published_at),official:true,speaker:String(row.speaker||''),scripture:String(row.scripture||''),recordedOn:typeof row.recorded_on==='string'?row.recorded_on:undefined};
}
export async function fetchVideos(filter:VideoFilter={},cursor?:Video,signal?:AbortSignal){
 if(!supabase)return {videos:[],hasMore:false};
 const saved=filter.saved?.filter(id=>/^[0-9a-f-]{36}$/i.test(id));
 if(saved&&!saved.length)return {videos:[],hasMore:false};
 if(saved&&saved.length>100){
  const pages:Video[]=[];for(let start=0;start<saved.length;start+=100){let next:Video|undefined;do{const result=await fetchVideos({...filter,saved:saved.slice(start,start+100)},next,signal);pages.push(...result.videos);next=result.hasMore?result.videos.at(-1):undefined;}while(next);}
  return {videos:pages,hasMore:false};
 }
 let request=supabase.rpc('ncg_video_feed',{kind:filter.category||null,source_language:filter.language||null,query:filter.query||'',before_time:cursor?.publishedAt||null,before_id:cursor?.id||null,saved:saved||null});
 if(signal)request=request.abortSignal(signal);
 const {data,error}=await request;if(error)throw Error('video_library_unavailable');
 const videos=(data||[]).map(videoFromRow).filter((v:Video|null):v is Video=>Boolean(v));return {videos:videos as Video[],hasMore:(data||[]).length===24};
}
