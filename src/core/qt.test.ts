import {describe,it,expect} from 'vitest';
import {dateInZone,weekDates,shiftDate,qtCopy,qtTopic,previewQtWeek,validDate} from './qt';
import {readFileSync} from 'node:fs';
describe('Shared QT calendar',()=>{
 it('uses one editorial date across time zones at Seoul midnight',()=>{
  expect(dateInZone(new Date('2026-09-23T14:59:59Z'))).toBe('2026-09-23');
  expect(dateInZone(new Date('2026-09-23T15:00:00Z'))).toBe('2026-09-24');
  expect(dateInZone(new Date('2026-09-23T08:00:00-07:00'))).toBe('2026-09-24');
 });
 it('keeps Monday–Sunday weeks correct across months and leap days',()=>{
  expect(weekDates('2026-03-01')).toEqual(['2026-02-23','2026-02-24','2026-02-25','2026-02-26','2026-02-27','2026-02-28','2026-03-01']);
  expect(shiftDate('2028-02-28',1)).toBe('2028-02-29');expect(validDate('2026-02-30')).toBe(false);
 });
 it('uses stable shared topic IDs and honest localized editorial fallback',()=>{
  const reading=previewQtWeek[0];expect(qtCopy(reading,'ko-KR').language).toBe('ko');expect(qtCopy(reading,'th').language).toBe('en');expect(qtTopic(reading)).toBe('qt:preview-2026-09-21');
  expect(previewQtWeek.every(r=>r.status==='draft')).toBe(true);
 });
 it('divides John 1 into complete consecutive ranges without gaps or overlaps',()=>{
  const verses=JSON.parse(readFileSync(new URL('../../public/bibles/webp/JHN.1.json',import.meta.url),'utf8')).verses;
  const covered=previewQtWeek.flatMap(r=>{const [from,to]=r.passage.split('.')[2].split('-').map(Number);return Array.from({length:to-from+1},(_,i)=>from+i);});
  expect(covered).toEqual(verses.map((v:{number:string})=>Number(v.number)));
  expect(previewQtWeek.slice(0,3).map(r=>[r.section,r.part,r.parts])).toEqual([['JHN.1.1-18',1,3],['JHN.1.1-18',2,3],['JHN.1.1-18',3,3]]);
 });
});
