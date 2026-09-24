export type InterfaceSeedPack={language:string;reviewed:boolean;messages:Record<string,string>};
// Vite emits a separate file per language; only the selected pack is downloaded.
const loaders=import.meta.glob<{default:InterfaceSeedPack}>('../i18n-generated/*.json');
export function interfaceSeed(locale:string){
 try{
  const target=new Intl.Locale(locale),expanded=target.maximize();
  const language=target.language==='zh'?(expanded.script==='Hant'?'zh-Hant':'zh'):target.language;
  // A regional fallback must not replace an explicitly selected writing system.
  if(expanded.script!==new Intl.Locale(language).maximize().script)return;
  return loaders[`../i18n-generated/${language}.json`];
 }catch{return;}
}
