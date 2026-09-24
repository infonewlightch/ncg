import {getStore} from '@netlify/blobs';
import {checkedBlobFetch} from '../../server/blob-safe-fetch.ts';
import {claimInterfaceBudget} from '../../server/interface-budget.ts';
import {videoTranslation,type VideoTranslationStore} from '../../server/video-translation.ts';
export default async function handler(request:Request){
 const blobs=getStore({name:'video-translations',consistency:'strong',fetch:checkedBlobFetch});
 const store:VideoTranslationStore={get:key=>blobs.get(key,{type:'json'}),async set(key,value){await blobs.setJSON(key,value);},claim:()=>claimInterfaceBudget({async getWithMetadata(key){const value=await blobs.getWithMetadata(key,{type:'json'});if(!value)return null;if(!value.etag)throw Error('budget_etag_missing');return {data:value.data,etag:value.etag};},setJSON:(key,value,options)=>blobs.setJSON(key,value,options)})};
 const env=Object.fromEntries(['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','OPENAI_API_KEY','OPENAI_BASE_URL','NCG_VIDEO_TRANSLATION_MODEL'].map(key=>[key,process.env[key]||'']));
 return videoTranslation(request,env,{store});
}
export const config={path:'/api/video-translation',rateLimit:{windowLimit:40,windowSize:180,aggregateBy:['ip','domain']}};
