import {describe,it,expect} from 'vitest';
import {bookmarkDelta,bookmarkKey,sameBookmarkLocation,applyBookmarkDelta,pullBookmarks,acknowledgeBookmarks,readBookmarks} from './bible-bookmarks';
import {initialState,readState} from './storage';
const one={version:'webp',passage:'JHN.3.16',reference:'John 3:16',language:'en'};
const two={...one,passage:'JHN.3.17',reference:'John 3:17'};
const three={...one,passage:'JHN.3.18',reference:'John 3:18'};
describe('private Bible bookmark reconciliation',()=>{
 it('recognizes legacy Nahum bookmarks while preserving their server removal keys',()=>{
  const legacy={...one,passage:'NAM.1.7',reference:'Nahum 1:7'};const current={...legacy,passage:'NAH.1.7'};
  expect(sameBookmarkLocation(legacy,current)).toBe(true);expect(sameBookmarkLocation(legacy,{...current,passage:'NAH.1.8'})).toBe(false);expect(sameBookmarkLocation(legacy,{...current,version:'eb-eng-asv'})).toBe(false);
  expect(bookmarkDelta([legacy],[]).removed).toEqual(['webp:NAM.1.7:en']);expect(readBookmarks([legacy])[0].passage).toBe('NAM.1.7');
 });
 it('keeps independent device additions while applying explicit removals',()=>{
  const delta=bookmarkDelta([one],[two]);expect(delta).toEqual({added:[two],removed:[bookmarkKey(one)]});
  expect(applyBookmarkDelta([one,three],delta)).toEqual([two,three]);
 });
 it('preserves changes made while a request was in flight',()=>{
  const pending={id:'00000000-0000-4000-8000-000000000001',added:[one],removed:[],sent:[one]};
  const sync={baseline:[],pending,revision:0};
  expect(pullBookmarks([one],[two],sync,1).bibleSync.pending).toEqual(pending);
  expect(acknowledgeBookmarks([one,three],[two],pending,2).bibleBookmarks).toEqual([two,three]);
  const saved=readState(JSON.stringify({...initialState,bibleBookmarks:[two],bibleSync:sync}));expect(saved.bibleSync).toEqual(sync);
 });
 it('ignores late pulls, keeps local deletions on reconnect and separates translated reading languages',()=>{
  const sync={baseline:[one],pending:null,revision:5};
  expect(pullBookmarks([one,three],[],sync,6).bibleBookmarks).toEqual([three]);
  expect(pullBookmarks([one,three],[],sync,4)).toEqual({bibleBookmarks:[],bibleSync:sync});
  expect(readBookmarks([one,{...one,language:'ga'}])).toHaveLength(2);
 });
 it('imports old device bookmarks only when the guest reader is explicitly supplied',()=>{
  const legacy=JSON.stringify({bookmarks:[one]});
  expect(readState(null,legacy).bibleBookmarks).toEqual([one]);
  expect(readState(null).bibleBookmarks).toEqual([]);
  const imported=readState(JSON.stringify({version:1}),legacy);
  expect(imported.bibleBookmarks).toEqual([one]);
  expect(readState(JSON.stringify({...imported,bibleBookmarks:[]}),legacy).bibleBookmarks).toEqual([]);
  // Account A's state is never a fallback for a new account B.
  expect(readState(JSON.stringify({...initialState,bibleBookmarks:[two]})).bibleBookmarks).toEqual([two]);
  expect(readState(null).bibleBookmarks).toEqual([]);
 });
 it('rejects malformed content, strips extra fields and never silently truncates a valid multi-device merge at 300',()=>{
  expect(readBookmarks([null,{...one,reference:'<script>bad</script>'},{...one,passage:'JHN.3.20-16'},{...one,version:'javascript:evil'}])).toEqual([]);
  expect(readBookmarks([{...one,secret:'not persisted'},one])).toEqual([one]);
  const many=Array.from({length:400},(_,i)=>({...one,passage:`PSA.1.${i+1}`}));expect(readBookmarks(many)).toHaveLength(400);
 });
});
