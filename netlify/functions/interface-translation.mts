import {getStore} from '@netlify/blobs';
import {checkedBlobFetch} from '../../server/blob-safe-fetch.ts';
import {claimInterfaceBudget} from '../../server/interface-budget.ts';
import {interfaceTranslation,type InterfaceStore} from '../../server/interface-translation.ts';
export default async function handler(request:Request){
 const blobs=getStore({name:'interface-translations',consistency:'strong',fetch:checkedBlobFetch});
 const store:InterfaceStore={get:key=>blobs.get(key,{type:'json'}),async set(key,value){await blobs.setJSON(key,value);},claim:()=>claimInterfaceBudget({async getWithMetadata(key){const value=await blobs.getWithMetadata(key,{type:'json'});if(!value)return null;if(!value.etag)throw Error('budget_etag_missing');return {data:value.data,etag:value.etag};},setJSON:(key,value,options)=>blobs.setJSON(key,value,options)})};
 return interfaceTranslation(request,{OPENAI_API_KEY:process.env.OPENAI_API_KEY||'',OPENAI_BASE_URL:process.env.OPENAI_BASE_URL||'',NCG_INTERFACE_TRANSLATION_MODEL:process.env.NCG_INTERFACE_TRANSLATION_MODEL||''},{store});
}
export const config={path:'/api/interface-translation',rateLimit:{windowLimit:80,windowSize:180,aggregateBy:['ip','domain']}};
