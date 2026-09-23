import {describe,it,expect,vi,afterEach} from 'vitest';
import {Readable} from 'node:stream';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {translationHandler} from './translation';
import {invokeHandler} from './http-test-utils';

const fakeEnv={NCG_TRANSLATION_URL:'https://unused.invalid',NCG_TRANSLATION_KEY:'test-only',NCG_TRANSLATION_MODEL:'test'};
async function invoke(body:string,env:Record<string,string>={},headers:Record<string,string>={}){
 const req=Object.assign(Readable.from([body]),{method:'POST',headers:{host:'127.0.0.1:4310','content-type':'application/json',...headers}}) as IncomingMessage;
 let status=0;let result='';
 const res={writeHead(code:number){status=code;},end(s:string){result=s;}} as ServerResponse;
 await translationHandler(req,res,env);
 return {status,body:JSON.parse(result)};
}
describe('local translation boundary without external requests',()=>{
 it('reports missing provider without pretending a translation succeeded',async()=>expect((await invoke('{}')).status).toBe(503));
 it('rejects foreign origins',async()=>expect((await invoke('{}',fakeEnv,{origin:'https://foreign.example'})).status).toBe(403));
 it('requires JSON requests',async()=>expect((await invoke('{}',fakeEnv,{'content-type':'text/plain'})).status).toBe(415));
 it('handles null JSON safely',async()=>expect((await invoke('null',fakeEnv)).status).toBe(400));
 it('rejects malformed and oversized payloads',async()=>{expect((await invoke('{',fakeEnv)).status).toBe(400);expect((await invoke('x'.repeat(12001),fakeEnv)).status).toBe(413);});
 it('returns the original when source and target match',async()=>expect(await invoke(JSON.stringify({text:'Test',source:'en',target:'en'}),fakeEnv)).toEqual({status:200,body:{text:'Test',translated:false}}));
});
afterEach(()=>vi.unstubAllGlobals());
describe('provider translation integrity',()=>{
 it('preserves split UTF-8 input, confines private caches and prevents provider redirects',async()=>{
  const fetcher=vi.fn(async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'Peace be with you.'}}]}));vi.stubGlobal('fetch',fetcher);
  const payload=Buffer.from(JSON.stringify({text:'평안이 있기를 바랍니다.',source:'ko',target:'en'}));const split=payload.indexOf(Buffer.from('평'))+1;
  const request=(scope:string)=>invokeHandler((req,res)=>translationHandler(req,res,fakeEnv,{cacheScope:scope}),{method:'POST',headers:{'content-type':'application/json'},body:[payload.subarray(0,split),payload.subarray(split)]});
  expect((await request('member:one')).status).toBe(200);expect((await request('member:one')).status).toBe(200);expect(fetcher).toHaveBeenCalledTimes(1);
  await request('member:two');expect(fetcher).toHaveBeenCalledTimes(2);
  const args=fetcher.mock.calls[0] as unknown as [URL,RequestInit];expect(args[1].redirect).toBe('error');const sent=JSON.parse(String(args[1].body));expect(sent.messages[1].content).toBe('평안이 있기를 바랍니다.');expect(sent.max_tokens).toBe(4096);
 });
 it('never returns or caches partial output or unsupported language markers as a translation',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({choices:[{finish_reason:'length',message:{content:'Truncated sentence'}}]})).mockResolvedValueOnce(Response.json({choices:[{finish_reason:'stop',message:{content:'__UNSUPPORTED_LANGUAGE__'}}]}));vi.stubGlobal('fetch',fetcher);
  const request=()=>invokeHandler((req,res)=>translationHandler(req,res,fakeEnv,{cacheScope:'partial-output-test'}),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Original text.',source:'en',target:'th'})});
  const partial=await request();expect(partial.status).toBe(502);expect(partial.text).not.toContain('Truncated sentence');expect((await request()).status).toBe(422);expect(fetcher).toHaveBeenCalledTimes(2);
 });
});

describe('shared provider reservation',()=>{
 it('does not call a provider when quota is exhausted or unavailable',async()=>{
  const provider=vi.fn();vi.stubGlobal('fetch',provider);
  for(const claim of [vi.fn(async()=>false),vi.fn(async()=>{throw Error('secret database URL');})]){
   const r=await invokeHandler((req,res)=>translationHandler(req,res,fakeEnv,{body:{text:'Reserve before spending.',source:'en',target:'ko'},cacheScope:crypto.randomUUID(),claim}),{method:'POST',headers:{'content-type':'application/json'}});
   expect([429,503]).toContain(r.status);expect(r.text).not.toContain('secret database');expect(provider).not.toHaveBeenCalled();
  }
 });
 it('does not charge again for a cached result',async()=>{
  const provider=vi.fn(async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'함께 기도합니다.'}}]}));vi.stubGlobal('fetch',provider);const claim=vi.fn(async()=>true),scope=crypto.randomUUID();
  const call=()=>invokeHandler((req,res)=>translationHandler(req,res,fakeEnv,{body:{text:'Praying together.',source:'en',target:'ko'},cacheScope:scope,claim}),{method:'POST',headers:{'content-type':'application/json'}});
  expect((await call()).status).toBe(200);expect((await call()).status).toBe(200);expect(provider).toHaveBeenCalledTimes(1);expect(claim).toHaveBeenCalledTimes(1);
 });
});
