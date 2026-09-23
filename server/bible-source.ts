import type {IncomingMessage,ServerResponse} from 'node:http';
import catalogue from '../src/data/bible-catalogue.json' with {type:'json'};

const permitted=new Set(catalogue.versions.filter(v=>v.redistributable).map(v=>v.id));
const cache=new Map<string,{html:string;until:number}>();let active=0;
export async function bibleSourceHandler(req:IncomingMessage,res:ServerResponse,fetcher:typeof fetch=fetch){
 const json=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':status===200?'public, max-age=3600':'no-store'});res.end(JSON.stringify(data));};
 if(req.method!=='GET')return json(405,{error:'method_not_allowed'});
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return json(403,{error:'origin_not_allowed'});}catch{return json(403,{error:'origin_not_allowed'});}}
 const url=new URL(req.url||'/','http://ncg.local');const id=url.searchParams.get('version')||'',file=url.searchParams.get('file')||'';
 if(!permitted.has(id)||!/^[a-zA-Z0-9_-]+$/.test(id)||!/^(?:index|copyright|[A-Z0-9]{3}(?:\d{2,3})?)\.htm$/.test(file))return json(400,{error:'invalid_source'});
 const key=`${id}/${file}`;const stored=cache.get(key);if(stored&&stored.until>Date.now())return json(200,{html:stored.html});
 if(active>=6)return json(429,{error:'bible_busy'});active++;
 try{
  const response=await fetcher(`https://ebible.org/${key}`,{redirect:'error',signal:AbortSignal.timeout(18000),headers:{Accept:'text/html','User-Agent':'NCG-Bible-Reader/1.0 (newlightchurchglobal.com)'}});
  if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('source_unavailable');
  const reader=response.body?.getReader();if(!reader)throw Error('empty_source');const chunks:Uint8Array[]=[];let bytes=0;
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1500000){await reader.cancel();throw Error('source_too_large');}chunks.push(value);}
  const html=Buffer.concat(chunks).toString('utf8');if(!/<html[\s>]/i.test(html))throw Error('invalid_source');
  if(cache.size>=80)cache.delete(cache.keys().next().value!);cache.set(key,{html,until:Date.now()+3600000});return json(200,{html});
 }catch{return json(502,{error:'bible_source_unavailable'});}finally{active--;}
}
