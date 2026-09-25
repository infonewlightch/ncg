import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,Check,CheckCircle,Eye,Search} from 'lucide-react';
import {useApp} from '../state';
import {Modal} from '../components/Ui';
import {languageName} from '../core/languages';
import {educationLanguage,educationDirection,isOriginalEducationLanguage,loadEducationUnits} from '../core/education';
import {EducationNotice} from '../components/EducationNotice';
import {completeLesson} from '../core/learning';

type CatechismItem={n:number;q:string;a:string};
const groups=[{id:'all',from:1,to:107,ko:'전체',en:'All'},{id:'faith',from:1,to:38,ko:'하나님과 구원',en:'God & salvation'},{id:'life',from:39,to:84,ko:'십계명과 삶',en:'Commandments & life'},{id:'grace',from:85,to:97,ko:'은혜의 방편',en:'Means of grace'},{id:'prayer',from:98,to:107,ko:'기도',en:'Prayer'}];
export default function Catechism(){
 const {state,t,update}=useApp();
 const [items,setItems]=useState<CatechismItem[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 const [query,setQuery]=useState(''),[group,setGroup]=useState('all'),[card,setCard]=useState<number|null>(null),[revealed,setRevealed]=useState(false),[page,setPage]=useState(0);
 const [manual,setManual]=useState<{site:string;language:string}|null>(null),[loaded,setLoaded]=useState<{language:string;page:number}|null>(null);
 const siteLanguage=educationLanguage(state.language),language=manual?.site===siteLanguage?manual.language:siteLanguage,original=isOriginalEducationLanguage(language);
 const currentLanguage=useRef(language),pages=useRef(new Map<string,CatechismItem[]>());currentLanguage.current=language;
 useEffect(()=>{setCard(null);setRevealed(false);setQuery('');setGroup('all');setPage(0);},[language]);
 useEffect(()=>{
  const controller=new AbortController();setItems([]);setLoaded(null);setError('');setLoading(true);
  const loaders={ko:()=>import('../data/catechism/ko.json'),en:()=>import('../data/catechism/en.json'),th:()=>import('../data/catechism/th.json')};
  async function load(){
   try{
    const data=(await loaders[original?language as keyof typeof loaders:'en']()).default as CatechismItem[];
    const key=`${language}:${page}`;let translated=original?data:pages.current.get(key);
    if(!translated){const id=`catechism:${page}`;translated=(await loadEducationUnits(language,[{id,kind:'catechism',data:data.slice(page*10,page*10+10)}],controller.signal)).get(id) as CatechismItem[]|undefined;}
    if(!translated)throw Error('translation_unavailable');
    if(controller.signal.aborted||currentLanguage.current!==language)return;
    if(!original)pages.current.set(key,translated);setItems(translated);setLoaded({language,page});
   }catch(e){if(!controller.signal.aborted)setError(errorCode(e));}
   finally{if(!controller.signal.aborted)setLoading(false);}
  }
  void load();return()=>controller.abort();
 },[language,original,page,retry]);
 const ready=loaded?.language===language&&(original||loaded.page===page),visible=ready?items:[];
 const scope=groups.find(g=>g.id===group)!,firstPage=Math.floor((scope.from-1)/10),lastPage=Math.floor((scope.to-1)/10);
 const list=visible.filter(x=>x.n>=scope.from&&x.n<=scope.to&&(original?`${x.n} ${x.q} ${x.a}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()):!query||x.n===Number(query)));
 const done=Array.from({length:107},(_,i)=>i+1).filter(n=>state.completed.includes(`catechism:${n}`)).length;
 const current=visible.find(x=>x.n===card),isDone=current&&state.completed.includes(`catechism:${current.n}`);
 function open(n:number){if(n<1||n>107)return;if(n<scope.from||n>scope.to)setGroup('all');setQuery('');setCard(n);setRevealed(false);if(!original)setPage(Math.floor((n-1)/10));}
 function changeGroup(id:string){const next=groups.find(g=>g.id===id)!;setGroup(id);setQuery('');setCard(null);if(!original)setPage(Math.floor((next.from-1)/10));}
 function search(value:string){setQuery(value);setCard(null);if(!original){const number=Number(value);if(Number.isInteger(number)&&number>=1&&number<=107){setGroup('all');setPage(Math.floor((number-1)/10));}}}
 function complete(){if(!current)return;update(s=>({...s,completed:completeLesson(s.completed,`catechism:${current.n}`)}));}
 return <><a className="text-link back-link" href="#/school"><ArrowLeft size={17}/>{t('성경교육','Bible School')}</a><div className="school-heading catechism-heading"><div><span className="eyebrow">{t("NCG SCHOOL · 소요리문답","NCG SCHOOL \u00b7 CATECHISM")}</span><h1>{t('웨스트민스터 소요리문답','Westminster Shorter Catechism')}</h1><p>{t('107개의 문답으로 차근차근 배우는 믿음의 기초.','Explore the foundations of faith through 107 questions and answers.')}</p></div><BookOpen size={56} strokeWidth={1}/></div><div className="catechism-progress"><span><b>{done}</b> / 107 {t('문답 학습','studied')}</span><progress value={done} max={107} aria-label={t('문답 학습 진도','Catechism progress')}/><button className="button" disabled={loading||!ready} onClick={()=>open(Array.from({length:107},(_,i)=>i+1).find(n=>!state.completed.includes(`catechism:${n}`))||1)}>{done?t('이어서 배우기','Continue learning'):t('첫 문답 시작','Start learning')}<ArrowRight size={17}/></button></div>{!original&&<EducationNotice language={language} loading={loading} error={error} onRetry={()=>setRetry(n=>n+1)} onOriginal={()=>setManual({site:siteLanguage,language:'en'})}/>}<div className="school-status"><label>{t('교육 언어','Lesson language')}<select value={language} onChange={e=>setManual({site:siteLanguage,language:e.target.value})}>{!isOriginalEducationLanguage(siteLanguage)&&<option value={siteLanguage}>{languageName(siteLanguage,siteLanguage)}</option>}<option value="ko">한국어</option><option value="en">English</option><option value="th">ภาษาไทย</option></select></label></div>{manual?.site===siteLanguage&&language!==siteLanguage&&<p className="callout">{t('선택한 언어의 번역을 준비 중입니다. 현재 교육 언어:','Translation is being prepared. Current lesson language:')} {languageName(language,state.ui)}</p>}<label className="search-box"><Search size={18}/><input type={original?'search':'number'} min={original?undefined:1} max={original?undefined:107} aria-label={original?t("문답 검색","Search catechism"):t('제{number}문','Question {number}').replace('{number}','1–107')} value={query} onChange={e=>search(e.target.value)} placeholder={original?t('문답 번호나 내용 검색','Search by number or content'):t('제{number}문','Question {number}').replace('{number}','1–107')}/></label><div className="tabs catechism-tabs">{groups.map(g=><button key={g.id} className={group===g.id?'active':''} disabled={loading} onClick={()=>changeGroup(g.id)}>{t(g.ko,g.en)}</button>)}</div>{error?(original?<p className="error" role="alert">{t('문답을 불러오지 못했습니다. 다시 접속해주세요.','Unable to load the catechism. Please reload.')} <button className="text-link" onClick={()=>setRetry(n=>n+1)}>{t('다시 시도','Try again')}</button></p>:null):visible.length?<div className="catechism-list" lang={language} dir={educationDirection(language)}>{list.map(x=><button key={x.n} onClick={()=>open(x.n)}><span className="catechism-number">{state.completed.includes(`catechism:${x.n}`)?<Check size={20}/>:String(x.n).padStart(2,'0')}</span><b lang={language}>{x.q}</b><ArrowRight size={17}/></button>)}{!list.length&&<p>{t('일치하는 문답이 없습니다.','No matching questions.')}</p>}</div>:<p role="status">{t('문답을 불러오는 중…','Loading questions…')}</p>}{!original&&<div className="button-row library-pagination"><button className="button secondary" disabled={loading||page<=firstPage} onClick={()=>{setPage(n=>n-1);setQuery('');setCard(null);}}><ArrowLeft size={16}/>{t('이전','Previous')}</button><span aria-live="polite">{Math.max(scope.from,page*10+1)}–{Math.min(scope.to,page*10+10)} / 107</span><button className="button secondary" disabled={loading||page>=lastPage} onClick={()=>{setPage(n=>n+1);setQuery('');setCard(null);}}>{t('다음','Next')}<ArrowRight size={16}/></button></div>}<p className="library-note">{t('다바르의 문답과 번역을 이어받았습니다. 공개 운영을 위한 교회 검수 중입니다.','Adapted from the owner’s Dabar content. Church review for public use is pending.')}</p>{current&&<Modal wide title={t('제{number}문','Question {number}').replace('{number}',String(current.n))} onClose={()=>setCard(null)}>{!original&&<EducationNotice language={language}/>}<article className="catechism-card" lang={language} dir={educationDirection(language)}><span className="eyebrow">{t("웨스트민스터 소요리문답","WESTMINSTER SHORTER CATECHISM")} · {current.n} / 107</span><h2>{current.q}</h2>{revealed?<div className="catechism-answer"><span className="eyebrow">{t('답','ANSWER')}</span><p>{current.a}</p></div>:<button className="reveal-answer" onClick={()=>setRevealed(true)}><Eye size={21}/>{t('생각해 본 뒤, 답 펼치기','Think it through, then reveal the answer')}</button>}</article><div className="catechism-card-actions"><button className="text-link" disabled={current.n===1} onClick={()=>open(current.n-1)}><ArrowLeft size={16}/>{t('이전','Previous')}</button><button className="button" disabled={!revealed||Boolean(isDone)} onClick={complete}>{isDone?<CheckCircle size={17}/>:<Check size={17}/>} {isDone?t('학습했어요','Studied'):t('이 문답을 학습했어요','Mark as studied')}</button><button className="text-link" disabled={current.n===107} onClick={()=>open(current.n+1)}>{t('다음','Next')}<ArrowRight size={16}/></button></div></Modal>}</>;
}

function errorCode(error:unknown){return error&&typeof error==='object'&&'code' in error?String(error.code):'translation_unavailable';}
