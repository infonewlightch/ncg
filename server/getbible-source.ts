import type {IncomingMessage,ServerResponse} from 'node:http';
import catalogue from '../src/data/getbible-catalogue.json' with {type:'json'};
const permitted=new Set(catalogue.versions.filter(v=>v.license==='Public Domain').map(v=>v.id));
const cache=new Map<string,{data:unknown;until:number}>();let active=0;
export async function getBibleSource(req:IncomingMessage,res:ServerResponse,fetcher:typeof fetch=fetch){
 const json=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':status===200?'public, max-age=3600':'no-store'});res.end(JSON.stringify(data));};
 const url=new URL(req.url||'/','http://ncg.local');const id=url.searchParams.get('version')||'',resource=url.searchParams.get('resource'),book=url.searchParams.get('book')||'',chapter=url.searchParams.get('chapter')||'';
 if(!permitted.has(id)||!/^[a-z0-9_-]+$/i.test(id)||!['index','book','passage'].includes(resource||'')||(resource!=='index'&&!/^[1-9]\d?$/.test(book))||(resource==='passage'&&!/^[1-9]\d{0,2}$/.test(chapter)))return json(400,{error:'invalid_source'});
 const path=resource==='index'?`${id}/books.json`:resource==='book'?`${id}/${book}/chapters.json`:`${id}/${book}/${chapter}.json`;
 const stored=cache.get(path);if(stored&&stored.until>Date.now())return json(200,stored.data);
 if(active>=6)return json(429,{error:'bible_busy'});active++;
 try{
  const response=await fetcher(`https://api.getbible.net/v2/${path}`,{redirect:'error',signal:AbortSignal.timeout(18000),headers:{Accept:'application/json'}});
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error();
  const reader=response.body?.getReader();if(!reader)throw Error();let bytes=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1500000){await reader.cancel();throw Error();}chunks.push(value);}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw Error();
  if(cache.size>=80)cache.delete(cache.keys().next().value!);cache.set(path,{data,until:Date.now()+3600000});return json(200,data);
 }catch{return json(502,{error:'bible_source_unavailable'});}finally{active--;}
}
