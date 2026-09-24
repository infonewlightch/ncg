import {isIP} from 'node:net';

// Warm-worker protection, not a distributed IP quota. Shared model budgets remain separate.
const limits={interface:{count:80,seconds:180},video:{count:40,seconds:180},community:{count:30,seconds:180},push:{count:60,seconds:60}} as const;
type Scope=keyof typeof limits;
export type RequestContext={ip?:string};
export function createNetlifyRequestLimiter({now=Date.now,maxKeys=10000}:{now?:()=>number;maxKeys?:number}={}){
 const windows=new Map<string,{count:number;reset:number}>();
 return (scope:Scope,context:RequestContext={}):Response|null=>{
  const time=now(),limit=limits[scope];
  // Only Netlify's trusted context is used. Forwarding headers cannot rotate the bucket.
  const address=context.ip&&isIP(context.ip)?context.ip:'unknown';
  const key=`${scope}:${address}`;let current=windows.get(key);
  const denied=(until:number)=>Response.json({error:'rate_limited'},{status:429,headers:{'Cache-Control':'no-store','Retry-After':String(Math.max(1,Math.ceil((until-time)/1000))),'X-Content-Type-Options':'nosniff'}});
  if(current&&current.reset>time){if(current.count>=limit.count)return denied(current.reset);current.count++;return null;}
  if(windows.size>=maxKeys){for(const [id,row] of windows)if(row.reset<=time)windows.delete(id);if(windows.size>=maxKeys)return denied(time+limit.seconds*1000);}
  current={count:1,reset:time+limit.seconds*1000};windows.set(key,current);return null;
 };
}
export const netlifyRequestLimit=createNetlifyRequestLimiter();
