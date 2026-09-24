import catalogue from '../data/countries.json';

export const countries=catalogue;
const codes=new Set(countries.map(country=>country.code));
const displayNames=new Map<string,Intl.DisplayNames>();
const normalize=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/[\s.,()_-]+/g,'');
const aliases:Record<string,string[]>={KR:'대한민국|한국|남한|Republic of Korea|Korea Republic of|South Korea|KOR'.split('|'),KP:'북한|North Korea|PRK'.split('|'),US:'미국|USA|United States of America'.split('|'),GB:'영국|UK|United Kingdom|GBR'.split('|'),CN:'중국|PRC'.split('|'),TW:['대만'],VN:'베트남|Viet Nam'.split('|'),RU:'러시아|Russian Federation'.split('|')};

export function countryName(code:string,locale='en'):string{
 if(!codes.has(code))return '';
 try{if(!displayNames.has(locale)){if(displayNames.size>30)displayNames.clear();displayNames.set(locale,new Intl.DisplayNames([locale,'en'],{type:'region'}));}return displayNames.get(locale)!.of(code)||countries.find(country=>country.code===code)!.name;}catch{return countries.find(country=>country.code===code)!.name;}
}
// Legacy names remain readable, but a new save always uses a catalogue code.
export function resolveCountry(value:string):string|undefined{
 const trimmed=value.trim();if(codes.has(trimmed.toUpperCase()))return trimmed.toUpperCase();
 const key=normalize(trimmed);if(!key)return;
 return countries.find(country=>[country.name,...['ko','en','es'].map(locale=>countryName(country.code,locale)),...(aliases[country.code]||[])].some(name=>normalize(name)===key))?.code;
}
export function searchCountries(query:string,locale='en'){
 const key=normalize(query);
 const exact=key.length<=3?resolveCountry(query):undefined;
 if(exact)return countries.filter(country=>country.code===exact);
 return countries.filter(country=>!key||[country.code,country.name,countryName(country.code,locale),...['ko','en','es'].map(language=>countryName(country.code,language)),...(aliases[country.code]||[])].some(name=>normalize(name).includes(key))).sort((a,b)=>countryName(a.code,locale).localeCompare(countryName(b.code,locale),locale));
}
