import {readFileSync,readdirSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {preferredBibleVersion,koreanRevisedLink,webVersion,adjacentChapter,readReaderPreferences,resolvePassage,safeBibleLink,bibleRequest,parsePassage,type BibleIndex} from './bible';

const index:BibleIndex={text_direction:'ltr',books:[{id:'GEN',title:'Genesis',full_title:'Genesis',abbreviation:'Gen',canon:'old_testament',chapters:[{id:1,title:1,passage_id:'GEN.1',verses:[{id:1,title:1,passage_id:'GEN.1.1'}]}]},{id:'EXO',title:'Exodus',full_title:'Exodus',abbreviation:'Exo',canon:'old_testament',chapters:[{id:1,title:1,passage_id:'EXO.1',verses:[]}]}]};
describe('Bible navigation and source integrity',()=>{
 it('prefers actual NKRV for Korean while respecting a saved version and distinguishing KRV',()=>{
  const krv={...webVersion,id:'88',title:'개역한글',localized_title:'개역한글',abbreviation:'KRV',localized_abbreviation:'KRV',language_tag:'ko'};const nkrv={...krv,id:'fixture-nkrv',title:'개역개정',localized_title:'개역개정',abbreviation:'NKRV'};
  expect(preferredBibleVersion([krv,nkrv],'ko-KR')?.id).toBe('fixture-nkrv');expect(preferredBibleVersion([krv,nkrv],'ko','88')?.id).toBe('88');expect(preferredBibleVersion([krv],'ko')?.title).toBe('개역한글');expect(koreanRevisedLink('JHN.3.16-18')).toBe('https://bible.bskorea.or.kr/bible/NKRV/JHN.3');
 });
 it('returns the precise QT range and rejects unavailable boundaries',async()=>{
  const data=JSON.parse(readFileSync(new URL('../../public/bibles/webp/JHN.1.json',import.meta.url),'utf8'));
  const spy=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(data)));
  try{
   const reading=await bibleRequest<{verses:{number:string}[]}>('passage',{version:'webp',passage:'JHN.1.14-18'},new AbortController().signal);
   expect(reading.verses.map(v=>v.number)).toEqual(['14','15','16','17','18']);
   spy.mockResolvedValue(new Response(JSON.stringify(data)));
   await expect(bibleRequest('passage',{version:'webp',passage:'JHN.1.50-53'},new AbortController().signal)).rejects.toThrow('passage_unavailable');
   expect(parsePassage('JHN.1.18-14')).toBeNull();expect(parsePassage('JHN.1.0')).toBeNull();
  }finally{spy.mockRestore();}
 });
 it('navigates across book boundaries, stopping at each end',()=>{
  expect(adjacentChapter(index,'GEN.1.1',1)).toBe('EXO.1');
  expect(adjacentChapter(index,'GEN.1',-1)).toBeNull();
  expect(adjacentChapter(index,'EXO.1',1)).toBeNull();
 });
 it('handles absent verses when changing Bible versions without relabelling another verse',()=>{
  expect(resolvePassage(index,'GEN.1.36')).toBe('GEN.1');
  expect(resolvePassage(index,'GEN.1.1')).toBe('GEN.1.1');
  expect(resolvePassage(index,'REV.22')).toBe('GEN.1');
 });
 it('bounds settings and blocks unsafe provider links',()=>{
  expect(readReaderPreferences({fontSize:70,theme:'invalid',passage:'../../x'})).toMatchObject({fontSize:30,theme:'light',passage:'JHN.3'});
  expect(safeBibleLink('javascript:alert(1)')).toBeNull();
  expect(safeBibleLink('https://ebible.org/engwebp/')).toBe('https://ebible.org/engwebp/');
 });
 it('keeps local public-domain Scripture available during a catalogue outage',async()=>{
  const spy=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('offline'));
  try{expect(await bibleRequest('versions',{language:'en'},new AbortController().signal)).toMatchObject({data:[{id:'webp',language_tag:'en'}],providerStatus:'bible_unavailable'});}finally{spy.mockRestore();}
 });
 it('contains 66 books / 1189 chapters with unique, correctly aligned verse identifiers',()=>{
  const root=new URL('../../public/bibles/webp/',import.meta.url);
  const files=readdirSync(root).filter(name=>/^[A-Z0-9]{3}\.\d+\.json$/.test(name));
  expect(files).toHaveLength(1189);
  const catalogue=JSON.parse(readFileSync(new URL('index.json',root),'utf8'));
  expect(catalogue.books).toHaveLength(66);
  let verses=0;
  for(const book of catalogue.books)for(const chapter of book.chapters){
   const content=JSON.parse(readFileSync(new URL(`${book.id}.${chapter.id}.json`,root),'utf8'));
   expect(content.id).toBe(`${book.id}.${chapter.id}`);
   expect(content.verses.map((v:{number:string})=>v.number)).toEqual(chapter.verses);
   const ids=new Set<string>();
   for(const verse of content.verses){expect(verse.id).toBe(`${content.id}.${verse.number}`);expect(ids.has(verse.id)).toBe(false);ids.add(verse.id);expect(Boolean(verse.text||verse.notes?.length)).toBe(true);}
   verses+=content.verses.length;
  }
  expect(verses).toBe(31103);
 });
 it('preserves punctuation, inline words, notes and Psalm heading boundaries',()=>{
  const read=(chapter:string)=>JSON.parse(readFileSync(new URL(`../../public/bibles/webp/${chapter}.json`,import.meta.url),'utf8'));
  expect(read('GEN.1').verses[0].text).toBe('In the beginning, God created the heavens and the earth.');
  expect(read('JHN.1').verses[4].text).toContain('hasn’t');
  expect(read('JHN.3').verses[15].text).toBe('For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.');
  expect(read('PSA.119').verses[7].text).not.toContain('BETH');
  expect(read('PSA.119').verses[8].heading).toBe('BETH');
 });
});
