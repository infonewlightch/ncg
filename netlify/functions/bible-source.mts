import {Readable} from 'node:stream';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {bibleSourceHandler} from '../../server/bible-source.ts';
export default async function handler(request:Request){
 const url=new URL(request.url);if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return Response.json({error:'origin_not_allowed'},{status:403});
 const input=Object.assign(Readable.from([]),{method:request.method,url:url.pathname+url.search,headers:{host:url.host}}) as IncomingMessage;
 let status=200,body='';const headers=new Headers();const output={writeHead(code:number,values:Record<string,string>){status=code;for(const [key,value] of Object.entries(values))headers.set(key,value);},end(value:string){body=value;}} as unknown as ServerResponse;
 await bibleSourceHandler(input,output);return new Response(body,{status,headers});
}
export const config={path:'/api/bible-source',rateLimit:{windowLimit:120,windowSize:60,aggregateBy:['ip','domain']}};
