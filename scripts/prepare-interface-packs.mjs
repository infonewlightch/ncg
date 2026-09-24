/** Generate only the app's public UI catalogue through its bounded translation API. */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {interfaceSource,interfaceRevision,interfaceBatch,interfaceBatchSize,validInterfaceMessages} from '../src/core/interface-catalogue.ts';
const languages=process.argv.slice(2);if(!languages.length)throw Error('Pass exact language tags.');
const root='/tmp/ncg-interface-packs';mkdirSync(root,{recursive:true});const count=Math.ceil(interfaceSource.length/interfaceBatchSize);
for(const language of languages){
 if(new Intl.Locale(language).toString()!==language)throw Error('Use canonical language tags.');
 const path=`${root}/${language}.json`;let result={revision:interfaceRevision,language,batches:{}};
 if(existsSync(path)){const previous=JSON.parse(readFileSync(path));if(previous.revision===interfaceRevision&&previous.language===language)result=previous;}
 const queue=Array.from({length:count},(_,batch)=>batch).filter(batch=>!validInterfaceMessages(result.batches[batch]?.messages,interfaceBatch(batch)));
 const worker=async()=>{while(queue.length){const batch=queue.shift();try{const r=await fetch('https://newlightchurchglobal.com/api/interface-translation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language,batch,revision:interfaceRevision}),signal:AbortSignal.timeout(35000)});const data=await r.json();const ok=r.ok&&data.language===language&&data.revision===interfaceRevision&&data.batch===batch&&validInterfaceMessages(data.messages,interfaceBatch(batch));result.batches[batch]=ok?{messages:data.messages}:{error:data.error||'invalid_response',status:r.status};console.log(JSON.stringify({language,batch,status:r.status,ok}));if(r.status===429){queue.length=0;}}catch(error){result.batches[batch]={error:error.name};console.log(JSON.stringify({language,batch,error:error.name}));}writeFileSync(path,JSON.stringify(result,null,2));}};
 await Promise.all([worker(),worker()]);
 const complete=Array.from({length:count},(_,i)=>i).every(batch=>validInterfaceMessages(result.batches[batch]?.messages,interfaceBatch(batch)));
 if(!complete){process.exitCode=1;console.log(JSON.stringify({language,complete:false}));continue;}
 const messages=Object.fromEntries(Object.values(result.batches).flatMap(batch=>batch.messages).map(m=>[interfaceSource[m.id].en,m.text]));mkdirSync('src/i18n-generated',{recursive:true});writeFileSync(`src/i18n-generated/${language}.json`,JSON.stringify({language,reviewed:false,provider:[...new Set(Object.values(result.batches).map(batch=>batch.provider||'Netlify AI Gateway / gpt-4.1-mini'))].join('; '),generated:new Date().toISOString().slice(0,10),messages},null,2)+'\n');console.log(JSON.stringify({language,complete:true,messages:Object.keys(messages).length}));
}
