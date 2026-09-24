import {readFileSync} from 'node:fs';
import {DOMParser} from 'linkedom';
import bookCodes from '../data/bible-books.json';
import {preferredBibleVersion,type BibleIndex,type BiblePassage} from './bible';
import {describe,it,expect,vi} from 'vitest';
import {ebibleVersions,ebibleRequest,parseEbibleBooks,parseEbibleChapters,parseEbiblePassage} from './ebible';
const parse=(s:string)=>new DOMParser().parseFromString(s,'text/html') as unknown as Document;
describe('published multilingual Scripture',()=>{
 it('maps ISO language codes and exposes only individually reviewed editions',async()=>{
  const es=await ebibleVersions('es-MX');expect(es).toHaveLength(1);expect(es.find(v=>v.id==='eb-spaRV1909')?.access).toBe('reader');expect(es.find(v=>v.id==='eb-spaLBLA')).toBeUndefined();
  expect(await ebibleVersions('spa')).toEqual(es);expect((await ebibleVersions('ar')).length).toBeGreaterThan(0);expect((await ebibleVersions('zh')).length).toBeGreaterThan(0);
  expect(await ebibleVersions('ko')).toEqual([]);expect(await ebibleVersions('zzz')).toEqual([]);
 });
 it('reads source chapter links while excluding noncanonical chapters',()=>{
  const chapters=parseEbibleChapters(parse('<ul class="tnav"><li><a href="PSA001.htm">1</a></li><li><a href="PSA151.htm">151</a></li><li><a href="JHN01.htm">1</a></li></ul>'),'PSA');expect(chapters.map(c=>c.passage_id)).toEqual(['PSA.1']);expect(chapters[0].versesKnown).toBe(false);
 });
 it('matches the selected Chinese writing system unless a saved edition takes priority',async()=>{
  const editions=await ebibleVersions('zh');
  for(const language of ['zh-Hant','zh-TW','zh-HK'])expect(preferredBibleVersion(editions,language)?.id).toBe('eb-cmn-cu89t');
  for(const language of ['zh','zh-Hans','zh-CN'])expect(preferredBibleVersion(editions,language)?.id).toBe('eb-cmn-cu89s');
  expect(preferredBibleVersion(editions,'zh-TW','eb-cmn-cu89s')?.id).toBe('eb-cmn-cu89s');
 });
 it('retains all 66 books and maps Nahum links to stable NCG references',async()=>{
  const fixture=(file:string)=>readFileSync(new URL(`./fixtures/spaRV1909-${file.replace('.htm','.html')}`,import.meta.url),'utf8');
  const books=parseEbibleBooks(parse(fixture('index.htm')));
  expect(books.map(book=>book.id)).toEqual(bookCodes.map(book=>book.code));
  expect(parseEbibleChapters(parse(fixture('NAM.htm')),'NAH').map(chapter=>[chapter.passage_id,chapter.sourceFile])).toEqual([['NAH.1','NAM01.htm'],['NAH.2','NAM02.htm'],['NAH.3','NAM03.htm']]);
  const originalParser=globalThis.DOMParser;globalThis.DOMParser=DOMParser as unknown as typeof globalThis.DOMParser;
  const requested:string[]=[];const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async url=>{const file=new URL(String(url),'https://ncg.test').searchParams.get('file')!;requested.push(file);return new Response(JSON.stringify({html:file==='copyright.htm'?'<html><body>Public Domain</body></html>':fixture(file)}));});
  try{
   const signal=new AbortController().signal;
   const index=await ebibleRequest<BibleIndex>('index',{version:'eb-spaRV1909',passage:'NAH.1'},signal);
   expect(index.books.find(book=>book.id==='NAH')?.chapters).toHaveLength(3);
   const passage=await ebibleRequest<BiblePassage>('passage',{version:'eb-spaRV1909',passage:'NAH.1'},signal);
   expect(passage.id).toBe('NAH.1');expect(passage.verses).toHaveLength(15);expect(passage.verses?.[0].id).toBe('NAH.1.1');
   expect(requested).toContain('NAM01.htm');expect(requested.some(file=>file.startsWith('NAH'))).toBe(false);
  }finally{fetcher.mockRestore();globalThis.DOMParser=originalParser;}
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
