import es from '../i18n/es.json';
import type {UiLanguage} from './model';
export const interfacePacks:Record<string,{direction:'ltr'|'rtl';messages:Record<string,string>}>={es:{direction:'ltr',messages:es}};
export function translateInterface(ko:string,en:string,locale:string){
 if(locale==='ko')return ko;
 return interfacePacks[locale]?.messages[en]||en;
}
export function interfaceDirection(locale:UiLanguage){return interfacePacks[locale]?.direction||'ltr';}
