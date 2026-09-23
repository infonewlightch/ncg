import {describe,it,expect} from 'vitest';
import {addQuiz,acknowledgeQuiz,emptyQuiz,importGuestQuiz,pullQuiz,quizDelta,readQuizSync} from './quiz-progress';
import {initialState,readState} from './storage';
const one={answered:10,correct:7,rounds:1,bestScore:80,bestStreak:4};
const two={answered:5,correct:3,rounds:1,bestScore:40,bestStreak:2};
const id='10000000-0000-4000-8000-000000000001';
describe('personal quiz synchronization',()=>{
 it('merges another device with unsent local work and keeps the strongest score',()=>{
  const result=pullQuiz(addQuiz(one,two),addQuiz(one,two),{baseline:one,pending:null,revision:1},2);
  expect(result.quiz).toEqual({...one,answered:20,correct:13,rounds:3});
  expect(result.quizSync.baseline).toEqual(addQuiz(one,two));
 });
 it('does not count an in-flight operation again and preserves answers made during that request',()=>{
  const pending={id,delta:one,sent:one},sync={baseline:emptyQuiz,pending,revision:0};
  const current=addQuiz(one,two);
  expect(pullQuiz(one,current,sync,1)).toEqual({quiz:current,quizSync:sync});
  const result=acknowledgeQuiz(addQuiz(one,one),current,pending,2);
  expect(result.quiz.answered).toBe(25);expect(result.quiz.correct).toBe(17);expect(result.quiz.rounds).toBe(3);
  expect(quizDelta(result.quizSync.baseline,result.quiz)).toEqual({...two,bestScore:0,bestStreak:0});
 });
 it('ignores stale reads and restores a pending operation exactly across reload',()=>{
  const sync={baseline:one,pending:null,revision:3};expect(pullQuiz(emptyQuiz,one,sync,2)).toEqual({quiz:one,quizSync:sync});
  const pending={id,delta:one,sent:one};expect(readQuizSync({...sync,pending})).toEqual({...sync,pending});
  const state=readState(JSON.stringify({...initialState,quiz:one,quizSync:{...sync,pending}}));expect(state.quizSync.pending).toEqual(pending);
  expect(readState(null).quiz).toEqual(emptyQuiz);
 });
 it('imports guest progress explicitly once, then only imports new guest work',()=>{
  const first=importGuestQuiz(one,{},id,two);expect(first.quiz.answered).toBe(15);
  expect(importGuestQuiz(first.quiz,first.quizImports,id,two)).toEqual(first);
  const next=importGuestQuiz(first.quiz,first.quizImports,id,addQuiz(two,two));expect(next.quiz.answered).toBe(20);
  expect(importGuestQuiz(next.quiz,next.quizImports,id,emptyQuiz)).toEqual(next);
  expect(readState(JSON.stringify({...initialState,...next})).quizImports).toEqual(next.quizImports);
  expect(readState(null).quizImports).toEqual({});
 });
 it('migrates prior local-only totals without inventing a synchronized baseline',()=>{
  const state=readState(JSON.stringify({version:1,quiz:one}));expect(state.quiz).toEqual(one);expect(state.quizSync.baseline).toEqual(emptyQuiz);
  expect(readState(JSON.stringify({version:1,quiz:{answered:5,correct:80,bestScore:Infinity,bestStreak:99},quizSync:{pending:{id:'bad'}}})).quiz).toEqual({...emptyQuiz,answered:5,correct:5,bestStreak:30});
 });
});
