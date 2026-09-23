import {Readable} from 'node:stream';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {bibleHandler} from '../../server/bible.ts';

export default async function handler(request:Request){
 const url=new URL(request.url);
 if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return Response.json({error:'origin_not_allowed'},{status:403});
 const input=Object.assign(Readable.from([]),{method:request.method,url:url.pathname.replace(/^\/api\/bible/,'')+url.search,headers:{host:url.host}}) as IncomingMessage;
 let status=200,body='';const headers=new Headers();
 const output={writeHead(code:number,values:Record<string,string>){status=code;for(const [key,value] of Object.entries(values))headers.set(key,value);},end(value:string){body=value;}} as unknown as ServerResponse;
 try{await bibleHandler(input,output,{NCG_YOUVERSION_APP_KEY:process.env.NCG_YOUVERSION_APP_KEY||''});return new Response(body,{status,headers});}
 catch{return Response.json({error:'bible_unavailable'},{status:502,headers:{'Cache-Control':'no-store'}});}
}
export const config={path:'/api/bible/*'};
