import fs from 'node:fs';import ts from 'typescript';
const messages=new Map();const dynamic=[];
const add=(ko,en)=>{if(typeof ko==='string'&&typeof en==='string'&&ko&&en&&!messages.has(en))messages.set(en,{en,ko});};
function walkFile(file){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 function visit(node){
  if(ts.isCallExpression(node)&&(/^(t|this\.props\.t)$/.test(node.expression.getText(source)))&&node.arguments.length===2){
   if(node.arguments.every(ts.isStringLiteralLike))add(node.arguments[0].text,node.arguments[1].text);else dynamic.push({file,call:node.getText(source)});
  }
  if(ts.isObjectLiteralExpression(node)){
   const props=Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).filter(p=>ts.isStringLiteralLike(p.initializer)).map(p=>[p.name.getText(source),p.initializer.text]));
   add(props.ko,props.en);add(props.subko,props.suben);add(props.address,props.englishAddress);
  }
  if(ts.isArrayLiteralExpression(node)&&node.elements.every(ts.isStringLiteralLike)){
   const values=node.elements.map(v=>v.text);
   for(let i=0;i+1<values.length;i++)if(/[가-힣]/.test(values[i])&&!/[가-힣]/.test(values[i+1]))add(values[i],values[i+1]);
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
}
for(const file of fs.readdirSync('src',{recursive:true}).filter(f=>/\.tsx?$/.test(f)&&!f.includes('.test.')).sort())walkFile(`src/${file}`);
for(const book of JSON.parse(fs.readFileSync('src/data/bible-books.json','utf8')))add(book.ko,book.en);
const result=[...messages.values()];
const serialized=JSON.stringify(result,null,2)+'\n';
if(process.argv.includes('--check')){
 if(fs.readFileSync('src/i18n/source.json','utf8')!==serialized)throw Error('UI catalogue changed. Run npm run i18n:extract, then complete each language pack.');
 const packs=[...fs.readdirSync('src/i18n').filter(file=>file.endsWith('.json')&&file!=='source.json').map(file=>`src/i18n/${file}`),...fs.readdirSync('src/i18n-generated').filter(file=>file.endsWith('.json')).map(file=>`src/i18n-generated/${file}`)];
 for(const file of packs){
  const data=JSON.parse(fs.readFileSync(file,'utf8'));const pack=file.includes('i18n-generated')?data.messages:data;
  if(file.includes('i18n-generated')){
   if(file.split('/').pop()!==`${data.language}.json`)throw Error(`${file}: language tag mismatch`);
   if(new Intl.Locale(data.language).toString()!==data.language)throw Error(`${file}: use a canonical language tag so the browser can load this pack`);
   for(const row of result)if(data.sourceContext?.[row.en]!==row.ko)throw Error(`${file}: changed or missing source context for ${row.en}`);
  }
  const missing=result.filter(({en})=>typeof pack[en]!=='string'||!pack[en].trim());
  if(missing.length)throw Error(`${file}: ${missing.length} UI translations missing: ${missing.slice(0,5).map(row=>row.en).join(' | ')}`);
  for(const {en} of result){const slots=value=>JSON.stringify((value.match(/\{[A-Za-z0-9_]+\}/g)||[]).sort());if(slots(en)!==slots(pack[en]))throw Error(`${file}: changed placeholders in ${en}`);}
 }
}else fs.writeFileSync('src/i18n/source.json',serialized);
console.log(`${result.length} unique UI messages. ${dynamic.length} dynamic calls (paired data included).`);
