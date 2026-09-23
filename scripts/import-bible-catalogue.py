"""Import public eBible catalogue metadata, never infer rights from a book title.
Input: official https://ebible.org/Scriptures/translations.csv
"""
import csv,json,sys,hashlib
from pathlib import Path
source=Path(sys.argv[1]);rows=list(csv.DictReader(source.open(encoding='utf-8-sig')))
items=[]
for r in rows:
 items.append({'id':r['translationId'],'language':r['languageCode'],'languageName':r['languageName'],'englishName':r['languageNameInEnglish'],'title':r['title'],'shortTitle':r['shortTitle'],'description':r['description'],'dialect':r['dialect'],'script':r['script'],'copyright':r['Copyright'],'redistributable':r['Redistributable']=='True','certified':r['Certified']=='True','direction':r['textDirection'],'updated':r['UpdateDate']})
output={'source':'https://ebible.org/Scriptures/translations.csv','retrieved':'2026-09-24','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'versions':items}
Path('src/data/bible-catalogue.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Imported {len(items)} editions in {len(set(r["language"] for r in items))} languages.')
