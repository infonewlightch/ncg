import {pathToFileURL} from 'node:url';

const project='https://yndtcpsajhmnyeqeozju.supabase.co';
function keyRole(key){try{return JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8')).role;}catch{return null;}}
export function checkHostingConfig(env){
 for(const name of ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','NCG_SUPABASE_URL','NCG_PUBLIC_ORIGIN']){
  if(!env[name])throw Error(`Missing required hosting setting: ${name}`);
 }
 if(env.VITE_SUPABASE_URL!==project||env.NCG_SUPABASE_URL!==project)throw Error('Hosting must use the configured NCG Supabase project.');
 if(env.NCG_PUBLIC_ORIGIN!=='https://newlightchurchglobal.com')throw Error('Hosting must use the official NCG HTTPS origin.');
 const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key)&&keyRole(key)!=='anon')throw Error('The browser Supabase setting must contain a public publishable or anon key.');
 for(const [name,value] of Object.entries(env)){
  if(name.startsWith('VITE_')&&(String(value).startsWith('sb_secret_')||keyRole(String(value))==='service_role'))throw Error('A privileged key cannot be exposed through VITE_ settings.');
 }
 return {endpoint:project,key};
}
export async function verifyHostingConfig(env,request=fetch){
 const {endpoint,key}=checkHostingConfig(env);
 let result;
 try{
  const response=await request(`${endpoint}/auth/v1/settings`,{headers:{apikey:key},credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error();result=await response.json();
 }catch{throw Error('The public NCG authentication connection could not be verified. No build was started.');}
 if(!result?.external||typeof result.external.email!=='boolean'||typeof result.external.google!=='boolean')throw Error('NCG authentication settings returned an unexpected response.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await verifyHostingConfig(process.env);console.log('Verified NCG hosting settings and public authentication connection.');}
 catch(error){console.error(error.message);process.exitCode=1;}
}
