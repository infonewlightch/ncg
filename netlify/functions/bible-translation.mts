import {getStore} from '@netlify/blobs';
import {checkedBlobFetch} from '../../server/blob-safe-fetch.ts';
import {bibleTranslation,type ScriptureTranslation,type TranslationStore} from '../../server/bible-translation.ts';
export default async function handler(request:Request){
 const blobs=getStore({name:'bible-reference-translations',consistency:'strong',fetch:checkedBlobFetch});
 const store:TranslationStore={
  get:key=>blobs.get(key,{type:'json'}),
  async set(key,value:ScriptureTranslation){await blobs.setJSON(key,value);},
  async claim(){
   const key=`budget/${new Date().toISOString().slice(0,10)}`;
   for(let attempt=0;attempt<5;attempt++){
    const existing=await blobs.getWithMetadata(key,{type:'json'});const used=existing?existing.data?.used:0;
    if(!Number.isInteger(used)||used<0||(existing&&(typeof existing.etag!=='string'||!existing.etag)))throw Error('translation_budget_unavailable');
    if(used>=60)return false;
    const {modified,etag}=await blobs.setJSON(key,{used:used+1},existing?{onlyIfMatch:existing.etag}:{onlyIfNew:true});
    // Some SDK versions report conditional-write failures as modified with no ETag.
    if(modified){if(typeof etag!=='string'||!etag)throw Error('translation_budget_unavailable');return true;}
   }
   return false;
  }
 };
 return bibleTranslation(request,{OPENAI_API_KEY:process.env.OPENAI_API_KEY||'',OPENAI_BASE_URL:process.env.OPENAI_BASE_URL||'',NCG_BIBLE_TRANSLATION_MODEL:process.env.NCG_BIBLE_TRANSLATION_MODEL||''},{store});
}
export const config={path:'/api/bible-translation',rateLimit:{windowLimit:6,windowSize:180,aggregateBy:['ip','domain']}};
