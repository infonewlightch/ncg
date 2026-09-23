"""Import the official eBible WEBP USFX download without rewriting its Scripture text.
Usage: python3 scripts/import-web-bible.py /path/to/engwebp_usfx.zip
"""
import hashlib,json,re,sys,zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

archive=Path(sys.argv[1])
output=Path(__file__).resolve().parents[1]/'public'/'bibles'/'webp'
canonical='GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split()
normalize=lambda s: re.sub(r'\s+',' ',s).strip()
with zipfile.ZipFile(archive) as z:
 root=ET.fromstring(z.read('engwebp_usfx.xml'))
 names={x.attrib['code']:x.attrib for x in ET.fromstring(z.read('BookNames.xml'))}
 source_copyright=z.read('copr.htm').decode('utf-8-sig')
books=[];all_verses=[]
for code in canonical:
 book=root.find(f"book[@id='{code}']")
 assert book is not None,code
 chapters=[];current=None;chapter=None;pending_heading=[]
 def append(text):
  if current is not None and text:current['text']+=text
 def walk(node):
  global current,chapter,pending_heading
  if node.tag=='c':
   current=None;chapter={'id':int(node.attrib['id']),'verses':[]};chapters.append(chapter)
  elif node.tag=='v':
   assert current is None,('verse not closed',code,node.attrib)
   current={'id':node.attrib['bcv'],'number':node.attrib['id'],'text':''}
   if pending_heading:current['heading']=' '.join(pending_heading);pending_heading=[]
   assert chapter is not None
   chapter['verses'].append(current)
  elif node.tag=='ve':
   assert current is not None
   current['text']=normalize(current['text'])
   # A publisher may omit a verse and explain it only in a footnote; retain that exact structure.
   assert current['text'] or current.get('notes'),current['id']
   all_verses.append(current);current=None
  elif node.tag in ('f','x'):
   if current is not None:
    note=' '.join(normalize(''.join(x.itertext())) for x in node if x.tag not in ('fr','xo'))
    current.setdefault('notes',[]).append(note)
   return
  elif node.tag in ('d','s') or node.tag=='p' and node.attrib.get('sfm') in ('ms','s'):
   pending_heading.append(normalize(''.join(node.itertext())))
   for milestone in node.iter('ve'):
    walk(milestone)
   return
  append(node.text)
  for child in node:
   walk(child);append(child.tail)
 walk(book)
 assert current is None
 for ch in chapters:
  assert ch['verses'],(code,ch['id'])
  assert len({v['id'] for v in ch['verses']})==len(ch['verses'])
 books.append({'id':code,'title':names[code]['short'],'full_title':names[code]['long'],'abbreviation':names[code]['abbr'],'canon':'old_testament' if canonical.index(code)<39 else 'new_testament','chapters':chapters})
assert len(books)==66
assert sum(len(b['chapters']) for b in books)==1189
assert all_verses[0]['text']=='In the beginning, God created the heavens and the earth.'
assert next(v for v in all_verses if v['id']=='JHN.3.16')['text']=='For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.'
output.mkdir(parents=True,exist_ok=True)
index={'text_direction':'ltr','books':[]}
for b in books:
 meta={k:v for k,v in b.items() if k!='chapters'}
 index['books'].append({**meta,'chapters':[{'id':c['id'],'verses':[v['number'] for v in c['verses']]} for c in b['chapters']]})
 for c in b['chapters']:
  p=f"{b['id']}.{c['id']}"
  (output/f'{p}.json').write_text(json.dumps({'id':p,'reference':f"{b['title']} {c['id']}",'content':'\n'.join(v['text'] for v in c['verses']),'verses':c['verses']},ensure_ascii=False,separators=(',',':'))+'\n')
(output/'index.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':'))+'\n')
(output/'source-copyright.html').write_text(source_copyright)
manifest={'source':'https://ebible.org/Scriptures/engwebp_usfx.zip','source_page':'https://ebible.org/engwebp/','copyright_page':'https://ebible.org/engwebp/copyright.htm','edition':'World English Bible, Protestant Edition (66 books)','license':'Public domain; translation name must not be applied to modified Scripture text.','downloaded':'2026-09-23','archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'books':len(books),'chapters':1189,'verses':len(all_verses),'processing':'66-book subset matching publisher WEBP catalogue. Scripture words retained, XML markup removed, whitespace normalized. Footnotes and source headings kept separately.'}
(output/'provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:manifest[k] for k in ['books','chapters','verses','archive_sha256']}))
