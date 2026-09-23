import {Readable} from 'node:stream';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {createGateway,gatewayServices,type GatewayServices} from '../../server/gateway.ts';
import {claimTranslationBudget} from '../../server/translation-quota.ts';

export function createTranslationFunction(values:Record<string,string>,services?:GatewayServices,claim=claimTranslationBudget){
 const env:Record<string,string>={...values,NCG_TRANSLATION_STORED_ONLY:'1',NCG_TRUST_LOOPBACK_PROXY:'0'};
 // Netlify injects its existing AI Gateway credentials; no credential is exposed to clients.
 try{const endpoint=new URL(env.OPENAI_BASE_URL);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password)throw Error();endpoint.pathname=endpoint.pathname.replace(/\/$/,'').replace(/\/v1$/,'')+'/v1/chat/completions';env.NCG_TRANSLATION_URL=endpoint.href;env.NCG_TRANSLATION_KEY=env.OPENAI_API_KEY;env.NCG_TRANSLATION_MODEL=env.NCG_TRANSLATION_MODEL||'gpt-4.1-mini';}catch{env.NCG_TRANSLATION_URL='';}
 const gateway=createGateway(env,{...(services||gatewayServices(env)),claim:token=>claim(env,'community',token)});
 return async(request:Request,context:{ip?:string}={})=>{
  const url=new URL(request.url),headers=Object.fromEntries(request.headers);headers.host=url.host;
  const stream=request.body?Readable.fromWeb(request.body as never):Readable.from([]);
  const req=Object.assign(stream,{method:request.method,url:url.pathname+url.search,headers,socket:{remoteAddress:context.ip||'unknown'}}) as IncomingMessage;
  let status=500,output='';const responseHeaders=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  const res={writeHead(code:number,values:Record<string,string|number>={}){status=code;for(const [name,value] of Object.entries(values))responseHeaders.set(name,String(value));},end(data?:string|Buffer){output=data?.toString()||'';}} as ServerResponse;
  try{await gateway(req,res);return new Response(output,{status,headers:responseHeaders});}
  catch{return Response.json({error:'translation_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
  finally{stream.destroy();}
 };
}
let handler:ReturnType<typeof createTranslationFunction>|undefined;
export default (request:Request,context:{ip?:string})=>{
 handler??=createTranslationFunction(Object.fromEntries(['NCG_PUBLIC_ORIGIN','NCG_SUPABASE_URL','VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','OPENAI_API_KEY','OPENAI_BASE_URL','NCG_TRANSLATION_MODEL'].map(key=>[key,process.env[key]||''])));
 return handler(request,context);
};
export const config={path:'/api/translate',rateLimit:{windowLimit:30,windowSize:180,aggregateBy:['ip','domain']}};
