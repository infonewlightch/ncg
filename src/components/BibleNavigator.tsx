import {useEffect,useRef,useState} from 'react';
import {Search} from 'lucide-react';
import {useApp} from '../state';
import {chapterOf,type BibleIndex} from '../core/bible';
import names from '../data/bible-books.json';

/** Three independent scroll columns keep book, chapter and verse visible together. */
export function BibleNavigator({index,passage,onSelect,onRead}:{index:BibleIndex;passage:string;onSelect:(id:string)=>void;onRead?:()=>void}){
 const {state,t}=useApp();const [query,setQuery]=useState('');const [canon,setCanon]=useState('all');const root=useRef<HTMLDivElement>(null);
 const book=index.books.find(b=>b.id===passage.split('.')[0])||index.books[0];const chapter=book?.chapters.find(c=>c.passage_id===chapterOf(passage))||book?.chapters[0];
 const books=index.books.filter(b=>{const alias=names.find(n=>n.code===(b.id==='NAM'?'NAH':b.id));return(canon==='all'||b.canon===canon)&&`${b.title} ${b.full_title} ${b.abbreviation} ${b.id} ${alias?.ko||''} ${alias?.en||''} ${alias?.abbr||''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());});
 useEffect(()=>{
  // Scroll only the three lists, never their page or dialog ancestors.
  const lists=Array.from(root.current?.querySelectorAll<HTMLElement>('.bible-scroll-list')||[]);
  const reveal=()=>lists.forEach(list=>{const active=list.querySelector<HTMLElement>('[aria-current="true"]');if(!active||!list.clientHeight)return;const a=active.getBoundingClientRect(),l=list.getBoundingClientRect();if(a.top<l.top||a.bottom>l.bottom)list.scrollTop+=a.top-l.top-list.clientHeight/2+active.clientHeight/2;});
  // A native dialog is opened after its children mount. Observe its visible size.
  const observer=new ResizeObserver(reveal);lists.forEach(list=>observer.observe(list));reveal();return()=>observer.disconnect();
 },[passage,index,query,canon]);
 return <div className="bible-navigator" ref={root}>
  <label className="search-box"><Search size={16}/><input aria-label={t('성경 이름 검색','Search Bible books')} value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('성경 이름 검색','Search a book')}/></label>
  <div className="bible-canon-tabs" aria-label={t('성경 구분','Testament')}>{[['all',t('전체','All')],['old_testament',t('구약','Old Testament')],['new_testament',t('신약','New Testament')]].map(([id,label])=><button type="button" key={id} aria-pressed={canon===id} onClick={()=>setCanon(id)}>{label}</button>)}</div>
  <div className="bible-scroll-columns">
   <div className="bible-scroll-column bible-books-column"><h3>{t('성경','Book')}</h3><div className="bible-scroll-list" aria-label={t('성경 목록','Bible books')}>{books.map(b=>{const alias=names.find(n=>n.code===(b.id==='NAM'?'NAH':b.id));const title=state.ui==='ko'&&alias?alias.ko:b.title;return <button type="button" key={b.id} aria-current={book?.id===b.id?'true':undefined} onClick={()=>b.chapters[0]&&onSelect(b.chapters[0].passage_id)}><b dir="auto">{title}</b>{title!==b.title&&<small dir="auto">{b.title}</small>}</button>;})}{!books.length&&<p className="navigator-empty">{t('일치하는 성경이 없습니다.','No matching books.')}</p>}</div></div>
   <div className="bible-scroll-column"><h3>{t('장','Chapter')}</h3><div className="bible-scroll-list" aria-label={t('장 목록','Chapters')}>{book?.chapters.map(c=><button type="button" key={c.passage_id} aria-label={`${book.title} ${c.title}`} aria-current={chapter?.passage_id===c.passage_id?'true':undefined} onClick={()=>onSelect(c.passage_id)}>{c.title}</button>)}</div></div>
   <div className="bible-scroll-column"><h3>{t('절','Verse')}</h3><div className="bible-scroll-list" aria-label={t('절 목록','Verses')}><button type="button" aria-current={passage===chapter?.passage_id?'true':undefined} onClick={()=>chapter&&onSelect(chapter.passage_id)}>{t('전체','All')}</button>{chapter?.verses.map(v=><button type="button" key={v.passage_id} aria-label={`${book?.title} ${chapter.title}:${v.title}`} aria-current={passage===v.passage_id?'true':undefined} onClick={()=>{onSelect(v.passage_id);onRead?.();}}>{v.title}</button>)}</div></div>
  </div>
  <div className="navigator-current"><span dir="auto">{book?.title} {chapter?.title}{passage.split('.')[2]?`:${passage.split('.')[2]}`:''}</span>{onRead&&<button className="button" onClick={onRead}>{t('본문 읽기','Read passage')}</button>}</div>
 </div>;
}
