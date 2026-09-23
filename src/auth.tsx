import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {createClient,type Session} from '@supabase/supabase-js';

const endpoint=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const publicKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string|undefined;
function allowedKey(key:string){
 if(key.startsWith('sb_publishable_'))return true;
 try{return JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon';}catch{return false;}
}
export const supabase=endpoint?.startsWith('https://')&&publicKey&&allowedKey(publicKey)?createClient(endpoint,publicKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
type Auth={session:Session|null;loading:boolean;error:boolean;configured:boolean};
const Context=createContext<Auth>({session:null,loading:true,error:false,configured:false});
export function AuthProvider({children}:{children:ReactNode}){
 const [session,setSession]=useState<Session|null>(null);const [loading,setLoading]=useState(Boolean(supabase));const [error,setError]=useState(false);
 useEffect(()=>{
  if(!supabase)return;let alive=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,value)=>{if(alive){setSession(value);setLoading(false);}});
  supabase.auth.getSession().then(({data,error})=>{if(alive){setSession(data.session);setError(Boolean(error));setLoading(false);if(location.pathname==='/auth/callback'){history.replaceState(null,'','/#/profile');window.dispatchEvent(new HashChangeEvent('hashchange'));}}}).catch(()=>{if(alive){setError(true);setLoading(false);}});
  return()=>{alive=false;subscription.unsubscribe();};
 },[]);
 return <Context.Provider value={{session,loading,error,configured:Boolean(supabase)}}>{children}</Context.Provider>;
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
