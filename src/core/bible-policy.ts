import policy from '../data/bible-policy.json' with {type:'json'};
import books from '../data/bible-books.json' with {type:'json'};

// Explicit edition review, independent of a provider's redistribution/certification flags.
export const hasLicensedBibleEditions=policy.youversion.length>0;
export function approvedEdition(provider:'ebible'|'getbible'|'youversion',id:string){return (policy[provider] as string[]).includes(id);}
export function approvedReaderVersion(id:string){
 if(id==='webp')return true;
 if(id.startsWith('eb-gb-'))return approvedEdition('getbible',id.slice(6));
 if(id.startsWith('eb-'))return approvedEdition('ebible',id.slice(3));
 return approvedEdition('youversion',id);
}
export function canonicalBook(code:string){return books.find(book=>book.code===code);}
export function canonicalChapter(code:string,chapter:number){const book=canonicalBook(code);return Boolean(book&&Number.isInteger(chapter)&&chapter>=1&&chapter<=Number(book.chapters));}
export function canonicalPassage(passage:string){const match=/^([A-Z0-9]{3})\.([1-9]\d{0,2})(?:\.([1-9]\d{0,2})(?:-([1-9]\d{0,2}))?)?$/.exec(passage);return Boolean(match&&canonicalChapter(match[1],Number(match[2]))&&(!match[4]||Number(match[4])>=Number(match[3])));}
