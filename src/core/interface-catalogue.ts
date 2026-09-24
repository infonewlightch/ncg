import source from '../i18n/source.json' with {type:'json'};
// Both ends use the same build catalogue: callers cannot submit arbitrary text.
export const interfaceBatchSize=24;
export const interfaceSource=source;
export const interfaceIds=new Map(source.map(({en},id)=>[en,id]));
let hash=2166136261;for(const char of JSON.stringify(source)){hash=Math.imul(hash^char.charCodeAt(0),16777619);}
export const interfaceRevision=(hash>>>0).toString(36);
export function interfaceBatch(batch:number){return source.slice(batch*interfaceBatchSize,(batch+1)*interfaceBatchSize).map((row,i)=>({...row,id:batch*interfaceBatchSize+i}));}
export function validInterfaceMessages(messages:unknown,rows:{id:number;en:string}[]):messages is {id:number;text:string}[]{
 if(!Array.isArray(messages)||messages.length!==rows.length)return false;
 const slots=(s:string)=>JSON.stringify((s.match(/\{[A-Za-z0-9_]+\}|https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi)||[]).sort());
 return messages.every((m,i)=>m&&m.id===rows[i].id&&typeof m.text==='string'&&m.text.trim().length>0&&m.text.length<6000&&!/[<>]/.test(m.text)&&slots(m.text)===slots(rows[i].en));
}
