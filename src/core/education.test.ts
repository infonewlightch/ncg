import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {educationMessages,educationRevision} from './education-content';
const question={id:'q1',book:'창세기',testament:'old',level:'easy',lang:'en',question:'Who created the world?',options:['God','People','Angels','Nobody'],answer:0,hint:'The Creator.',explanation:'God created the world.'};
const unit={id:'quiz:q1',kind:'quiz' as const,data:question};
const translated={id:unit.id,messages:Object.fromEntries(Object.entries(educationMessages('quiz',question)).map(([key,text])=>[key,'译 '+text]))};
const result=(language='zh',units=[translated])=>({language,revision:educationRevision,reviewed:false,complete:true,units});
beforeEach(()=>{vi.resetModules();vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{},removeItem:()=>{}});});
afterEach(()=>{vi.unstubAllGlobals();});
it('uses prepared content without a model request and preserves answer metadata',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json(result()));vi.stubGlobal('fetch',fetcher);
 const {loadEducationUnits}=await import('./education');const value=await loadEducationUnits('zh',[unit]);
 expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][0]).toContain('/education/');
 expect(value.get(unit.id)).toMatchObject({id:'q1',book:'창세기',answer:0,options:['译 God','译 People','译 Angels','译 Nobody']});
 expect(question.question).toBe('Who created the world?');
 await loadEducationUnits('zh',[unit]);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('rejects a different response language instead of disguising English as Chinese',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response('',{status:404})).mockResolvedValueOnce(Response.json({...result(),complete:false,units:[]})).mockResolvedValueOnce(Response.json(result('en'))));
 const {loadEducationUnits}=await import('./education');await expect(loadEducationUnits('zh',[unit])).rejects.toMatchObject({code:'invalid_translation'});
});
it('does not cache a partial question and allows a fresh retry',async()=>{
 const broken={...translated,messages:{question:'问题'}};
 const fetcher=vi.fn().mockResolvedValueOnce(new Response('',{status:404})).mockResolvedValueOnce(Response.json({...result(),complete:false,units:[]})).mockResolvedValueOnce(Response.json(result('zh',[broken]))).mockResolvedValueOnce(Response.json(result()));vi.stubGlobal('fetch',fetcher);
 const {loadEducationUnits}=await import('./education');await expect(loadEducationUnits('zh',[unit])).rejects.toMatchObject({code:'invalid_translation'});
 expect((await loadEducationUnits('zh',[unit])).get(unit.id).answer).toBe(0);expect(fetcher).toHaveBeenCalledTimes(4);
});
it('propagates unavailable languages and budget errors without silently falling back',async()=>{
 for(const code of ['unsupported_language','translation_daily_limit']){
  vi.resetModules();vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response('',{status:404})).mockResolvedValueOnce(Response.json({...result(),complete:false,units:[]})).mockResolvedValueOnce(Response.json({error:code},{status:429})));
  const {loadEducationUnits}=await import('./education');await expect(loadEducationUnits('zh',[unit])).rejects.toMatchObject({code});
 }
});
it('ignores a translated pack arriving after navigation aborts',async()=>{
 let release!:(value:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{release=resolve;})));
 const {loadEducationUnits}=await import('./education');const controller=new AbortController();const pending=loadEducationUnits('zh',[unit],controller.signal);controller.abort();release(Response.json(result()));await expect(pending).rejects.toMatchObject({name:'AbortError'});
});
it('keeps script variants and uses RTL for Arabic and Persian',async()=>{
 const {educationLanguage,educationDirection}=await import('./education');
 expect(educationLanguage('zh-TW')).toBe('zh-Hant');expect(educationLanguage('zh-Latn')).toBe('zh-Latn');expect(educationLanguage('zh-Bopo')).toBe('zh-Bopo');expect(educationLanguage('zh-CN')).toBe('zh');expect(educationLanguage('fa-IR')).toBe('fa');expect(educationLanguage('tl')).toBe('fil');expect(educationDirection('ar')).toBe('rtl');expect(educationDirection('fa')).toBe('rtl');
});
it('stops sibling batches when one translation fails instead of spending on the rest',async()=>{
 let postCount=0,finishSibling!:(value:Response)=>void;
 const units=Array.from({length:16},(_,i)=>({...unit,id:`quiz:q${i}`,data:{...question,id:`q${i}`}}));
 vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{
  if(url.startsWith('/education/'))return new Response('',{status:404});
  if(options?.method!=='POST')return Response.json({...result(),complete:false,units:[]});
  postCount++;if(postCount===1)return Response.json({error:'translation_unavailable'},{status:502});
  return new Promise<Response>(resolve=>{finishSibling=resolve;});
 }));
 const {loadEducationUnits}=await import('./education');
 await expect(loadEducationUnits('zh',units)).rejects.toMatchObject({code:'translation_unavailable'});
 const pendingAtFailure=postCount;
 if(finishSibling)finishSibling(Response.json(result('zh',units.slice(5,10).map(item=>({...translated,id:item.id})))));
 await new Promise(resolve=>setTimeout(resolve,0));expect(postCount).toBe(pendingAtFailure);expect(postCount).toBeLessThanOrEqual(2);
});
