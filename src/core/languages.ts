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
export function languageName(code:string,locale='ko'){
 try{let formatter=displayNames.get(locale);if(!formatter){formatter=new Intl.DisplayNames([locale,'en'],{type:'language'});if(displayNames.size>40)displayNames.clear();displayNames.set(locale,formatter);}return formatter.of(code)||code;}catch{return code;}
}
