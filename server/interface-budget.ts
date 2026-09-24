// Compare-and-swap makes the shared daily cap hold across function instances.
export interface BudgetBlobs{getWithMetadata(key:string,options:{type:'json'}):Promise<{data:{used:number};etag:string}|null>;setJSON(key:string,value:{used:number},options:{onlyIfNew:true}|{onlyIfMatch:string}):Promise<{modified:boolean}>}
export async function claimInterfaceBudget(blobs:BudgetBlobs,limit=300){
 const key=`budget/${new Date().toISOString().slice(0,10)}`;
 for(let attempt=0;attempt<6;attempt++){
  const current=await blobs.getWithMetadata(key,{type:'json'});const used=current?.data?.used??0;
  if(!Number.isInteger(used)||used<0)throw Error('invalid_budget');if(used>=limit)return false;
  const result=await blobs.setJSON(key,{used:used+1},current?{onlyIfMatch:current.etag}:{onlyIfNew:true});if(result.modified)return true;
 }
 throw Error('budget_busy');
}
