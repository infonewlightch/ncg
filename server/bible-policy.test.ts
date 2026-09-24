import {expect,it,vi} from 'vitest';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {bibleSourceHandler} from './bible-source';
import {bibleHandler} from './bible';
async function request(handler:typeof bibleSourceHandler,url:string,fetcher:typeof fetch){let status=0;await handler({url,method:'GET',headers:{host:'ncg.test'}} as IncomingMessage,{writeHead(s:number){status=s;},end(){}} as ServerResponse,fetcher);return status;}
it('blocks Catholic, unreviewed and deuterocanonical source requests before upstream access',async()=>{
 const fetcher=vi.fn();
 for(const query of ['version=engDRA&file=index.htm','version=eng-web-c&file=JHN03.htm','version=eng-kjv&file=index.htm','version=engnoy&file=index.htm','provider=getbible&version=douayrheims&resource=index','provider=getbible&version=canisius&resource=index','provider=getbible&version=vulgate&resource=index','version=eng-asv&file=TOB01.htm','version=eng-asv&file=PSA151.htm','provider=getbible&version=asv&resource=book&book=67','provider=getbible&version=asv&resource=passage&book=19&chapter=151'])expect(await request(bibleSourceHandler,`/?${query}`,fetcher),query).toBe(400);
 expect(fetcher).not.toHaveBeenCalled();
});
it('does not open licensed-provider editions merely because an API key is configured',async()=>{
 const fetcher=vi.fn();let status=0;
 await bibleHandler({url:'/passage?version=111&passage=JHN.3.16',method:'GET',headers:{host:'ncg.test'}} as IncomingMessage,{writeHead(s:number){status=s;},end(){}} as ServerResponse,{NCG_YOUVERSION_APP_KEY:'fixture'},fetcher);
 expect(status).toBe(403);expect(fetcher).not.toHaveBeenCalled();
});
