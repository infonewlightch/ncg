import {getStore} from '@netlify/blobs';
import {checkedBlobFetch} from '../../server/blob-safe-fetch.ts';
import {claimTranslationBudget} from '../../server/translation-quota.ts';
import {bibleTranslation,type ScriptureTranslation,type TranslationStore} from '../../server/bible-translation.ts';
export default async function handler(request:Request){
 const blobs=getStore({name:'bible-reference-translations',consistency:'strong',fetch:checkedBlobFetch});
 const store:TranslationStore={
  get:key=>blobs.get(key,{type:'json'}),
  async set(key,value:ScriptureTranslation){await blobs.setJSON(key,value);},
  async claim(){
   // Carry the old preview usage forward; never write or reset the legacy counter.
   const legacy=await blobs.getWithMetadata(`budget/${new Date().toISOString().slice(0,10)}`,{type:'json'});
   const used=legacy?legacy.data?.used:0;if(!Number.isInteger(used)||used<0||used>60)throw Error('translation_quota_unavailable');
   return claimTranslationBudget({NCG_SUPABASE_URL:process.env.NCG_SUPABASE_URL||process.env.VITE_SUPABASE_URL||'',VITE_SUPABASE_PUBLISHABLE_KEY:process.env.VITE_SUPABASE_PUBLISHABLE_KEY||''},'bible',null,fetch,used);
  }
 };
 return bibleTranslation(request,{OPENAI_API_KEY:process.env.OPENAI_API_KEY||'',OPENAI_BASE_URL:process.env.OPENAI_BASE_URL||'',NCG_BIBLE_TRANSLATION_MODEL:process.env.NCG_BIBLE_TRANSLATION_MODEL||''},{store});
}
export const config={path:'/api/bible-translation',rateLimit:{windowLimit:6,windowSize:180,aggregateBy:['ip','domain']}};
