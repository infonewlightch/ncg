import type {IncomingMessage,ServerResponse} from 'node:http';

/** Provider content is passed through unchanged; credentials never leave this boundary. */
export async function bibleHandler(req:IncomingMessage,res:ServerResponse,env:Record<string,string>,fetcher:typeof fetch=fetch){
 const json=(status:number,body:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
 if(req.method!=='GET')return json(405,{error:'method_not_allowed'});
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return json(403,{error:'origin_not_allowed'});}catch{return json(403,{error:'origin_not_allowed'});}}
 const url=new URL(req.url||'/','http://ncg.local');
 const version=url.searchParams.get('version')||'';
 const passage=url.searchParams.get('passage')||'';
 const language=url.searchParams.get('language')||'';
 if(!['/versions','/index','/passage'].includes(url.pathname))return json(404,{error:'not_found'});
 if(url.pathname==='/versions'?!/^(\*|[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*)$/.test(language):!/^\d{1,9}$/.test(version))return json(400,{error:'invalid_request'});
 if(url.pathname==='/passage'&&!/^[A-Z0-9]{3}\.[1-9]\d{0,2}(?:\.[1-9]\d{0,2}(?:-[1-9]\d{0,2})?)?$/.test(passage))return json(400,{error:'invalid_request'});
 if(!env.NCG_YOUVERSION_APP_KEY)return json(503,{error:'bible_not_configured'});
 const signal=AbortSignal.timeout(20000);
 async function get(path:string,params:Record<string,string>={}){
  const endpoint=new URL(path,'https://api.youversion.com');
  for(const [key,value] of Object.entries(params))endpoint.searchParams.set(key,value);
  const response=await fetcher(endpoint,{headers:{'X-YVP-App-Key':env.NCG_YOUVERSION_APP_KEY,Accept:'application/json'},signal,redirect:'error'});
  if(response.status===204)return {data:[]};
  if(!response.ok)throw Error('provider_unavailable');
  return response.json();
 }
 try{
  if(url.pathname==='/versions'){
   const data:unknown[]=[];const seen=new Set<string>();let token='';
   do{
    const page=await get('/v1/bibles',{'language_ranges[]':language,all_available:'false',page_size:'99',...(token?{page_token:token}:{})});
    if(!Array.isArray(page.data))throw Error('invalid_catalogue');
    data.push(...page.data);token=page.next_page_token||'';
    if(token&&seen.has(token))throw Error('repeated_page');
    if(token)seen.add(token);
   }while(token);
   return json(200,{data});
  }
  if(url.pathname==='/index')return json(200,await get(`/v1/bibles/${version}/index`));
  return json(200,await get(`/v1/bibles/${version}/passages/${encodeURIComponent(passage)}`,{format:'text'}));
 }catch{return json(502,{error:'bible_unavailable'});}
}
