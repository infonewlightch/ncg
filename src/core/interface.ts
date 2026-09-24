import es from '../i18n/es.json';
import {runtimeInterfaceMessage} from './interface-runtime';
import type {UiLanguage} from './model';
export const interfacePacks:Record<string,{direction:'ltr'|'rtl';messages:Record<string,string>}>={es:{direction:'ltr',messages:es}};
export function translateInterface(ko:string,en:string,locale:string){
 if(locale==='ko')return ko;
 if(locale==='en')return en;
 return interfacePacks[locale]?.messages[en]||runtimeInterfaceMessage(en,locale);
}
export function interfaceDirection(locale:UiLanguage){try{const value=new Intl.Locale(locale).maximize();return ['Arab','Hebr','Syrc','Thaa','Nkoo','Adlm','Rohg','Samr','Mand'].includes(value.script||'')?'rtl':'ltr';}catch{return 'ltr';}}
