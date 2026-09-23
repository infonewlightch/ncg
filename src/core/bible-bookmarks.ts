export type BibleBookmark={version:string;passage:string;reference:string;language:string};
export type BookmarkDelta={added:BibleBookmark[];removed:string[]};
export type BookmarkPending=BookmarkDelta&{id:string;sent:BibleBookmark[]};
export type BookmarkSync={baseline:BibleBookmark[];pending:BookmarkPending|null;revision:number};
export type BookmarkStatus='waiting'|'synced'|'error';
export const bookmarkKey=(item:BibleBookmark)=>`${item.version}:${item.passage}:${item.language}`;
const version=/^(webp|ext-nkrv|eb-[a-zA-Z0-9_-]{1,60}|[1-9][0-9]{0,8})$/;
const passage=/^([A-Z0-9]{3})\.([1-9]\d{0,2})(?:\.([1-9]\d{0,2})(?:-([1-9]\d{0,2}))?)?$/;
export function readBookmarks(value:unknown):BibleBookmark[]{
 if(!Array.isArray(value))return [];
 const result=new Map<string,BibleBookmark>();
 for(const item of value){
  if(!item||typeof item!=='object'||typeof item.version!=='string'||!version.test(item.version)||typeof item.passage!=='string'||typeof item.reference!=='string'||!item.reference.trim()||item.reference.length>240||/[<>\u0000-\u001f]/.test(item.reference)||typeof item.language!=='string'||! /^[a-zA-Z0-9-]{2,40}$/.test(item.language))continue;
  const match=passage.exec(item.passage);if(!match||match[4]&&Number(match[4])<Number(match[3]))continue;
  const clean={version:item.version,passage:item.passage,reference:item.reference,language:item.language};result.set(bookmarkKey(clean),clean);
  if(result.size===5000)break;
 }
 return [...result.values()];
}
export function bookmarkDelta(baseline:BibleBookmark[],current:BibleBookmark[]):BookmarkDelta{
 const before=new Map(baseline.map(item=>[bookmarkKey(item),item])),after=new Map(current.map(item=>[bookmarkKey(item),item]));
 return {added:current.filter(item=>!before.has(bookmarkKey(item))||before.get(bookmarkKey(item))!.reference!==item.reference),removed:[...before.keys()].filter(key=>!after.has(key))};
}
export function applyBookmarkDelta(remote:BibleBookmark[],delta:BookmarkDelta){
 const added=new Map(delta.added.map(item=>[bookmarkKey(item),item])),removed=new Set(delta.removed);
 return [...added.values(),...remote.filter(item=>!removed.has(bookmarkKey(item))&&!added.has(bookmarkKey(item)))];
}
export function pullBookmarks(remote:BibleBookmark[],current:BibleBookmark[],sync:BookmarkSync,revision:number){
 if(sync.pending||revision<sync.revision)return {bibleBookmarks:current,bibleSync:sync};
 return {bibleBookmarks:applyBookmarkDelta(remote,bookmarkDelta(sync.baseline,current)),bibleSync:{baseline:remote,pending:null,revision}};
}
export function acknowledgeBookmarks(remote:BibleBookmark[],current:BibleBookmark[],pending:BookmarkPending,revision:number){
 return {bibleBookmarks:applyBookmarkDelta(remote,bookmarkDelta(pending.sent,current)),bibleSync:{baseline:remote,pending:null,revision}};
}
export function readBookmarkSync(value:unknown):BookmarkSync{
 const s=(value&&typeof value==='object'?value:{}) as Partial<BookmarkSync>;
 const pending=s.pending;
 return {baseline:readBookmarks(s.baseline),revision:Number.isSafeInteger(s.revision)&&s.revision!>=0?s.revision!:0,pending:pending&&typeof pending.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pending.id)&&Array.isArray(pending.removed)?{id:pending.id,added:readBookmarks(pending.added),removed:pending.removed.filter(key=>typeof key==='string'&&key.length<=160).slice(0,5000),sent:readBookmarks(pending.sent)}:null};
}
