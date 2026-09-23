import type {Question} from './model';
export type BibleQuestion=Question&{id:string;book:string;testament:'old'|'new';level:'easy'|'medium'|'hard';hint:string;lang:string};
export type QuizFilters={level:string;testament:string;book:string;count:number};
export function filterQuestions(bank:BibleQuestion[],filters:QuizFilters){return bank.filter(q=>(filters.level==='all'||q.level===filters.level)&&(filters.testament==='all'||q.testament===filters.testament)&&(!filters.book||q.book===filters.book));}
export function makeRound(bank:BibleQuestion[],filters:QuizFilters,random:()=>number=Math.random){
 const available=filterQuestions(bank,filters);
 for(let i=available.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[available[i],available[j]]=[available[j],available[i]];}
 return available.slice(0,Math.max(1,Math.min(30,filters.count))).map(q=>{
  const answers=q.options.map((text,index)=>({text,correct:index===q.answer}));
  for(let i=answers.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[answers[i],answers[j]]=[answers[j],answers[i]];}
  return {...q,options:answers.map(x=>x.text),answer:answers.findIndex(x=>x.correct)};
 });
}
export function answerPoints(correct:boolean,streak:number,hinted:boolean){return correct?Math.max(5,10+Math.min(streak,5)*2-(hinted?5:0)):0;}
