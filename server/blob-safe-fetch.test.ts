import{afterEach,it,expect,vi}from'vitest';
import{checkedBlobFetch}from'./blob-safe-fetch';
afterEach(()=>vi.unstubAllGlobals());
it.each([401,500,503])('rejects failed storage writes even if status %s includes an ETag',async(status)=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('failed',{status,headers:{etag:'error-page-etag'}})));
 await expect(checkedBlobFetch('https://storage.example/object',{method:'put'})).rejects.toThrow('translation_storage_unavailable');
});
it('preserves a precondition conflict for the caller to retry',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:412})));expect((await checkedBlobFetch('https://storage.example/object',{method:'PUT'})).status).toBe(412);
});
it('returns confirmed successful writes unchanged',async()=>{
 const response=new Response(null,{status:200,headers:{etag:'committed'}});vi.stubGlobal('fetch',vi.fn(async()=>response));expect(await checkedBlobFetch('https://storage.example/object',{method:'PUT'})).toBe(response);
});
