/** Hash of education-v1 + the canonical English course, catechism and quiz files. */
export const educationRevision='de40047526d65e9f89ee';
export type EducationKind='catalogue'|'lesson'|'catechism'|'quiz';
export type EducationUnitTranslation={id:string;messages:Record<string,string>};
export type EducationTranslationResult={language:string;revision:string;reviewed:false;complete:boolean;units:EducationUnitTranslation[]};
export type EducationCatalogue={slug:string;title:string;subtitle:string;lessons:{id:string;title:string}[]}[];
export type EducationCatechism={n:number;q:string;a:string};
/** Only these prose fields are translated. Answers, IDs, references and classification never enter the mapping. */
export function educationMessages(kind:EducationKind,data:unknown):Record<string,string>{
 const result:Record<string,string>={};const source=data as any;
 const add=(path:string,value:unknown)=>{if(typeof value!=='string'||!value.trim())throw Error('invalid_education_source');result[path]=value;};
 if(kind==='catalogue')source.forEach((course:any,i:number)=>{add(`${i}.title`,course.title);add(`${i}.subtitle`,course.subtitle);course.lessons.forEach((lesson:any,j:number)=>add(`${i}.lessons.${j}.title`,lesson.title));});
 if(kind==='lesson'){
  add('title',source.title);add('verse',source.verse);source.teaching.forEach((value:string,i:number)=>add(`teaching.${i}`,value));
  source.questions.forEach((question:any,i:number)=>{add(`questions.${i}.question`,question.question);question.options.forEach((value:string,j:number)=>add(`questions.${i}.options.${j}`,value));add(`questions.${i}.explanation`,question.explanation);});
 }
 if(kind==='catechism')source.forEach((item:any,i:number)=>{add(`${i}.q`,item.q);add(`${i}.a`,item.a);});
 if(kind==='quiz'){add('question',source.question);source.options.forEach((value:string,i:number)=>add(`options.${i}`,value));add('hint',source.hint);add('explanation',source.explanation);}
 if(!Object.keys(result).length)throw Error('invalid_education_source');return result;
}
export function validEducationMessages(value:unknown,source:Record<string,string>):value is Record<string,string>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const messages=value as Record<string,unknown>,keys=Object.keys(source);
 return Object.keys(messages).length===keys.length&&keys.every(key=>Object.hasOwn(messages,key)&&typeof messages[key]==='string'&&messages[key].trim().length>0&&messages[key].length<=12000&&!/[<>]/.test(messages[key]));
}
export function applyEducationMessages<T>(kind:EducationKind,data:T,messages:Record<string,string>):T{
 if(!validEducationMessages(messages,educationMessages(kind,data)))throw Error('invalid_education_translation');
 const result=JSON.parse(JSON.stringify(data));
 for(const [path,text] of Object.entries(messages)){const parts=path.split('.');let node=result;for(const part of parts.slice(0,-1))node=node[part];node[parts.at(-1)!]=text;}
 return result;
}
