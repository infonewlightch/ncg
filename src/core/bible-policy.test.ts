import {expect,it,vi} from 'vitest';
import {approvedReaderVersion,canonicalPassage} from './bible-policy';
import {bibleRequest,selectPassageRange} from './bible';
import {ebibleVersions} from './ebible';
import {getBibleVersions} from './getbible';
it('excludes unreviewed editions from selectors and direct requests',async()=>{
 expect((await ebibleVersions('en')).map(v=>v.id)).toEqual(['eb-eng-asv']);
 expect((await getBibleVersions('en')).map(v=>v.id)).toEqual(['eb-gb-asv']);
 expect((await getBibleVersions('ja')).map(v=>v.id)).toEqual(['eb-gb-japbungo']);
 const fetcher=vi.spyOn(globalThis,'fetch');try{
  for(const version of ['eb-engDRA','eb-eng-web-c','eb-gb-douayrheims','eb-engnoy','eb-russyn','eb-indayt','eb-turytc','eb-gb-japkougo','111']){
   expect(approvedReaderVersion(version)).toBe(false);
   await expect(bibleRequest('passage',{version,passage:'JHN.3.16'},new AbortController().signal)).rejects.toThrow('bible_edition_not_approved');
  }
  expect(fetcher).not.toHaveBeenCalled();
 }finally{fetcher.mockRestore();}
 expect(canonicalPassage('TOB.1.1')).toBe(false);expect(canonicalPassage('PSA.151.1')).toBe(false);expect(canonicalPassage('REV.22.21')).toBe(true);
});
it('offers only the verified editions for newly connected languages and their regional aliases',async()=>{
 const expected:Record<string,string[]>={de:['deu1912','deuelo','deu1951'],it:['ita1885'],sw:['swhonen'],bn:['benobcv'],ur:['urdoucv'],vi:['vieovcb']};
 for(const [language,ids] of Object.entries(expected)){
  const editions=await ebibleVersions(language);
  expect(editions.map(version=>version.id)).toEqual(ids.map(id=>`eb-${id}`));
  expect(await ebibleVersions(`${language}-US`)).toEqual(editions);
  for(const edition of editions){expect(edition.access).toBe('reader');expect(edition.coverage).toEqual({books:66,oldTestament:39,newTestament:27});expect(edition.publisher_url).toBe(`https://ebible.org/${edition.id.slice(3)}/copyright.htm`);}
 }
 for(const language of ['ru','id','tr','ms'])expect(await ebibleVersions(language)).toEqual([]);
});
it('selects QT bounds without rewriting merged verses, and rejects wrong or incomplete chapters',()=>{
 const data={id:'JHN.3',reference:'John 3',content:'',verses:[{id:'1',number:'15',text:'Before'},{id:'2',number:'16-17',text:'Exact combined wording.'},{id:'3',number:'18',text:'After'}]};
 expect(selectPassageRange(data,'JHN.3.16-17').verses?.map(v=>v.text)).toEqual(['Exact combined wording.']);
 expect(()=>selectPassageRange(data,'JHN.3.16-19')).toThrow('passage_unavailable');
 expect(()=>selectPassageRange(data,'JHN.4.16-17')).toThrow('passage_unavailable');
});
