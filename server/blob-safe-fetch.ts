// Reject failed PUTs before an SDK can mistake a conditional-write failure for success.
export const checkedBlobFetch:typeof fetch=async(input,init)=>{
 const response=await fetch(input,init);
 const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(method==='PUT'&&!response.ok&&response.status!==412)throw Error('translation_storage_unavailable');
 return response;
};
