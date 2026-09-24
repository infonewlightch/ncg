import type {UiLanguage} from './model';

export function baseLanguage(code:string){
 try{return new Intl.Locale(code).language;}catch{return code.toLowerCase().split('-')[0];}
}
export function hasInterfaceTranslation(code:string){return ['ko','en','es'].includes(baseLanguage(code));}
export function interfaceLanguage(code:string):UiLanguage{try{const locale=new Intl.Locale(code);return hasInterfaceTranslation(locale.language)?locale.language:locale.toString();}catch{return 'en';}}
export function contentLanguage(code:string,available:readonly string[]){
 return available.find(x=>x===code)||available.find(x=>x===baseLanguage(code))||available.find(x=>x==='en')||available[0];
}
const displayNames=new Map<string,Intl.DisplayNames>();
// Some browsers omit these locales from Intl. Keep prepared languages searchable
// by the name their readers use, even when the current interface is another language.
export const languageAutonyms=new Map<string,string>([
 ['ko','한국어'],['en','English'],['es','español'],['pt','português'],['zh','中文'],['zh-Hant','繁體中文'],
 ['hi','हिन्दी'],['ar','العربية'],['fa','فارسی'],['th','ไทย'],['lo','ລາວ'],['fr','français'],
 ['sw','Kiswahili'],['id','Bahasa Indonesia'],['vi','Tiếng Việt'],['ja','日本語'],['ru','русский'],
 ['de','Deutsch'],['it','italiano'],['tr','Türkçe'],['ms','Bahasa Melayu'],['bn','বাংলা'],['ur','اردو'],
 ['fil','Filipino'],['tl','Tagalog'],['km','ខ្មែរ'],['my','မြန်မာ'],['ta','தமிழ்'],['uk','українська'],['pl','polski'],
]);
export function languageName(code:string,locale='ko'){
 if(code===locale&&languageAutonyms.has(code))return languageAutonyms.get(code)!;
 try{let formatter=displayNames.get(locale);if(!formatter){formatter=new Intl.DisplayNames([locale,'en'],{type:'language'});if(displayNames.size>40)displayNames.clear();displayNames.set(locale,formatter);}return formatter.of(code)||code;}catch{return code;}
}
