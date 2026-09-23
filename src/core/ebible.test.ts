import {readFileSync} from 'node:fs';
import {DOMParser} from 'linkedom';
import {describe,it,expect,vi} from 'vitest';
import {ebibleVersions,ebibleRequest,parseEbibleChapters,parseEbiblePassage} from './ebible';
const parse=(s:string)=>new DOMParser().parseFromString(s,'text/html') as unknown as Document;
describe('published multilingual Scripture',()=>{
 it('maps ISO language codes and keeps every edition including source-only editions',async()=>{
  const es=await ebibleVersions('es-MX');expect(es).toHaveLength(11);expect(es.find(v=>v.id==='eb-spaRV1909')?.access).toBe('reader');expect(es.find(v=>v.id==='eb-spaLBLA')?.access).toBe('external');
  expect(await ebibleVersions('spa')).toEqual(es);expect((await ebibleVersions('ar')).length).toBeGreaterThan(0);expect((await ebibleVersions('zh')).length).toBeGreaterThan(0);
  const ko=await ebibleVersions('ko');expect(ko[0].title).toBe('Korean Bible 1910');expect(ko[0].abbreviation).not.toBe('NKRV');expect(await ebibleVersions('zzz')).toEqual([]);
 });
 it('reads actual chapter links rather than using another edition’s chapter counts',()=>{
  const chapters=parseEbibleChapters(parse('<ul class="tnav"><li><a href="PSA001.htm">1</a></li><li><a href="PSA151.htm">151</a></li><li><a href="JHN01.htm">1</a></li></ul>'),'PSA');expect(chapters.map(c=>c.passage_id)).toEqual(['PSA.1','PSA.151']);expect(chapters[1].versesKnown).toBe(false);
 });
 it('preserves a public-domain source chapter and its verse boundaries',()=>{
  // eBible.org/spaRV1909/JHN03.htm, fetched 2026-09-24; Public Domain.
  const passage=parseEbiblePassage(parse(readFileSync(new URL('./fixtures/spaRV1909-JHN03.html',import.meta.url),'utf8')),'JHN.3');
  expect(passage.verses).toHaveLength(36);expect(passage.reference).toBe('Juan 3');expect(passage.verses?.[15].id).toBe('JHN.3.16');expect(passage.verses?.[15].text).toBe('Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.');expect(passage.content).not.toContain('Public Domain');
 });
 it('separates headings and footnotes, preserves inline punctuation, rejects empty responses',()=>{
  const p=parseEbiblePassage(parse('<div class="main"><div class="s">A heading</div><p><span class="verse" id="V1">1&nbsp;</span>First <span>word</span><a class="notemark">*<span class="popup">A note</span></a>.<span class="verse" id="V2">2&nbsp;</span>Second.</p><div class="footnote">A note</div><ul class="tnav"><li><a href="index.htm">Book</a></li></ul></div>'),'JHN.1');
  expect(p.verses).toEqual([{id:'JHN.1.1',number:'1',heading:'A heading',text:'First word.',notes:['A note']},{id:'JHN.1.2',number:'2',text:'Second.'}]);expect(()=>parseEbiblePassage(parse('<h1>Not found</h1>'),'JHN.1')).toThrow();
 });
 it('retains Arabic verse labels while using stable numerical passage identifiers',()=>{
  // eBible.org/arb-vd/JHN03.htm, fetched 2026-09-24; Public Domain.
  const passage=parseEbiblePassage(parse(readFileSync(new URL('./fixtures/arb-vd-JHN03.html',import.meta.url),'utf8')),'JHN.3');
  expect(passage.verses).toHaveLength(36);expect(passage.verses?.[15]).toMatchObject({id:'JHN.3.16',number:'16',label:'١٦'});expect(passage.verses?.[15].text).toContain('ٱلْعَالَمَ');
 });
 it('never loads a non-redistributable edition through the in-app reader',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch');try{await expect(ebibleRequest('index',{version:'eb-spaLBLA'},new AbortController().signal)).rejects.toThrow('bible_source_unavailable');expect(fetcher).not.toHaveBeenCalled();}finally{fetcher.mockRestore();}
 });
});
