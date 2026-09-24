// eBible HTML and the original WEBP files use NAM; NCG uses NAH.
export const canonicalEbibleBook=(code:string)=>code==='NAM'?'NAH':code;
export const ebibleBookCode=(code:string)=>code==='NAH'?'NAM':code;
export const canonicalBibleReference=(reference:string)=>reference.replace(/^NAM(?=\.)/,'NAH');
export const sourceBibleReference=(reference:string)=>reference.replace(/^NAH(?=\.)/,'NAM');
