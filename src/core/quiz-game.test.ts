import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {makeRound,answerPoints,type BibleQuestion} from './quiz-game';
describe('game questions imported from Dabar',()=>{
 for(const language of ['ko','en','th'])it(`${language} keeps valid, nonduplicate questions and answers`,()=>{
  const bank=JSON.parse(readFileSync(new URL(`../../public/quizzes/${language}.json`,import.meta.url),'utf8')) as BibleQuestion[];
  expect(bank.length).toBeGreaterThan(3000);expect(new Set(bank.map(q=>q.id)).size).toBe(bank.length);
  for(const q of bank){expect(q.lang).toBe(language);expect(q.options[q.answer]).toBeTruthy();expect(q.explanation).toBeTruthy();}
  const round=makeRound(bank,{level:'easy',testament:'new',book:'',count:10},()=>.25);
  expect(round).toHaveLength(10);expect(new Set(round.map(q=>q.id)).size).toBe(10);
  for(const q of round){const source=bank.find(x=>x.id===q.id)!;expect(q.level).toBe('easy');expect(q.testament).toBe('new');expect(q.options[q.answer]).toBe(source.options[source.answer]);}
 });
 it('gives no points for wrong answers and caps the streak bonus',()=>{
  expect(answerPoints(false,10,false)).toBe(0);expect(answerPoints(true,100,false)).toBe(20);expect(answerPoints(true,0,true)).toBe(5);
 });
});
