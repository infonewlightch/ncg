// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {interfaceSeed,interfaceSeedLanguages} from './interface-seeds';
import {interfaceSource,validInterfaceMessages} from './interface-catalogue';
import {runtimeInterfaceMessage,runtimeInterfaceStatus} from './interface-runtime';
const languages=interfaceSeedLanguages;
afterEach(()=>vi.unstubAllGlobals());
it.each(languages)('ships all current %s UI messages without a generation request',async language=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 const loader=interfaceSeed(language);expect(loader).toBeDefined();
 const {default:pack}=await loader!();expect(pack.language).toBe(language);expect(pack.reviewed).toBe(false);
 expect(new Intl.Locale(language).toString()).toBe(language);
 for(const row of interfaceSource)expect(pack.sourceContext?.[row.en],`source context: ${row.en}`).toBe(row.ko);
 for(const [id,row] of interfaceSource.entries())expect(validInterfaceMessages([{id,text:pack.messages[row.en]}],[{id,en:row.en}]),row.en).toBe(true);
 runtimeInterfaceMessage('Home',language);
 await vi.waitFor(()=>expect(runtimeInterfaceStatus(language)).toBe('automatic'));
 for(const row of interfaceSource)expect(runtimeInterfaceMessage(row.en,language),row.en).toBe(pack.messages[row.en]);
 await Promise.resolve();expect(fetcher).not.toHaveBeenCalled();
});
it('reuses the Filipino pack for Tagalog aliases and regional language preferences',()=>{
 expect(interfaceSeed('fil')).toBeDefined();
 for(const code of ['tl','tl-PH','fil-PH'])expect(interfaceSeed(code)).toBe(interfaceSeed('fil'));
 for(const code of ['lo-LA','km-KH','my-MM','ta-IN','ta-LK','uk-UA','pl-PL']){
  const base=new Intl.Locale(code).language;expect(interfaceSeed(base)).toBeDefined();expect(interfaceSeed(code)).toBe(interfaceSeed(base));
 }
 expect(interfaceSeed('ta-Latn')).toBeUndefined();expect(interfaceSeed('my-Latn')).toBeUndefined();
});
it('chooses regional and Chinese-script fallbacks without substituting a different script',()=>{
 expect(interfaceSeed('fa-IR')).toBe(interfaceSeed('fa'));
 expect(interfaceSeed('hi-IN')).toBe(interfaceSeed('hi'));
 expect(interfaceSeed('zh-CN')).toBe(interfaceSeed('zh'));
 expect(interfaceSeed('zh-SG')).toBe(interfaceSeed('zh'));
 expect(interfaceSeed('zh-TW')).toBe(interfaceSeed('zh-Hant'));
 expect(interfaceSeed('zh-Hant-HK')).toBe(interfaceSeed('zh-Hant'));
 expect(interfaceSeed('hi-Latn')).toBeUndefined();expect(interfaceSeed('ar-Latn')).toBeUndefined();
 expect(interfaceSeed('invalid_tag')).toBeUndefined();expect(interfaceSeed('ja-Latn')).toBeUndefined();
});
