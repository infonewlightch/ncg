import {describe,it,expect,vi} from 'vitest';
import {Readable} from 'node:stream';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {bibleHandler} from './bible';
// Exercise the future licensed gateway with explicitly approved fixture IDs.
// The production empty allowlist is independently covered by bible-policy.test.ts.
vi.mock('../src/core/bible-policy.ts',async()=>{const actual=await vi.importActual<typeof import('../src/core/bible-policy.ts')>('../src/core/bible-policy.ts');return {...actual,approvedEdition:(provider:string,id:string)=>provider==='youversion'?['1','2'].includes(id):actual.approvedEdition(provider as 'ebible'|'getbible',id)};});

const env={NCG_YOUVERSION_APP_KEY:'test-server-key'};
async function invoke(url:string,options:{env?:Record<string,string>;fetcher?:typeof fetch;method?:string;origin?:string}={}){
 const req=Object.assign(Readable.from([]),{url,method:options.method||'GET',headers:{host:'localhost:4310',...(options.origin?{origin:options.origin}:{})}}) as IncomingMessage;
 let status=0;let body='';let headers:unknown;
 const res={writeHead(n:number,h:unknown){status=n;headers=h;},end(s:string){body=s;}} as ServerResponse;
 await bibleHandler(req,res,options.env||{},options.fetcher);
 return {status,body:JSON.parse(body),headers};
}
describe('licensed Bible provider gateway',()=>{
 it('reports unconfigured service without placeholder Scripture',async()=>{
  expect((await invoke('/versions?language=ko')).body).toEqual({error:'bible_not_configured'});
 });
 it('keeps the provider key on the server and follows licensed catalogue pages',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({data:[{id:1}],next_page_token:'next'})).mockResolvedValueOnce(Response.json({data:[{id:2}]}));
  const result=await invoke('/versions?language=ar',{env,fetcher});
  expect(result.body.data).toEqual([{id:1},{id:2}]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const [url,init]=fetcher.mock.calls[0];
  expect(new URL(url).searchParams.get('language_ranges[]')).toBe('ar');
  expect(new URL(url).searchParams.get('all_available')).toBe('false');
  expect(init.headers['X-YVP-App-Key']).toBe(env.NCG_YOUVERSION_APP_KEY);
  expect(JSON.stringify(result)).not.toContain(env.NCG_YOUVERSION_APP_KEY);
 });
 it('does not silently return a partial catalogue when later pages fail',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({data:[{id:1}],next_page_token:'next'})).mockResolvedValueOnce(new Response('',{status:503}));
  expect((await invoke('/versions?language=ko',{env,fetcher})).status).toBe(502);
 });
 it('rejects foreign origins, invalid references and non-GET methods',async()=>{
  const fetcher=vi.fn();
  expect((await invoke('/versions?language=ko',{env,fetcher,origin:'https://other.example'})).status).toBe(403);
  expect((await invoke('/passage?version=1&passage=../../secret',{env,fetcher})).status).toBe(400);
  expect((await invoke('/versions?language=ko',{env,fetcher,method:'POST'})).status).toBe(405);
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('requests provider text verbatim and does not cache licensed passage content',async()=>{
  const body={id:'JHN.3.16',content:'Provider passage text',reference:'John 3:16'};
  const fetcher=vi.fn().mockResolvedValue(Response.json(body));
  const result=await invoke('/passage?version=1&passage=JHN.3.16',{env,fetcher});
  expect(result.body).toEqual(body);
  expect(result.headers).toHaveProperty('Cache-Control','no-store');
  expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('format')).toBe('text');
 });
});
