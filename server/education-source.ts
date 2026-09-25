import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import courses from '../src/data/courses/en.json' with {type:'json'};
import catechism from '../src/data/catechism/en.json' with {type:'json'};
import {educationMessages,type EducationKind} from '../src/core/education-content.ts';
export type EducationSourceUnit={id:string;kind:EducationKind;data:unknown;messages:Record<string,string>};
let quizBank:Promise<Map<string,unknown>>|undefined;
export function educationUnitId(value:unknown):value is string{return typeof value==='string'&&(value==='catalogue'||/^lesson:(?:newcomer|baptism|confirmation|deep):[1-9]\d?$/.test(value)||/^catechism:(?:[0-9]|10)$/.test(value)||/^quiz:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));}
export async function getEducationUnit(id:string):Promise<EducationSourceUnit|null>{
 if(!educationUnitId(id))return null;let kind:EducationKind,data:unknown;
 if(id==='catalogue'){kind='catalogue';data=courses.map(({slug,title,subtitle,lessons})=>({slug,title,subtitle,lessons:lessons.map(({id,title})=>({id,title}))}));}
 else if(id.startsWith('lesson:')){kind='lesson';const [,slug,number]=id.split(':');data=courses.find(course=>course.slug===slug)?.lessons.find(lesson=>lesson.id===number);}
 else if(id.startsWith('catechism:')){kind='catechism';const page=Number(id.split(':')[1]);data=catechism.slice(page*10,page*10+10);}
 else{kind='quiz';quizBank??=readFile(join(process.cwd(),'public/quizzes/en.json'),'utf8').then(raw=>{const items=JSON.parse(raw);if(!Array.isArray(items))throw Error('invalid_quiz_bank');return new Map(items.map(item=>[item.id,item]));}).catch(error=>{quizBank=undefined;throw error;});data=(await quizBank).get(id.slice(5));}
 if(!data)return null;return {id,kind,data,messages:educationMessages(kind,data)};
}
