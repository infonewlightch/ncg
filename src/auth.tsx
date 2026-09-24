import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {createClient,type Session} from '@supabase/supabase-js';
import {inspectAuthReturn,resolveAuthReturnIssue,loadAuthMethods,type AuthIssue} from './core/auth-flow';

const endpoint=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const publicKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string|undefined;
function allowedKey(key:string){
 if(key.startsWith('sb_publishable_'))return true;
 try{return JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon';}catch{return false;}
}
const authReturn=inspectAuthReturn(location.href);
export const supabase=endpoint?.startsWith('https://')&&publicKey&&allowedKey(publicKey)?createClient(endpoint,publicKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export const getAuthMethods=(signal:AbortSignal)=>loadAuthMethods(endpoint!,publicKey!,signal);
type Auth={session:Session|null;loading:boolean;error:boolean;configured:boolean;issue:AuthIssue|null;clearIssue:()=>void;recovery:boolean;clearRecovery:()=>void};
const Context=createContext<Auth>({session:null,loading:true,error:false,configured:false,issue:null,clearIssue:()=>{},recovery:false,clearRecovery:()=>{}});
export function AuthProvider({children}:{children:ReactNode}){
 const [recovery,setRecovery]=useState(false);
 const [session,setSession]=useState<Session|null>(null);const [loading,setLoading]=useState(Boolean(supabase));const [issue,setIssue]=useState<AuthIssue|null>(null);
 useEffect(()=>{
  if(!supabase)return;let alive=true,eventRevision=0;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,value)=>{if(alive){eventRevision++;setSession(value);if(event==='PASSWORD_RECOVERY')setRecovery(true);if(event==='SIGNED_OUT')setRecovery(false);if(event!=='INITIAL_SESSION')setLoading(false);}});
  (async()=>{
   // getSession() alone does not expose callback errors from initialize().
   const initialized=await supabase!.auth.initialize();const revision=eventRevision;
   const result=await supabase!.auth.getSession();if(!alive)return;
   if(eventRevision===revision)setSession(result.data.session);
   setIssue(resolveAuthReturnIssue(authReturn,initialized.error||result.error,location.href));
   setLoading(false);
   if(authReturn.active){history.replaceState(null,'',authReturn.destination);window.dispatchEvent(new HashChangeEvent('hashchange'));}
  })().catch(()=>{if(alive){setIssue('unavailable');setLoading(false);if(authReturn.active){history.replaceState(null,'',authReturn.destination);window.dispatchEvent(new HashChangeEvent('hashchange'));}}});
  return()=>{alive=false;subscription.unsubscribe();};
 },[]);
 return <Context.Provider value={{session,loading,error:Boolean(issue),configured:Boolean(supabase),issue,clearIssue:()=>setIssue(null),recovery,clearRecovery:()=>setRecovery(false)}}>{children}</Context.Provider>;
}
export const useAuth=()=>useContext(Context);

// A shared device must not keep the previous account's reminder subscription after sign-out.
export async function signOutAccount(){
 if(!supabase)return {error:null};
 if('serviceWorker' in navigator)try{
  const registration=await navigator.serviceWorker.getRegistration('/');const subscription=await registration?.pushManager.getSubscription();
  if(subscription){
   try{const {data}=await supabase.from('ncg_push_subscriptions').select('id').eq('endpoint',subscription.endpoint).abortSignal(AbortSignal.timeout(4000)).maybeSingle();if(data)await supabase.rpc('ncg_disable_push',{subscription_id:data.id}).abortSignal(AbortSignal.timeout(4000));}catch{}
   await subscription.unsubscribe();
  }
 }catch{}
 return supabase.auth.signOut();
}
