import fs from 'node:fs';import {createHash} from 'node:crypto';
const manifest=JSON.parse(fs.readFileSync('dist/.vite/manifest.json','utf8'));
const paths=new Set(['/offline-entry.html','/offline.html','/brand/newlight-symbol.png']);const visited=new Set();
function visit(key){if(visited.has(key))return;visited.add(key);const entry=manifest[key];if(!entry)throw Error(`Missing build entry ${key}`);paths.add(`/${entry.file}`);for(const path of [...entry.css||[],...entry.assets||[]])paths.add(`/${path}`);for(const key of [...entry.imports||[],...entry.dynamicImports||[]])visit(key);}
visit('index.html');
// Hosts may inject a toolbar/comment into served HTML. JSON transports preserve
// the build bytes; the verified entry is separate from online navigation caches.
const files=[...paths].sort().map(path=>{const body=fs.readFileSync(path==='/offline-entry.html'?'dist/index.html':`dist${path}`);let source;
 if(path.endsWith('.html')){source=`${path}.json`;fs.writeFileSync(`dist${source}`,JSON.stringify({html:body.toString('utf8')}));}
 return {path,...source?{source}:{},bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')};});
const revision=createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,20);
fs.writeFileSync('dist/offline-shell.json',JSON.stringify({revision,files}));
console.log(`Offline public app: ${files.length} files, ${files.reduce((n,f)=>n+f.bytes,0)} bytes. Admin entry excluded.`);
