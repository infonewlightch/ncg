import {expect,it,vi} from 'vitest';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {bibleSourceHandler} from './bible-source';
async function call(query:string,send:typeof fetch,method='GET',origin?:string){let status=0,body='';await bibleSourceHandler({url:'/?provider=getbible&'+query,method,headers:{host:'ncg.test',...(origin?{origin}:{})}} as IncomingMessage,{writeHead(s:number){status=s;},end(b:string){body=b;}} as unknown as ServerResponse,send);return {status,body:JSON.parse(body)};}
it('blocks unapproved editions, unsafe routes, origins and methods before requesting upstream',async()=>{
 const send=vi.fn();for(const query of ['version=unknown&resource=index','version=koreankjv&resource=index','version=asv&resource=passage&book=43&chapter=../1','version=asv&resource=book&book=0','version=asv&resource=https://evil.test'])expect((await call(query,send)).status).toBe(400);
 expect((await call('version=asv&resource=index',send,'POST')).status).toBe(405);expect((await call('version=asv&resource=index',send,'GET','https://evil.test')).status).toBe(403);expect(send).not.toHaveBeenCalled();
});
it('uses fixed publisher URLs, no redirects, and bounds response size',async()=>{
 const send=vi.fn(async()=>new Response(JSON.stringify({name:'John 3',verses:[]}),{headers:{'content-type':'application/json'}}));
 expect((await call('version=asv&resource=passage&book=43&chapter=3',send)).status).toBe(200);
 expect(send).toHaveBeenCalledWith('https://api.getbible.net/v2/asv/43/3.json',expect.objectContaining({redirect:'error'}));
 const oversized=vi.fn(async()=>new Response('x'.repeat(1500001),{headers:{'content-type':'application/json'}}));expect((await call('version=asv&resource=passage&book=43&chapter=2',oversized)).status).toBe(502);
 const html=vi.fn(async()=>new Response('<html/>',{headers:{'content-type':'text/html'}}));expect((await call('version=asv&resource=passage&book=43&chapter=1',html)).status).toBe(502);
});
