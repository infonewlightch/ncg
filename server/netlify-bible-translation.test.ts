import {beforeEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({read:vi.fn(),write:vi.fn()}));
vi.mock('@netlify/blobs',()=>({getStore:()=>({getWithMetadata:mocks.read,setJSON:mocks.write})}));
vi.mock('./bible-translation.ts',()=>({bibleTranslation:async(_request:Request,_env:unknown,{store}:any)=>Response.json({claimed:await store.claim()})}));
import handler from '../netlify/functions/bible-translation.mts';
const call=()=>handler(new Request('https://example.test/api/bible-translation'));
beforeEach(()=>{vi.resetAllMocks();mocks.read.mockResolvedValue(null);mocks.write.mockResolvedValue({modified:true,etag:'verified-write'});});
it('requires a verified write before granting an AI request',async()=>{
 mocks.write.mockResolvedValue({modified:true,etag:''});await expect(call()).rejects.toThrow();
});
it.each([-1,null,'12'])('rejects corrupt persisted usage %s without resetting the budget',async(used)=>{
 mocks.read.mockResolvedValue({data:{used},etag:'prior'});await expect(call()).rejects.toThrow();expect(mocks.write).not.toHaveBeenCalled();
});
it('fails closed if existing budget data has no comparison tag',async()=>{
 mocks.read.mockResolvedValue({data:{used:1},etag:''});await expect(call()).rejects.toThrow();expect(mocks.write).not.toHaveBeenCalled();
});
it('grants a new-day slot only after a conditional create succeeds',async()=>{
 expect(await (await call()).json()).toEqual({claimed:true});expect(mocks.write).toHaveBeenCalledWith(expect.stringMatching(/^budget\/\d{4}-\d{2}-\d{2}$/),{used:1},{onlyIfNew:true});
});
it('stops at the daily budget without writing or granting',async()=>{
 mocks.read.mockResolvedValue({data:{used:60},etag:'prior'});expect(await (await call()).json()).toEqual({claimed:false});expect(mocks.write).not.toHaveBeenCalled();
});
it('re-reads a conflicting claim and stops if the other instance took the last slot',async()=>{
 mocks.read.mockResolvedValueOnce({data:{used:59},etag:'before'}).mockResolvedValueOnce({data:{used:60},etag:'after'});mocks.write.mockResolvedValueOnce({modified:false});
 expect(await (await call()).json()).toEqual({claimed:false});expect(mocks.write).toHaveBeenCalledTimes(1);
});
