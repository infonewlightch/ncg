import ts from 'typescript';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { iso6393 } from 'iso-639-3';

// Read only literal content from the supplied archive. Never execute archived code.
function literal(n) {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isNumericLiteral(n)) return Number(n.text);
  if (ts.isArrayLiteralExpression(n)) return n.elements.map(literal);
  if (ts.isObjectLiteralExpression(n)) return Object.fromEntries(n.properties.map(p => {
    if (!ts.isPropertyAssignment(p)) throw new Error('Nonliteral property');
    return [p.name.text, literal(p.initializer)];
  }));
  throw new Error('Unsupported literal: ' + n.kind);
}
function readConstant(file, name) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const s of source.statements) if (ts.isVariableStatement(s)) {
    for (const d of s.declarationList.declarations) if (d.name.text === name) return literal(d.initializer);
  }
  throw new Error('Missing content constant ' + name);
}
const base = readConstant('/tmp/ncg-dabar-source/courses.ts', 'COURSES');
const tr = readConstant('/tmp/ncg-dabar-source/courses.i18n.ts', 'COURSE_TRANS');
const selected = base.filter(c => ['newcomer', 'baptism', 'confirmation', 'deep'].includes(c.slug));
fs.mkdirSync('src/data/courses', { recursive: true });
for (const lang of ['ko', 'en', 'th']) {
  const courses = selected.map(c => {
    const t = tr[c.slug]?.[lang];
    return { slug: c.slug, title: t?.title ?? c.title, subtitle: t?.subtitle ?? c.subtitle,
      lessons: c.lessons.map(l => {
        const lt = t?.lessons[l.id];
        return { ...l, ...lt, questions: l.questions.map((q,i) => ({ ...q, ...lt?.questions?.[i], answer: q.answer })) };
      }) };
  });
  fs.writeFileSync(`src/data/courses/${lang}.json`, JSON.stringify(courses));
}
const languages = iso6393.map(l => ({ code: l.iso6391 || l.iso6393, iso3: l.iso6393, name: l.name, type: l.type, scope: l.scope }));
const catechism=readConstant('/tmp/ncg-dabar-source/catechism.ts','CATECHISM');
fs.mkdirSync('src/data/catechism',{recursive:true});
for(const lang of ['ko','en','th']){
 const translated=lang==='ko'?null:readConstant('/tmp/ncg-dabar-source/catechism.i18n.ts','CAT_TRANS_'+lang.toUpperCase());
 fs.writeFileSync(`src/data/catechism/${lang}.json`,JSON.stringify(catechism.map(q=>({...q,...translated?.[q.n]}))));
}
fs.writeFileSync('src/data/languages.json', JSON.stringify(languages));
fs.writeFileSync('src/data/languages-index.json',JSON.stringify(languages.map(l=>l.code===l.iso3?[l.iso3,l.name]:[l.iso3,l.name,l.code])));
const hashes = ['courses.ts', 'courses.i18n.ts'].map(n => n + ': ' + crypto.createHash('sha256').update(fs.readFileSync('/tmp/ncg-dabar-source/' + n)).digest('hex'));
fs.writeFileSync('docs/content-provenance.md', `# 콘텐츠 출처\n\n사용자 제공: /Users/sus4yoo/Downloads/dabar-main (4).zip\n\n선별 재사용: ${selected.map(c=>`${c.title} ${c.lessons.length}과`).join(', ')}. 본문·문항·정답·해설·기존 번역을 보존했다. 로그인, 서버키, API, 다른 앱 콘텐츠는 가져오지 않았다.\n\n과정 원본은 개혁주의/장로교 교육 초안으로 표시되어 있다. 기존 영어/태국어 번역을 사용하며 공개 운영 전 교회의 콘텐츠 검수 단계가 남아 있다. 성경 인용 번역별 표기를 보존한다.\n\n언어 목록: iso-639-3 npm 데이터 (${languages.length} 항목, ISO 639-3 기반). 이는 언어 선택 가능 목록이며 번역 제공 수가 아니다. 국가 목록과 언어를 동일시하지 않는다. 지역/문자별 BCP 47 태그는 별도 입력할 수 있다.\n\n원본 SHA-256:\n${hashes.join('\n')}\n\nNCG 운영·제작/저작권 표기: 대한예수교장로회(합동) 경기동중노회 새빛교회. 패키지/제3자 콘텐츠의 기존 권리 표기는 유지한다.\n`);
console.log({ courses: selected.map(c=>[c.slug,c.lessons.length]), languages: languages.length });
