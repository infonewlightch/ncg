import type {IncomingMessage,ServerResponse} from 'node:http';
import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {translationHandler} from './translation.ts';
import {bibleHandler} from './bible.ts';
export type GatewayServices={verify:(token:string)=>Promise<string|null>;post:(id:string,token:string|null)=>Promise<{body:string;language:string;status:string}|null>;translate:typeof translationHandler;bible:typeof bibleHandler};
export class RateLimiter{
 private windows=new Map<string,{count:number;reset:number}>();
 take(key:string,limit:number,windowMs:number,now=Date.now()){
  const current=this.windows.get(key);if(current&&current.reset>now){if(current.count>=limit)return false;current.count++;return true;}
  if(this.windows.size>=10000){for(const [id,row] of this.windows)if(row.reset<=now)this.windows.delete(id);if(this.windows.size>=10000)return false;}
  this.windows.set(key,{count:1,reset:now+windowMs});return true;
 }
}
export function sourceAddress(req:IncomingMessage,trustProxy=false){
 const address=req.socket?.remoteAddress||'unknown';
 if(trustProxy&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)){
  const value=req.headers['x-forwarded-for'];const first=typeof value==='string'?value.split(',')[0].trim():'';if(isIP(first))return first;
 }
 return address;
}
function publicKey(value:string){if(value.startsWith('sb_publishable_'))return true;try{return JSON.parse(Buffer.from(value.split('.')[1],'base64url').toString()).role==='anon';}catch{return false;}}
export function gatewayServices(env:Record<string,string>):GatewayServices{
 const endpoint=env.VITE_SUPABASE_URL||env.NCG_SUPABASE_URL;const key=env.VITE_SUPABASE_PUBLISHABLE_KEY||'';
 const valid=endpoint?.startsWith('https://')&&publicKey(key);
 const client=(token?:string)=>valid?createClient(endpoint,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{...(token?{headers:{Authorization:`Bearer ${token}`}}:{}),fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000),redirect:'error'})}}):null;
 return {
  async verify(token){const api=client(token);if(!api)return null;const {data,error}=await api.auth.getUser(token);if(error||!data.user)return null;const active=await api.rpc('ncg_active',{person:data.user.id});return !active.error&&active.data===true?data.user.id:null;},
  async post(id,token){const api=client(token||undefined);if(!api)return null;const {data,error}=await api.from('ncg_posts').select('body,language,status').eq('id',id).single();return error?null:data;},translate:translationHandler,bible:bibleHandler
 };
}
export function createGateway(env:Record<string,string>,services=gatewayServices(env)){
 const origin=new URL(env.NCG_PUBLIC_ORIGIN||'http://127.0.0.1:4311').origin;const host=new URL(origin).host;const limiter=new RateLimiter();
 const json=(res:ServerResponse,status:number,error:string)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...(status===429?{'Retry-After':'60'}:{})});res.end(JSON.stringify({error}));};
 return async(req:IncomingMessage,res:ServerResponse)=>{
  if(req.headers.host!==host)return json(res,421,'host_not_allowed');
  const url=new URL(req.url||'/',origin);if(url.origin!==origin)return json(res,403,'origin_not_allowed');
  if(req.headers.origin&&req.headers.origin!==origin)return json(res,403,'origin_not_allowed');
  const address=sourceAddress(req,env.NCG_TRUST_LOOPBACK_PROXY==='1');
  if(!limiter.take(`request:${address}`,180,60000))return json(res,429,'rate_limited');
  if(url.pathname.startsWith('/api/bible/')){req.url=url.pathname.slice('/api/bible'.length)+url.search;return services.bible(req,res,env);}
  if(url.pathname!=='/api/translate')return json(res,404,'not_found');
  if(req.method!=='POST')return json(res,405,'method_not_allowed');
  if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,'json_required');
  if(!env.NCG_TRANSLATION_URL||!env.NCG_TRANSLATION_KEY||!env.NCG_TRANSLATION_MODEL)return json(res,503,'translation_not_configured');
  const rawToken=req.headers.authorization;let token:string|null=null,user:string|null=null;
  if(rawToken){if(!/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(rawToken))return json(res,401,'sign_in_required');token=rawToken.slice(7);try{user=await services.verify(token);}catch{return json(res,503,'auth_unavailable');}if(!user)return json(res,401,'sign_in_required');}
  let bytes=0;const chunks:Buffer[]=[];let body:any;
  try{for await(const chunk of req){const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=buffer.length;if(bytes>12000)return json(res,413,'too_large');chunks.push(buffer);}body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(res,400,'invalid_json');}
  if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.target!=='string'||!/^[-A-Za-z0-9]{2,40}$/.test(body.target))return json(res,400,'invalid_request');
  let scope=user?`member:${user}`:'public';let text=body.text,source=body.source;
  if(body.postId){
   if(typeof body.postId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.postId))return json(res,400,'invalid_request');
   let post;try{post=await services.post(body.postId,token);}catch{return json(res,503,'post_unavailable');}
   if(!post||(!user&&post.status!=='published'))return json(res,404,'post_unavailable');
   text=post.body;source=post.language;scope=post.status==='published'?`public:${body.postId}`:`member:${user}`;
  }
  else if(!user)return json(res,401,'sign_in_required');
  if(typeof text!=='string'||!text.trim()||text.length>1800||typeof source!=='string'||!/^[-A-Za-z0-9]{2,40}$/.test(source))return json(res,400,'invalid_request');
  const identity=user||createHash('sha256').update(address).digest('hex');
  // In-memory guard for a single instance; a shared limiter is required before scaling horizontally.
  if(!limiter.take(`translate-minute:${identity}`,30,60000)||!limiter.take(`translate-day:${identity}`,300,86400000)||!limiter.take('translation-total',Number(env.NCG_TRANSLATION_DAILY_LIMIT)||3000,86400000))return json(res,429,'translation_limit');
  return services.translate(req,res,env,{body:{text,source,target:body.target},cacheScope:scope,trustedOrigin:origin});
 };
}
