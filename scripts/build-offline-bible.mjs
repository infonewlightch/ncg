import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root='public/bibles/webp';
const index=JSON.parse(fs.readFileSync(`${root}/index.json`,'utf8'));
fs.mkdirSync(`${root}/offline`,{recursive:true});
const files=[];
function record(path,book){const body=fs.readFileSync(`public${path}`);return {path,book,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')};}
files.push(record('/bibles/webp/index.json','index'));
for(const book of index.books){
 const chapters=Object.fromEntries(book.chapters.map(chapter=>{const id=`${book.id}.${chapter.id}`;return [id,JSON.parse(fs.readFileSync(`${root}/${id}.json`,'utf8'))];}));
 fs.writeFileSync(`${root}/offline/${book.id}.json`,JSON.stringify(chapters));
 files.push(record(`/bibles/webp/offline/${book.id}.json`,book.id));
}
const revision=createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,20);
fs.writeFileSync('src/data/offline-webp.json',JSON.stringify({revision,bytes:files.reduce((n,f)=>n+f.bytes,0),files},null,2)+'\n');
console.log(`WEBP offline: ${index.books.length} books, ${files.reduce((n,f)=>n+f.bytes,0)} bytes.`);
