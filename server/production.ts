import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {interfaceTranslationNode} from './interface-translation.ts';
import {bibleTranslationNode} from './bible-translation.ts';
import {bibleSourceHandler} from './bible-source.ts';
import {createGateway} from './gateway.ts';
// @ts-ignore Server-only JavaScript module.
import {pushConfiguration} from './push-worker.mjs';
const TYPES:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
export function preferredEncoding(accepted:string){
 const weights=new Map(accepted.toLowerCase().split(',').map(item=>{const [name,...params]=item.trim().split(';');const q=params.find(p=>p.trim().startsWith('q='));const weight=q?Number(q.trim().slice(2)):1;return [name,Number.isFinite(weight)&&weight>=0&&weight<=1?weight:0] as const;}));
 const weight=(name:string)=>weights.get(name)??weights.get('*')??0;
 return weight('br')>0&&weight('br')>=weight('gzip')?'br':weight('gzip')>0?'gzip':'';
}
export function securityHeaders(env:Record<string,string>){
 let supabase='';try{const url=new URL(env.VITE_SUPABASE_URL);if(url.protocol==='https:')supabase=` ${url.origin} wss://${url.host}`;}catch{}
 return {'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' https:; connect-src 'self'${supabase}; frame-src https://www.youtube-nocookie.com https://www.youtube.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`};
}
export function createProductionHandler(env:Record<string,string>,dist=resolve(fileURLToPath(new URL('../dist',import.meta.url))),gateway=createGateway(env)){
 const origin=new URL(env.NCG_PUBLIC_ORIGIN||'http://127.0.0.1:4311');const headers=securityHeaders(env);const compressed=new Map<string,Buffer>();
 return async(req:IncomingMessage,res:ServerResponse)=>{
  for(const [name,value] of Object.entries(headers))res.setHeader(name,value);
  const fail=(status:number)=>{res.writeHead(status,{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'});res.end(status===404?'Not found':'Request could not be completed');};
  try{
   if(req.headers.host!==origin.host)return fail(421);
   const url=new URL(req.url||'/',origin);if(url.origin!==origin.origin)return fail(403);
   if(url.pathname==='/api/push-status'){
    if(req.method!=='GET')return fail(405);
    const configured=pushConfiguration(env);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({configured,...(configured?{publicKey:env.NCG_VAPID_PUBLIC_KEY}:{})}));return;
   }
   if(url.pathname==='/api/interface-translation'){await interfaceTranslationNode(req,res,env);return;}
   if(url.pathname==='/api/bible-translation'){await bibleTranslationNode(req,res,env);return;}
   if(url.pathname==='/api/bible-source'){await bibleSourceHandler(req,res);return;}
   if(url.pathname.startsWith('/api/')){await gateway(req,res);return;}
   if(req.method!=='GET'&&req.method!=='HEAD')return fail(405);
   let pathname=decodeURIComponent(url.pathname);if(pathname.includes('\0')||pathname.includes('\\'))return fail(400);
   if(pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({status:'ok'}));return;}
   if(pathname==='/'||pathname==='/auth/callback')pathname='/index.html';
   const root=await realpath(dist);let file:string;try{file=await realpath(resolve(root,`.${pathname}`));}catch{return fail(404);}
   if(!file.startsWith(root+sep)||pathname.split('/').some(part=>part.startsWith('.')))return fail(404);
   const info=await stat(file);if(!info.isFile())return fail(404);
   const type=TYPES[extname(file)]||'application/octet-stream';const privateShell=pathname.endsWith('.html')||pathname==='/sw.js';
   res.setHeader('Content-Type',type);res.setHeader('Cache-Control',privateShell?'no-store':pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'public, max-age=3600');
   if(pathname==='/admin.html')res.setHeader('X-Robots-Tag','noindex, nofollow');
   let data:Buffer=await readFile(file);const compressible=data.length>1024&&/^(text\/|application\/(json|manifest))/.test(type);const encoding=compressible?preferredEncoding(req.headers['accept-encoding']||''):'';
   if(compressible)res.setHeader('Vary','Accept-Encoding');
   if(encoding){const key=`${file}:${info.mtimeMs}:${encoding}`;let zipped=compressed.get(key);if(!zipped){zipped=encoding==='br'?brotliCompressSync(data):gzipSync(data);if(compressed.size>=150)compressed.clear();compressed.set(key,zipped);}data=zipped;res.setHeader('Content-Encoding',encoding);}
   res.setHeader('Content-Length',data.length);res.statusCode=200;res.end(req.method==='HEAD'?undefined:data);
  }catch{if(!res.headersSent)fail(500);else res.end();}
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const env=Object.fromEntries(Object.entries(process.env).filter((entry):entry is [string,string]=>typeof entry[1]==='string'));
 const origin=new URL(env.NCG_PUBLIC_ORIGIN||'http://127.0.0.1:4311');if(origin.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(origin.hostname))throw Error('NCG_PUBLIC_ORIGIN must use HTTPS outside localhost.');
 const server=createServer({maxHeaderSize:16384,requestTimeout:30000,headersTimeout:15000},createProductionHandler(env));
 server.listen(Number(env.NCG_PORT)||4311,env.NCG_BIND||'127.0.0.1',()=>console.log('NCG production server is ready.'));
}
