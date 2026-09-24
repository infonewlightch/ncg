import {describe,expect,it} from 'vitest';
import {getBibleVersions,parseGetBibleChapters,parseGetBiblePassage} from './getbible';
import {readReaderPreferences} from './bible';
import {readBookmarks} from './bible-bookmarks';
describe('additional public-domain Bible provider',()=>{
 it('lists all editions of a language and retains new edition preferences and bookmarks',async()=>{
  const versions=await getBibleVersions('eng');expect(versions.some(v=>v.id==='eb-gb-asv')).toBe(true);
  expect(versions.every(v=>v.copyright.startsWith('Public Domain'))).toBe(true);
  expect(readReaderPreferences({versions:{en:'eb-gb-asv'}}).versions.en).toBe('eb-gb-asv');
  expect(readBookmarks([{version:'eb-gb-asv',passage:'JHN.3.16',reference:'John 3:16',language:'en'}])).toHaveLength(1);
 });
 it('uses actual source chapter counts and preserves verse text exactly',()=>{
  expect(parseGetBibleChapters({'1':{chapter:1},'3':{chapter:3}},'JHN').map(c=>c.passage_id)).toEqual(['JHN.1','JHN.3']);
  const verse={verse:16,chapter:3,text:'Original wording — unchanged.'};const result=parseGetBiblePassage({book_nr:43,chapter:3,name:'John 3',verses:[verse]},'JHN',3);
  expect(result.verses?.[0]).toEqual({id:'JHN.3.16',number:'16',text:verse.text});
  expect(parseGetBiblePassage({book_nr:43,chapter:3,name:'John 3',verses:[{...verse,text:'This <FI>is<Fi> text.'}]},'JHN',3).verses?.[0].text).toBe('This is text.');
 });
 it('rejects wrong chapters, empty or duplicate verses instead of showing mismatched Scripture',()=>{
  const data={book_nr:43,chapter:3,name:'John 3',verses:[{verse:1,chapter:3,text:'Text'}]};
  expect(()=>parseGetBiblePassage(data,'MAT',3)).toThrow();expect(()=>parseGetBiblePassage(data,'JHN',4)).toThrow();
  expect(()=>parseGetBiblePassage({...data,verses:[...data.verses,...data.verses]},'JHN',3)).toThrow();
  expect(()=>parseGetBiblePassage({...data,verses:[{verse:1,chapter:3,text:''}]},'JHN',3)).toThrow();
 });
});
