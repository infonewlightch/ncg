// @ts-ignore Server-only JavaScript module.
import {pushConfiguration} from '../../server/push-worker.mjs';
import {netlifyRequestLimit,type RequestContext} from '../../server/netlify-request-limits.ts';

export function pushStatus(request:Request,env:Record<string,string|undefined>){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(request.method!=='GET')return Response.json({error:'method_not_allowed'},{status:405,headers:{...headers,Allow:'GET'}});
 const configured=pushConfiguration(env);
 return Response.json({configured,...(configured?{publicKey:env.NCG_VAPID_PUBLIC_KEY}:{})},{headers});
}
export default (request:Request,context:RequestContext={})=>netlifyRequestLimit('push',context)||pushStatus(request,process.env);
export const config={path:'/api/push-status'};
