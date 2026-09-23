import type {QuizProgress} from './model';

export const emptyQuiz:QuizProgress={answered:0,correct:0,rounds:0,bestScore:0,bestStreak:0};
export type QuizPending={id:string;delta:QuizProgress;sent:QuizProgress};
export type QuizSync={baseline:QuizProgress;pending:QuizPending|null;revision:number};
export type QuizSyncStatus='waiting'|'synced'|'error';
export const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const count=(n:unknown,max=1_000_000_000)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0?Math.min(n,max):0;
export function readQuiz(value:unknown):QuizProgress{
 const q=(value&&typeof value==='object'?value:{}) as Partial<QuizProgress>;
 const answered=count(q.answered);
 return {answered,correct:Math.min(answered,count(q.correct)),rounds:count(q.rounds),bestScore:count(q.bestScore,600),bestStreak:count(q.bestStreak,30)};
}
export function quizDelta(before:QuizProgress,after:QuizProgress):QuizProgress{
 return {answered:Math.max(0,after.answered-before.answered),correct:Math.max(0,after.correct-before.correct),rounds:Math.max(0,after.rounds-before.rounds),bestScore:after.bestScore>before.bestScore?after.bestScore:0,bestStreak:after.bestStreak>before.bestStreak?after.bestStreak:0};
}
export const hasQuizDelta=(delta:QuizProgress)=>Object.values(delta).some(n=>n>0);
export function addQuiz(remote:QuizProgress,delta:QuizProgress):QuizProgress{
 return {answered:remote.answered+delta.answered,correct:remote.correct+delta.correct,rounds:remote.rounds+delta.rounds,bestScore:Math.max(remote.bestScore,delta.bestScore),bestStreak:Math.max(remote.bestStreak,delta.bestStreak)};
}
export function pullQuiz(remote:QuizProgress,current:QuizProgress,sync:QuizSync,revision:number){
 if(sync.pending||revision<sync.revision)return {quiz:current,quizSync:sync};
 return {quiz:addQuiz(remote,quizDelta(sync.baseline,current)),quizSync:{baseline:remote,pending:null,revision}};
}
export function acknowledgeQuiz(remote:QuizProgress,current:QuizProgress,pending:QuizPending,revision:number){
 return {quiz:addQuiz(remote,quizDelta(pending.sent,current)),quizSync:{baseline:remote,pending:null,revision}};
}
export function readQuizSync(value:unknown):QuizSync{
 const s=(value&&typeof value==='object'?value:{}) as Partial<QuizSync>;
 const p=s.pending;
 return {baseline:readQuiz(s.baseline),revision:count(s.revision,Number.MAX_SAFE_INTEGER),pending:p&&typeof p.id==='string'&&uuidPattern.test(p.id)?{id:p.id,delta:readQuiz(p.delta),sent:readQuiz(p.sent)}:null};
}
export function readQuizImports(value:unknown):Record<string,QuizProgress>{
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return Object.fromEntries(Object.entries(value).filter(([id])=>uuidPattern.test(id)).map(([id,q])=>[id,readQuiz(q)]));
}
export function importGuestQuiz(current:QuizProgress,imports:Record<string,QuizProgress>,source:string,guest:QuizProgress){
 if(!uuidPattern.test(source))return {quiz:current,quizImports:imports};
 const previous=imports[source]||emptyQuiz;
 // Repeated imports from this guest browser only add newly answered questions.
 const checkpoint=Object.fromEntries(Object.keys(emptyQuiz).map(key=>[key,Math.max(previous[key as keyof QuizProgress],guest[key as keyof QuizProgress])])) as QuizProgress;
 return {quiz:addQuiz(current,quizDelta(previous,checkpoint)),quizImports:{...imports,[source]:checkpoint}};
}
