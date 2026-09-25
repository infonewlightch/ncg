/** Fixed public lessons only. Uses the existing shared UI/education daily budget. */
import {readFileSync,readdirSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {educationRevision,validEducationMessages} from '../src/core/education-content.ts';
import {getEducationUnit} from '../server/education-source.ts';
const args=process.argv.slice(2),plan=args.includes('--plan'),catalogueOnly=args.includes('--catalogue-only');
const max=Number(args.find(arg=>arg.startsWith('--max-requests='))?.split('=')[1]||240);
if(!Number.isInteger(max)||max<1||max>300)throw Error('max-requests must be 1–300. The shared daily budget still applies.');
const endpoint=new URL(process.env.NCG_EDUCATION_ORIGIN||'https://newlightchurchglobal.com');
if(endpoint.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(endpoint.hostname))throw Error('HTTPS required.');
const available=readdirSync('src/i18n-generated').filter(name=>name.endsWith('.json')).map(name=>name.slice(0,-5));
const languages=[...new Set(args.includes('--ui')?['es',...available]:args.filter(arg=>!arg.startsWith('--'))) ].filter(language=>!['ko','en','th'].includes(language));
if(!languages.length)throw Error('Supply exact language tags or --ui.');
const courses=JSON.parse(readFileSync('src/data/courses/en.json','utf8'));
const ids=['catalogue',...courses.flatMap(course=>course.lessons.map(lesson=>`lesson:${course.slug}:${lesson.id}`)),...Array.from({length:11},(_,i)=>`catechism:${i}`)];
const all=await Promise.all((catalogueOnly?ids.slice(0,1):ids).map(getEducationUnit));
const extra=Number(args.find(arg=>arg.startsWith('--quiz-count='))?.split('=')[1]||0);
if(!Number.isInteger(extra)||extra<0||extra>3004)throw Error('quiz-count must be 0–3004.');
if(extra){const quiz=JSON.parse(readFileSync('public/quizzes/en.json','utf8'));for(const item of quiz.slice(0,extra))all.push(await getEducationUnit(`quiz:${item.id}`));}
let requests=0,stopped=false,completed=0,pending=0;
const root=`public/education/${educationRevision}`;if(!plan)mkdirSync(root,{recursive:true});
function read(path){try{return JSON.parse(readFileSync(path,'utf8'));}catch{return null;}}
function save(path,data){writeFileSync(path+'.pending',JSON.stringify(data)+'\n');renameSync(path+'.pending',path);}
for(const language of languages){
 if(new Intl.Locale(language).toString()!==language)throw Error(`Use canonical language: ${language}`);
 const path=`${root}/${language}.json`,previous=read(path);
 const units=new Map(previous?.revision===educationRevision&&previous.language===language&&Array.isArray(previous.units)?previous.units.map(unit=>[unit.id,unit]):[]);
 const missing=all.filter(source=>!validEducationMessages(units.get(source.id)?.messages,source.messages));
 const groups=[];let group=[],chars=0,fields=0;
 for(const source of missing){const values=Object.values(source.messages),size=values.reduce((n,text)=>n+text.length,0);if(group.length&&(group.length===5||chars+size>5000||fields+values.length>100)){groups.push(group);group=[];chars=0;fields=0;}group.push(source);chars+=size;fields+=values.length;}if(group.length)groups.push(group);
 if(plan){console.log(JSON.stringify({language,ready:all.length-missing.length,missing:missing.length,requests:groups.length}));continue;}
 for(const batch of groups){
  if(stopped||requests>=max){stopped=true;break;}
  requests++;
  let ok=false;
  try{
   const response=await fetch(new URL('/api/education-translation',endpoint),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language,revision:educationRevision,units:batch.map(source=>source.id)}),signal:AbortSignal.timeout(35000)});
   const data=await response.json();ok=response.ok&&data.language===language&&data.revision===educationRevision&&data.reviewed===false&&data.complete===true&&Array.isArray(data.units)&&data.units.length===batch.length&&batch.every(source=>{const matches=data.units.filter(unit=>unit.id===source.id);return matches.length===1&&validEducationMessages(matches[0].messages,source.messages);});
   console.log(JSON.stringify({language,units:batch.map(source=>source.id),status:response.status,ok,...ok?{}:{error:data.error||'invalid_response'}}));
   if(ok){for(const unit of data.units)units.set(unit.id,unit);save(path,{language,revision:educationRevision,reviewed:false,generatedAt:new Date().toISOString(),units:[...units.values()]});}
   else if(['translation_daily_limit','translation_not_configured'].includes(data.error)){stopped=true;break;}
   else if(data.error==='unsupported_language')break;
  }catch(error){console.log(JSON.stringify({language,error:error.name}));}
  // Do not automatically loop on failures or increase the existing shared budget.
 }
 const ready=all.filter(source=>validEducationMessages(units.get(source.id)?.messages,source.messages)).length;
 if(ready===all.length)completed++;else pending++;
 console.log(JSON.stringify({language,ready,total:all.length,complete:ready===all.length}));
}
if(!plan)console.log(JSON.stringify({revision:educationRevision,completed,pending,requests,stopped}));
if(pending||stopped)process.exitCode=1;
