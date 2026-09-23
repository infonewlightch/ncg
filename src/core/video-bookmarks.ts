import type {AppState,Video} from './model';
import {acknowledgeProgress,pullProgress,type ProgressSync,type ProgressPending} from './progress';
import {uuidPattern} from './quiz-progress';

export const readVideoIds=(value:unknown):string[]=>Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==='string'&&uuidPattern.test(id)))]:[];
export function cloudVideoIds(bookmarks:string[],videos:Pick<Video,'id'>[]){
 const local=new Set(videos.map(v=>v.id));return readVideoIds(bookmarks.filter(id=>!local.has(id)));
}
function mergeLocal(ids:string[],bookmarks:string[],videos:Pick<Video,'id'>[]){
 const local=new Set(videos.map(v=>v.id));return [...new Set([...bookmarks.filter(id=>local.has(id)||!uuidPattern.test(id)),...ids])];
}
type Saved=Pick<AppState,'bookmarks'|'videos'|'videoSync'>;
export function pullVideoBookmarks(remote:string[],state:Saved,revision:number){
 const result=pullProgress(remote,cloudVideoIds(state.bookmarks,state.videos),state.videoSync,revision);
 return {bookmarks:mergeLocal(result.completed,state.bookmarks,state.videos),videoSync:result.progressSync};
}
export function acknowledgeVideoBookmarks(remote:string[],state:Saved,pending:ProgressPending,revision:number){
 const result=acknowledgeProgress(remote,cloudVideoIds(state.bookmarks,state.videos),pending,revision);
 return {bookmarks:mergeLocal(result.completed,state.bookmarks,state.videos),videoSync:result.progressSync};
}
export function readVideoSync(value:unknown):ProgressSync{
 const s=(value&&typeof value==='object'?value:{}) as Partial<ProgressSync>,p=s.pending;
 return {baseline:readVideoIds(s.baseline),revision:Number.isSafeInteger(s.revision)&&s.revision!>=0?s.revision!:0,pending:p&&typeof p.id==='string'&&uuidPattern.test(p.id)?{id:p.id,added:readVideoIds(p.added),removed:readVideoIds(p.removed),sent:readVideoIds(p.sent)}:null};
}
