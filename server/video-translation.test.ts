import {it,expect,vi} from 'vitest';
import {videoTranslation,type VideoTranslationStore} from './video-translation';
const id='00000000-0000-4000-8000-000000000001';
const env={VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'public-test',OPENAI_BASE_URL:'https://gateway.test/v1',OPENAI_API_KEY:'server-only-test'};
const request=(input:unknown={videoId:id,target:'en'})=>new Request('https://ncg.test/api/video-translation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
function fixture(){
 const data=new Map();const store:VideoTranslationStore={get:vi.fn(async key=>data.get(key)||null),set:vi.fn(async(key,value)=>{data.set(key,value);}),claim:vi.fn(async()=>true)};
 const source={id,title:'제목',description:'첫 줄\r\n둘째 줄\r\n\r\n새 문단',language:'ko'};
 const fetcher=vi.fn(async(url:any,options:any)=>String(url).includes('supabase')?Response.json([source]):Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({supported:true,lines:[{id:0,text:'Title'},{id:1,text:'First line'},{id:2,text:'Second line'},{id:4,text:'New paragraph'}]})}}]}));
 return {source,store,fetcher};
}
it('translates stored public video fields, reconstructs blank lines and caches by source content',async()=>{
 const x=fixture();const r=await videoTranslation(request(),env,x);expect(r.status).toBe(200);expect(await r.json()).toMatchObject({title:'Title',description:'First line\nSecond line\n\nNew paragraph',reviewed:false});
 expect(x.fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer public-test');
 const body=JSON.parse(x.fetcher.mock.calls[1][1].body);expect(JSON.parse(body.messages[1].content).map((v:any)=>v.id)).toEqual([0,1,2,4]);
 await videoTranslation(request(),env,x);expect(x.store.claim).toHaveBeenCalledTimes(1);expect(x.fetcher).toHaveBeenCalledTimes(3);
 x.source.title='새 제목';await videoTranslation(request(),env,x);expect(x.store.claim).toHaveBeenCalledTimes(2);
});
it('does not expose cached translations once a video is unpublished',async()=>{
 const x=fixture();await videoTranslation(request(),env,x);x.fetcher.mockResolvedValueOnce(Response.json([]));expect((await videoTranslation(request(),env,x)).status).toBe(404);expect(x.store.claim).toHaveBeenCalledTimes(1);
});
it('rejects arbitrary client text and cross-origin requests before spending provider quota',async()=>{
 const x=fixture();expect((await videoTranslation(request({videoId:id,target:'en',text:'Unapproved text'}),env,x)).status).toBe(400);
 const cross=request();cross.headers.set('Origin','https://evil.test');expect((await videoTranslation(cross,env,x)).status).toBe(403);expect(x.fetcher).not.toHaveBeenCalled();
});
it('rejects missing or reordered lines and does not cache incomplete output',async()=>{
 const x=fixture();x.fetcher.mockImplementationOnce(async()=>Response.json([x.source])).mockImplementationOnce(async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({supported:true,lines:[{id:0,text:'Title'}]})}}]}));
 expect((await videoTranslation(request(),env,x)).status).toBe(502);expect(x.store.set).not.toHaveBeenCalled();
});
it('enforces the daily budget without calling the model',async()=>{
 const x=fixture();x.store.claim=vi.fn(async()=>false);expect((await videoTranslation(request(),env,x)).status).toBe(429);expect(x.fetcher).toHaveBeenCalledTimes(1);
});
