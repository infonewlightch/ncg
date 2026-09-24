import fs from 'node:fs';

// The full catalogues remain research inputs; readers only download approved editions.
const read=name=>JSON.parse(fs.readFileSync(`src/data/${name}.json`,'utf8'));
const policy=read('bible-policy');
const output={};
for(const [provider,source] of [['ebible','bible-catalogue'],['getbible','getbible-catalogue']]){
 const candidates=read(source).versions;
 output[provider]=policy[provider].map(id=>{
  const matches=candidates.filter(version=>version.id===id);
  if(matches.length!==1)throw Error(`Expected one ${provider} source for ${id}`);
  return matches[0];
 });
}
const target='src/data/bible-reader-catalogue.json';
const serialized=JSON.stringify(output)+'\n';
if(process.argv.includes('--check')){
 if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==serialized)throw Error('Bible reader catalogue is stale. Run npm run bible:catalogue.');
}else fs.writeFileSync(target,serialized);
console.log(`Approved Bible catalogue: ${output.ebible.length} eBible / ${output.getbible.length} getBible sources, ${Buffer.byteLength(serialized)} bytes.`);
