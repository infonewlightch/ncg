/** Pregenerate public UI only. Never bypass the provider's shared request budget. */
import {readFileSync,readdirSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {interfaceSource,interfaceRevision,interfaceBatch} from '../src/core/interface-catalogue.ts';
import {validPackMessages,pendingPackBatches,acceptedBatch,generationAction} from './lib/interface-packs.mjs';
const args=process.argv.slice(2),all=args.includes('--all'),plan=args.includes('--plan');
const written=JSON.parse(readFileSync('src/data/languages.json')).filter(row=>row.type==='living'&&!['ko','en','es'].includes(row.code)&&!/sign language/i.test(row.name)).map(row=>new Intl.Locale(row.code).toString());
const existing=readdirSync('src/i18n-generated').filter(name=>name.endsWith('.json')).map(name=>name.slice(0,-5));
const languages=all?[...new Set([...existing,'lo','ja','vi','id','ru','sw',...written])]:args.filter(arg=>!arg.startsWith('--'));
if(!languages.length)throw Error('Pass exact language tags, or --all [--plan].');
const maxArg=args.find(arg=>arg.startsWith('--max-requests='));const maxRequests=maxArg?Number(maxArg.split('=')[1]):240;
if(!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>300)throw Error('max-requests must be 1–300; the shared server budget still applies.');
const root='tmp/interface-packs';mkdirSync(root,{recursive:true});mkdirSync('src/i18n-generated',{recursive:true});let requests=0,stopped=false,completed=0,pending=0,unsupported=0;
function read(path){try{return JSON.parse(readFileSync(path,'utf8'));}catch{return null;}}
function atomic(path,data){writeFileSync(`${path}.pending`,JSON.stringify(data,null,2)+'\n');renameSync(`${path}.pending`,path);}
for(const language of languages){
 if(new Intl.Locale(language).toString()!==language)throw Error('Use canonical language tags.');
 const path=`${root}/${language}.json`,output=`src/i18n-generated/${language}.json`;
 const previous=read(output),checkpoint=read(path);
 const messages={...validPackMessages(previous),...validPackMessages(checkpoint?.language===language?checkpoint:null)};
 const batches=pendingPackBatches(messages);
 if(batches.length&&checkpoint?.unsupportedRevision===interfaceRevision&&!args.includes('--retry-unsupported')){unsupported++;if(plan)console.log(JSON.stringify({language,unsupported:true}));continue;}
 if(plan){console.log(JSON.stringify({language,messages:Object.keys(messages).length,missing:interfaceSource.length-Object.keys(messages).length,batches:batches.length}));if(batches.length)pending++;else completed++;continue;}
 if(stopped){pending++;continue;}
 const result={language,reviewed:false,provider:[...new Set([previous?.provider,checkpoint?.provider,...(batches.length?['Netlify AI Gateway / gpt-4.1-mini']:[])].filter(Boolean))].join('; '),generated:new Date().toISOString().slice(0,10),sourceContext:Object.fromEntries(interfaceSource.map(row=>[row.en,row.ko])),messages};
 if(!batches.length){if(pendingPackBatches(validPackMessages(previous)).length)atomic(output,result);completed++;continue;}
 let unavailable=false;
 for(const batch of batches){
  for(let attempt=0;attempt<2;attempt++){
   if(requests>=maxRequests){stopped=true;break;}
   requests++;
   try{
    const r=await fetch('https://newlightchurchglobal.com/api/interface-translation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language,batch,revision:interfaceRevision}),signal:AbortSignal.timeout(35000)});
    const data=await r.json();const ok=r.ok&&acceptedBatch(data,language,batch,interfaceRevision);
    console.log(JSON.stringify({language,batch,status:r.status,ok,error:ok?undefined:data.error||'invalid_response'}));
    if(ok){for(const m of data.messages)messages[interfaceSource[m.id].en]=m.text;atomic(path,result);break;}
    const action=generationAction(r.status,data.error);
    if(action==='stop'){stopped=true;break;}if(action==='skip-language'){unavailable=true;result.unsupportedRevision=interfaceRevision;break;}if(action!=='retry')break;
   }catch(error){console.log(JSON.stringify({language,batch,error:error.name}));}
   if(attempt===0)await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(stopped||unavailable)break;
 }
 const complete=!pendingPackBatches(messages).length;
 if(complete){atomic(output,result);completed++;}else{pending++;process.exitCode=1;atomic(path,result);}
 console.log(JSON.stringify({language,complete,messages:Object.keys(messages).length,unavailable}));
}
console.log(JSON.stringify({revision:interfaceRevision,targets:languages.length,completed,pending,unsupported,requests,stopped}));
if(stopped)process.exitCode=1;
