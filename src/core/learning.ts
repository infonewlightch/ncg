export function shuffleOptions(q:{options:string[];answer:number},seed:number){
  const n=q.options.length;
  const shift=n>1?1+(Math.abs(seed)%(n-1)):0;
  const options=q.options.slice(shift).concat(q.options.slice(0,shift));
  return {options,answer:(q.answer-shift+n)%n};
}
export function completeLesson(ids:string[],id:string){ return Array.from(new Set([...ids,id])); }
