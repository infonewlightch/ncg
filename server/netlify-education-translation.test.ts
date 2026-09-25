import {beforeEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({getStore:vi.fn(),translation:vi.fn(),limit:vi.fn(),claim:vi.fn()}));
vi.mock('@netlify/blobs',()=>({getStore:mocks.getStore}));
vi.mock('./education-translation.ts',()=>({educationTranslation:mocks.translation}));
vi.mock('./interface-budget.ts',()=>({claimInterfaceBudget:mocks.claim}));
vi.mock('./netlify-request-limits.ts',()=>({netlifyRequestLimit:mocks.limit}));
import handler from '../netlify/functions/education-translation.mts';
beforeEach(()=>{vi.clearAllMocks();mocks.limit.mockReturnValue(null);mocks.claim.mockResolvedValue(true);});
it('stores education separately but claims the existing UI daily budget with strong consistency and ETags',async()=>{
 const content={get:vi.fn(),setJSON:vi.fn()},budget={getWithMetadata:vi.fn().mockResolvedValue({data:{used:25},etag:'current-etag'}),setJSON:vi.fn().mockResolvedValue({modified:true})};mocks.getStore.mockImplementation(options=>options.name==='education-translations'?content:budget);
 mocks.claim.mockImplementation(async store=>{expect(await store.getWithMetadata('budget/day')).toEqual({data:{used:25},etag:'current-etag'});await store.setJSON('budget/day',{used:26},{onlyIfMatch:'current-etag'});return true;});
 mocks.translation.mockImplementation(async(_request,_env,{store})=>{await store.get('content-key');await store.set('content-key',{id:'catalogue'});expect(await store.claim()).toBe(true);return Response.json({ok:true});});
 expect((await handler(new Request('https://example.test/api/education-translation'),{ip:'203.0.113.2'})).status).toBe(200);expect(mocks.getStore.mock.calls.map(([options])=>[options.name,options.consistency])).toEqual([['education-translations','strong'],['interface-translations','strong']]);expect(content.get).toHaveBeenCalledWith('content-key',{type:'json'});expect(budget.setJSON).toHaveBeenCalledWith('budget/day',{used:26},{onlyIfMatch:'current-etag'});
});
it('rejects throttled requests before source, cache or provider work',async()=>{mocks.limit.mockReturnValue(Response.json({error:'rate_limited'},{status:429}));expect((await handler(new Request('https://example.test/api/education-translation'))).status).toBe(429);expect(mocks.getStore).not.toHaveBeenCalled();expect(mocks.translation).not.toHaveBeenCalled();});
it('fails closed when the shared budget record has no ETag',async()=>{const budget={getWithMetadata:vi.fn().mockResolvedValue({data:{used:25}})};mocks.getStore.mockReturnValue(budget);mocks.claim.mockImplementation(store=>store.getWithMetadata('budget/day'));mocks.translation.mockImplementation(async(_request,_env,{store})=>{await expect(store.claim()).rejects.toThrow('budget_etag_missing');return Response.json({ok:true});});await handler(new Request('https://example.test/api/education-translation'));});
