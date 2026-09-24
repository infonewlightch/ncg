import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import schedule from '../data/qt/duranno-schedule.json';
import {qtScheduleOn,publishedQtOn} from './qt-schedule';
import {previewQtWeek,validDate,type QtReading} from './qt';

it('contains unique, verified dates and real canonical verse bounds',()=>{
 expect(new Set(schedule.map(row=>row.date)).size).toBe(schedule.length);
 for(const row of schedule){
  expect(validDate(row.date)&&validDate(row.verifiedOn)).toBe(true);
  expect(new URL(row.sourceUrl).origin).toBe('https://www.duranno.com');
  expect(new URL(row.sourceUrl).searchParams.get('qtDate')).toBe(row.date);
  const [book,chapter,range]=row.passage.split('.');const [from,to]=range.split('-').map(Number);
  const text=JSON.parse(readFileSync(new URL(`../../public/bibles/webp/${book}.${chapter}.json`,import.meta.url),'utf8'));
  const verses=text.verses.map((v:{number:string})=>Number(v.number));
  expect(verses).toContain(from);expect(verses).toContain(to);expect(to).toBeGreaterThanOrEqual(from);
 }
});
it('never repeats a known passage onto an unverified date or exposes editorial samples',()=>{
 expect(qtScheduleOn('2026-09-24')?.passage).toBe('1CH.14.1-17');
 expect(qtScheduleOn('2026-09-25')).toBeUndefined();
 expect(publishedQtOn(previewQtWeek,'2026-09-24')).toBeUndefined();
});
it('keeps a different published passage and its discussion out of the sourced daily reading',()=>{
 const reading={...previewQtWeek[3],status:'published',id:'verified-server-id'} as QtReading;
 expect(publishedQtOn([reading],reading.date)).toBeUndefined();
 const matching={...reading,passage:'1CH.14.1-17'};
 expect(publishedQtOn([matching],matching.date)).toBe(matching);
});
