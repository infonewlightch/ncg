import {interfaceSource,interfaceBatch,interfaceBatchSize,validInterfaceMessages} from '../../src/core/interface-catalogue.ts';
export function validPackMessages(pack){
 const messages={};
 for(const [id,{en,ko}] of interfaceSource.entries()){
  const text=pack?.messages?.[en];
  if(pack?.sourceContext?.[en]!==undefined&&pack.sourceContext[en]!==ko)continue;
  if(validInterfaceMessages([{id,text}],[{id,en}]))messages[en]=text;
 }
 return messages;
}
export function pendingPackBatches(messages){return Array.from({length:Math.ceil(interfaceSource.length/interfaceBatchSize)},(_,batch)=>batch).filter(batch=>interfaceBatch(batch).some(row=>!messages[row.en]));}
export function acceptedBatch(data,language,batch,revision){return data?.language===language&&data.revision===revision&&data.batch===batch&&validInterfaceMessages(data.messages,interfaceBatch(batch));}
export function generationAction(status,error){
 if(status===409||status===429||status===401||status===403||error==='translation_not_configured')return 'stop';
 if(status===422&&error==='unsupported_language')return 'skip-language';
 return status>=500?'retry':'fail';
}
