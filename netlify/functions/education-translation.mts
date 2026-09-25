import {getStore} from '@netlify/blobs';
import {checkedBlobFetch} from '../../server/blob-safe-fetch.ts';
import {claimInterfaceBudget} from '../../server/interface-budget.ts';
import {educationTranslation,type EducationTranslationStore} from '../../server/education-translation.ts';
import {netlifyRequestLimit,type RequestContext} from '../../server/netlify-request-limits.ts';
export default async function handler(request:Request,context:RequestContext={}){
 // Same conservative per-worker IP window as interface text; generation also shares its global daily budget.
 const limited=netlifyRequestLimit('interface',context);if(limited)return limited;
 const blobs=getStore({name:'education-translations',consistency:'strong',fetch:checkedBlobFetch});
 const budget=getStore({name:'interface-translations',consistency:'strong',fetch:checkedBlobFetch});
 const store:EducationTranslationStore={get:key=>blobs.get(key,{type:'json'}),async set(key,value){await blobs.setJSON(key,value);},claim:()=>claimInterfaceBudget({async getWithMetadata(key){const value=await budget.getWithMetadata(key,{type:'json'});if(!value)return null;if(!value.etag)throw Error('budget_etag_missing');return {data:value.data,etag:value.etag};},setJSON:(key,value,options)=>budget.setJSON(key,value,options)})};
 return educationTranslation(request,{OPENAI_API_KEY:process.env.OPENAI_API_KEY||'',OPENAI_BASE_URL:process.env.OPENAI_BASE_URL||'',NCG_EDUCATION_TRANSLATION_MODEL:process.env.NCG_EDUCATION_TRANSLATION_MODEL||''},{store});
}
export const config={path:'/api/education-translation'};
