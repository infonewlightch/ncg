import {expect,it,vi} from 'vitest';
import {claimInterfaceBudget,type BudgetBlobs} from './interface-budget';
it('allows exactly the shared limit under simultaneous claims',async()=>{
 let used=0,etag=0;const blobs:BudgetBlobs={async getWithMetadata(){return etag?{data:{used},etag:String(etag)}:null;},async setJSON(_key,value,options){const matches='onlyIfNew' in options?!etag:options.onlyIfMatch===String(etag);if(!matches)return {modified:false};used=value.used;etag++;return {modified:true};}};
 const results=await Promise.all(Array.from({length:6},()=>claimInterfaceBudget(blobs,3)));expect(results.filter(Boolean)).toHaveLength(3);expect(used).toBe(3);
});
it('does not reset malformed or unavailable budget state',async()=>{const setJSON=vi.fn();await expect(claimInterfaceBudget({getWithMetadata:vi.fn().mockResolvedValue({data:{used:-1},etag:'bad'}),setJSON})).rejects.toThrow('invalid_budget');expect(setJSON).not.toHaveBeenCalled();});
