import fs from 'node:fs';
import crypto from 'node:crypto';
const report=[];
fs.mkdirSync('public/quizzes',{recursive:true});
for(const lang of ['ko','en','th']){
 const file=`/tmp/ncg-dabar-questions-${lang}.json`;
 if(!fs.existsSync(file))continue;
 const original=fs.readFileSync(file);const rows=JSON.parse(original);const seenId=new Set(),seenQuestion=new Set();const data=[];let duplicate=0;
 for(const row of rows){
  if(row.lang!==lang)throw Error(`Language mismatch: ${lang}`);
  if(!row.id||!row.question||!Array.isArray(row.options)||row.options.some(x=>typeof x!=='string')||!Number.isInteger(row.answer)||row.answer<0||row.answer>=row.options.length||!row.explanation||!['easy','medium','hard'].includes(row.level)||!['old','new'].includes(row.testament))throw Error(`Malformed item: ${row.id}`);
  const normalized=row.question.trim().normalize('NFKC');
  if(seenId.has(row.id)||seenQuestion.has(normalized)){duplicate++;continue;}
  seenId.add(row.id);seenQuestion.add(normalized);
  data.push(Object.fromEntries(['id','book','testament','level','question','options','answer','hint','explanation','lang'].map(k=>[k,row[k]])));
 }
 fs.writeFileSync(`public/quizzes/${lang}.json`,JSON.stringify(data));
 report.push({language:lang,source:`https://dabar.theamov.com/api/questions?complete=1&lang=${lang}`,downloaded:'2026-09-23',source_count:rows.length,imported_count:data.length,duplicate_count:duplicate,sha256:crypto.createHash('sha256').update(original).digest('hex')});
}
fs.writeFileSync('public/quizzes/provenance.json',JSON.stringify({authorization:'The owner explicitly authorized reuse of their Dabar app and content.',processing:'Duplicate IDs or identical normalized questions keep their first occurrence. Wording, correct answers and explanations are preserved. Theological review remains required.',imports:report},null,2));
console.log(report.map(({language,source_count,imported_count,duplicate_count})=>({language,source_count,imported_count,duplicate_count})));
