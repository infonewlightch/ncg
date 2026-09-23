import webpush from 'web-push';
import {createClient} from '@supabase/supabase-js';
import {pathToFileURL} from 'node:url';

export function allowedPushEndpoint(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&u.pathname.length>1&&(new Set(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com']).has(u.hostname)||/^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname));}catch{return false;}
}
export function pushPayload(job){
 const code=job.language.split('-')[0];const language=job.translations[job.language]?job.language:job.translations[code]?code:'en';const text=job.translations[language];
 return {title:code==='ko'?'NCG · 오늘의 QT':'NCG · Global QT',body:text?.title|| (code==='ko'?'잠시 멈추고 오늘의 말씀을 묵상해요.':'Take a moment with the Word today.'),language,date:job.reading_date};
}
export function deliveryOutcome(error){
 const status=Number(error?.statusCode);
 if(status===404||status===410)return 'expired';
 if(status===429||status>=500)return 'retry';
 // A timeout can mean the provider accepted the message but the acknowledgement was lost.
 // Do not automatically resend an uncertain delivery.
 return status>=400?'failed':'uncertain';
}
export async function dispatchQtPush({client,send,asOf}={}){
 const {data:jobs,error}=await client.rpc('ncg_claim_qt_push',{batch_size:20,...(asOf?{as_of:asOf}:{})});
 if(error)throw Error('Unable to claim QT reminders. Check worker access and migration 003.');
 const counts={claimed:jobs.length,sent:0,retry:0,expired:0,failed:0,uncertain:0,acknowledgementFailures:0};let position=0;
 async function work(){while(position<jobs.length){const job=jobs[position++];let outcome='failed';
  if(allowedPushEndpoint(job.subscription.endpoint))try{await send(job.subscription,JSON.stringify(pushPayload(job)),{TTL:3600,urgency:'normal',topic:`qt-${job.reading_date}`,timeout:15000});outcome='sent';}catch(e){outcome=deliveryOutcome(e);}
  counts[outcome]++;const ack=await client.rpc('ncg_finish_qt_push',{delivery_id:job.delivery_id,lease_id:job.lease_id,outcome});if(ack.error)counts.acknowledgementFailures++;
 }}
 await Promise.all(Array.from({length:Math.min(jobs.length,4)},work));return counts;
}
async function main(){
 const required=['NCG_SUPABASE_URL','NCG_SUPABASE_SERVICE_ROLE_KEY','NCG_VAPID_PUBLIC_KEY','NCG_VAPID_PRIVATE_KEY'];
 if(required.some(name=>!process.env[name]))throw Error('Push worker is not configured. Set server-only Supabase and VAPID variables. No notifications were sent.');
 const endpoint=new URL(process.env.NCG_SUPABASE_URL);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password)throw Error('Invalid Supabase endpoint.');
 const client=createClient(endpoint.href,process.env.NCG_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 webpush.setVapidDetails('mailto:infonewlighch@gmail.com',process.env.NCG_VAPID_PUBLIC_KEY,process.env.NCG_VAPID_PRIVATE_KEY);
 const counts=await dispatchQtPush({client,send:webpush.sendNotification.bind(webpush)});
 // Operational counts only: never log subscription endpoints, keys, or personal information.
 console.log(JSON.stringify(counts));if(counts.acknowledgementFailures)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('QT reminder worker could not complete. Verify server configuration and database access.');process.exitCode=1;});
