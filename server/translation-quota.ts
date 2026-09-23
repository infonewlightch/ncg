export async function claimTranslationBudget(env:Record<string,string>,kind:'bible'|'community',token?:string|null,fetcher:typeof fetch=fetch,legacyFloor=0){
 const key=env.VITE_SUPABASE_PUBLISHABLE_KEY||'';let publicKey=key.startsWith('sb_publishable_');
 if(!publicKey)try{publicKey=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}
 let url:URL;try{url=new URL(env.NCG_SUPABASE_URL||env.VITE_SUPABASE_URL);if(url.origin!=='https://yndtcpsajhmnyeqeozju.supabase.co'||url.username||url.password||!publicKey)throw Error();}catch{throw Error('translation_quota_unavailable');}
 url.pathname='/rest/v1/rpc/ncg_claim_translation_budget';url.search='';url.hash='';
 try{
  const response=await fetcher(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({kind,...(kind==='bible'?{legacy_floor:legacyFloor}:{})})});
  if(!response.ok)throw Error();const raw=await response.text();if(raw.length>32)throw Error();const result=JSON.parse(raw);if(typeof result!=='boolean')throw Error();return result;
 }catch{throw Error('translation_quota_unavailable');}
}
