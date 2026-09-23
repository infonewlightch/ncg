import {getStore} from '@netlify/blobs';
import {bibleTranslation,type ScriptureTranslation,type TranslationStore} from '../../server/bible-translation.ts';
export default async function handler(request:Request){
 const blobs=getStore({name:'bible-reference-translations',consistency:'strong'});
 const store:TranslationStore={
  get:key=>blobs.get(key,{type:'json'}),
  async set(key,value:ScriptureTranslation){await blobs.setJSON(key,value);},
  async claim(){
   const key=`budget/${new Date().toISOString().slice(0,10)}`;
   for(let attempt=0;attempt<5;attempt++){
    const existing=await blobs.getWithMetadata(key,{type:'json'});const used=existing?.data?.used||0;
    if(!Number.isInteger(used)||used>=60)return false;
    const {modified}=await blobs.setJSON(key,{used:used+1},existing?{onlyIfMatch:existing.etag}:{onlyIfNew:true});if(modified)return true;
   }
   return false;
  }
 };
 return bibleTranslation(request,{OPENAI_API_KEY:process.env.OPENAI_API_KEY||'',OPENAI_BASE_URL:process.env.OPENAI_BASE_URL||'',NCG_BIBLE_TRANSLATION_MODEL:process.env.NCG_BIBLE_TRANSLATION_MODEL||''},{store});
}
export const config={path:'/api/bible-translation',rateLimit:{windowLimit:6,windowSize:180,aggregateBy:['ip','domain']}};
