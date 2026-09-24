export type InterfaceSeedPack={language:string;reviewed:boolean;messages:Record<string,string>;sourceContext?:Record<string,string>};
// Vite emits a separate file per language; only the selected pack is downloaded.
const loaders=import.meta.glob<{default:InterfaceSeedPack}>('../i18n-generated/*.json');
export const interfaceSeedLanguages=Object.keys(loaders).map(path=>path.split('/').pop()!.replace('.json','')).sort();
export function interfaceSeed(locale:string){
 try{
  const target=new Intl.Locale(locale),expanded=target.maximize();
  // Prefer an exact regional/script pack; never replace a requested writing system.
  const candidates=[target.toString(),`${target.language}-${expanded.script}`,target.language];
  for(const language of candidates){
   if(expanded.script!==new Intl.Locale(language).maximize().script)continue;
   const loader=loaders[`../i18n-generated/${language}.json`];if(loader)return loader;
  }
 }catch{return;}
}
