import {it,expect} from 'vitest';
import {acknowledgeVideoBookmarks,cloudVideoIds,pullVideoBookmarks,readVideoIds} from './video-bookmarks';
import {initialState,readState} from './storage';
const one='10000000-0000-4000-8000-000000000001',two='10000000-0000-4000-8000-000000000002',local='10000000-0000-4000-8000-000000000003';
const videos=[{id:local,title:'Private link',description:'',language:'ko',category:'sermon' as const,url:'https://example.com/personal.mp4',createdAt:'2026-09-24'}];
it('sends church references only, never local video IDs, names or private URLs',()=>{
 expect(cloudVideoIds([one,local,'legacy',two],videos)).toEqual([one,two]);
 expect(readVideoIds([one,one,null,'bad'])).toEqual([one]);
});
it('merges other-device saves with a local removal and preserves local video bookmarks',()=>{
 const state={...initialState,videos,bookmarks:[local,'legacy'],videoSync:{baseline:[one],pending:null,revision:1}};
 const result=pullVideoBookmarks([one,two],state,2);expect(result.bookmarks).toEqual([local,'legacy',two]);
 expect(pullVideoBookmarks([one,two],state,0).bookmarks).toEqual(state.bookmarks);
});
it('keeps in-flight removals and preserves the operation ID over reload',()=>{
 const pending={id:local,added:[one],removed:[],sent:[one]};
 const state={...initialState,videos,bookmarks:[local],videoSync:{baseline:[],pending,revision:0}};
 expect(pullVideoBookmarks([one],state,1).videoSync.pending).toEqual(pending);
 expect(acknowledgeVideoBookmarks([one,two],state,pending,2).bookmarks).toEqual([local,two]);
 expect(readState(JSON.stringify(state)).videoSync).toEqual(state.videoSync);expect(readState(null).bookmarks).toEqual([]);
});
it('does not truncate a merge above the server capacity before the server can report a limit',()=>{
 const ids=Array.from({length:5100},(_,i)=>`20000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
 const state=readState(JSON.stringify({...initialState,bookmarks:ids}));expect(cloudVideoIds(state.bookmarks,[])).toHaveLength(5100);
});
