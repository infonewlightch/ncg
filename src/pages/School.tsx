import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,Check,CheckCircle,Download,GraduationCap,Sprout} from 'lucide-react';
import type {Course,Lesson} from '../core/model';
import {shuffleOptions,completeLesson} from '../core/learning';
import {languageName} from '../core/languages';
import {educationLanguage,educationDirection,isOriginalEducationLanguage,loadEducationUnits} from '../core/education';
import {EducationNotice} from '../components/EducationNotice';
import {useApp} from '../state';
import {Modal} from '../components/Ui';

function Quiz({lesson,course,language,onClose}:{lesson:Lesson;course:Course;language:string;onClose:()=>void}){
 const {t,update,notify}=useApp();const [index,setIndex]=useState(0);const [selected,setSelected]=useState<number|null>(null);const [checked,setChecked]=useState(false);const [done,setDone]=useState(false);
 const q=lesson.questions[index];const view=shuffleOptions(q,index+Number(lesson.id));const correct=selected===view.answer;
 function next(){if(index===lesson.questions.length-1){update(s=>({...s,completed:completeLesson(s.completed,`${course.slug}:${lesson.id}`)}));setDone(true);notify(t('학습 진도가 이 기기에 저장되었습니다.','Progress saved on this device.'));}else{setIndex(i=>i+1);setSelected(null);setChecked(false);}}
 return <Modal title={t('성경퀴즈','Bible quiz')} onClose={onClose}><div lang={language} dir={educationDirection(language)}>{!isOriginalEducationLanguage(language)&&<EducationNotice language={language}/>} {done?<div className="quiz-complete"><CheckCircle size={64} strokeWidth={1}/><span className="eyebrow">{t("믿음의 작은 한 걸음","A SMALL STEP OF FAITH")}</span><h2>{t('말씀이 한 걸음 더 가까워졌어요.','One step closer to the Word.')}</h2><p>{lesson.title} · {lesson.questions.length}{t('문항 학습 완료',' questions completed')}</p><button className="button" onClick={onClose}>{t('교육으로 돌아가기','Back to School')}</button></div>:<><div className="quiz-top"><span>{lesson.title}</span><b>{index+1} / {lesson.questions.length}</b></div><progress value={index} max={lesson.questions.length} aria-label={t('퀴즈 진도','Quiz progress')}/><h3 className="question-title">{q.question}</h3><div className="quiz-options">{view.options.map((option,i)=><button key={i} className={`${selected===i?'chosen':''} ${checked&&i===view.answer?'correct':''} ${checked&&selected===i&&!correct?'incorrect':''}`} disabled={checked} aria-pressed={selected===i} onClick={()=>setSelected(i)}><span>{String.fromCharCode(65+i)}</span>{option}{checked&&i===view.answer&&<Check size={18}/>}</button>)}</div>{checked&&<div className={`answer-feedback ${correct?'correct':'retry'}`} role="status"><b>{correct?t('맞았어요!','That’s right!'):t('다시 한번 생각해볼까요?','Let’s think about it again.')}</b><p>{q.explanation}</p></div>}<div className="quiz-actions">{!checked?<button className="button" disabled={selected===null} onClick={()=>setChecked(true)}>{t('정답 확인','Check answer')}</button>:correct?<button className="button" onClick={next}>{index===lesson.questions.length-1?t('학습 완료','Complete lesson'):t('다음 문제','Next question')}<ArrowRight size={16}/></button>:<button className="button secondary" onClick={()=>{setChecked(false);setSelected(null);}}>{t('다시 풀기','Try again')}</button>}</div></>}</div></Modal>;
}
export default function School({path}:{path:string}){
 const {state,t}=useApp();
 const [level,setLevel]=useState('all'),[courses,setCourses]=useState<Course[]>([]),[loadedLanguage,setLoadedLanguage]=useState('');
 const [lesson,setLesson]=useState<Lesson|null>(null),[quiz,setQuiz]=useState<{course:Course;lesson:Lesson}|null>(null);
 const [manual,setManual]=useState<{site:string;language:string}|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[busy,setBusy]=useState(false);
 const siteLanguage=educationLanguage(state.language),language=manual?.site===siteLanguage?manual.language:siteLanguage;
 const original=isOriginalEducationLanguage(language),ready=loadedLanguage===language;
 const source=useRef<Course[]>([]),translatedLessons=useRef(new Map<string,Lesson>()),operation=useRef<AbortController|null>(null),retryAction=useRef<(()=>void)|null>(null),currentLanguage=useRef(language);
 currentLanguage.current=language;
 useEffect(()=>{
  const controller=new AbortController();operation.current?.abort();operation.current=null;source.current=[];translatedLessons.current=new Map();retryAction.current=null;
  setCourses([]);setLoadedLanguage('');setLesson(null);setQuiz(null);setError('');setLoading(true);setBusy(false);
  const loaders={ko:()=>import('../data/courses/ko.json'),en:()=>import('../data/courses/en.json'),th:()=>import('../data/courses/th.json')};
  async function load(){
   try{
    const data=(await loaders[original?language as keyof typeof loaders:'en']()).default as Course[];
    let result=data;
    if(!original){
     const catalogue=data.map(c=>({slug:c.slug,title:c.title,subtitle:c.subtitle,lessons:c.lessons.map(l=>({id:l.id,title:l.title}))}));
     const translated=(await loadEducationUnits(language,[{id:'catalogue',kind:'catalogue',data:catalogue}],controller.signal)).get('catalogue') as typeof catalogue|undefined;
     if(!translated)throw Error('translation_unavailable');
     result=data.map(c=>{const entry=translated.find(x=>x.slug===c.slug);if(!entry)throw Error('translation_unavailable');return {...c,title:entry.title,subtitle:entry.subtitle,lessons:c.lessons.map(l=>{const title=entry.lessons.find(x=>x.id===l.id)?.title;if(!title)throw Error('translation_unavailable');return {...l,title};})};});
    }
    if(controller.signal.aborted||currentLanguage.current!==language)return;
    source.current=data;setCourses(result);setLoadedLanguage(language);
   }catch(e){if(!controller.signal.aborted)setError(errorCode(e));}
   finally{if(!controller.signal.aborted)setLoading(false);}
  }
  void load();return()=>{controller.abort();operation.current?.abort();operation.current=null;};
 },[language,original,retry]);
 useEffect(()=>{operation.current?.abort();operation.current=null;retryAction.current=null;setBusy(false);setLesson(null);setQuiz(null);if(ready)setError('');},[path]);
 const visible=ready?courses:[],slug=path.split('/')[2],active=visible.find(c=>c.slug===slug);
 const count=28,learned=visible.flatMap(c=>c.lessons.filter(l=>state.completed.includes(`${c.slug}:${l.id}`))).length;
 const visibleCourses=visible.filter(c=>level==='all'||(level==='beginner'?c.slug==='newcomer':level==='growing'?['baptism','confirmation'].includes(c.slug):c.slug==='deep'));
 const catechismLearned=state.completed.filter(id=>/^catechism:\d+$/.test(id)).length;
 function useOriginal(){setManual({site:siteLanguage,language:'en'});}
 function retryTranslation(){if(retryAction.current)retryAction.current();else setRetry(n=>n+1);}
 async function lessonData(course:Course,selected:Lesson,signal:AbortSignal){
  const id=`lesson:${course.slug}:${selected.id}`,cached=translatedLessons.current.get(id);
  if(cached)return cached;
  const data=source.current.find(c=>c.slug===course.slug)?.lessons.find(l=>l.id===selected.id);
  if(!data)throw Error('translation_unavailable');
  const translated=original?data:(await loadEducationUnits(language,[{id,kind:'lesson',data}],signal)).get(id) as Lesson|undefined;
  if(!translated)throw Error('translation_unavailable');
  if(!signal.aborted&&currentLanguage.current===language)translatedLessons.current.set(id,translated);
  return translated;
 }
 async function openLesson(course:Course,selected:Lesson,asQuiz=false){
  if(operation.current||!ready)return;
  const controller=new AbortController();operation.current=controller;retryAction.current=()=>void openLesson(course,selected,asQuiz);setBusy(true);setError('');
  try{const data=await lessonData(course,selected,controller.signal);if(controller.signal.aborted||currentLanguage.current!==language)return;if(asQuiz)setQuiz({course,lesson:data});else setLesson(data);retryAction.current=null;}
  catch(e){if(!controller.signal.aborted)setError(errorCode(e));}
  finally{if(operation.current===controller){operation.current=null;setBusy(false);}}
 }
 async function download(c:Course){
  if(operation.current||!ready)return;
  const controller=new AbortController();operation.current=controller;retryAction.current=()=>void download(c);setBusy(true);setError('');
  try{
   const originalCourse=source.current.find(x=>x.slug===c.slug);if(!originalCourse)throw Error('translation_unavailable');
   const missing=originalCourse.lessons.filter(l=>!translatedLessons.current.has(`lesson:${c.slug}:${l.id}`));
   const translated=original?new Map(missing.map(l=>[`lesson:${c.slug}:${l.id}`,l])):await loadEducationUnits(language,missing.map(data=>({id:`lesson:${c.slug}:${data.id}`,kind:'lesson' as const,data})),controller.signal);
   if(controller.signal.aborted||currentLanguage.current!==language)return;
   const lessons=originalCourse.lessons.map(l=>{const id=`lesson:${c.slug}:${l.id}`,result=translatedLessons.current.get(id)||translated.get(id);if(!result)throw Error('translation_unavailable');return result as Lesson;});
   const note=original?'':`Automated educational translation (${language}); not an official Bible translation. Scripture references identify the English source.\n\n`;
   const txt=`NCG SCHOOL · ${c.title}\nNewlight Church\n\n${note}`+lessons.map(l=>`${l.id}. ${l.title}\n${l.verse}\n${l.verseRef}\n\n${l.teaching.join('\n\n')}`).join('\n\n────────\n\n');
   const url=URL.createObjectURL(new Blob([txt],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`NCG-${c.slug}-${language}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   lessons.forEach(l=>translatedLessons.current.set(`lesson:${c.slug}:${l.id}`,l));retryAction.current=null;
  }catch(e){if(!controller.signal.aborted)setError(errorCode(e));}
  finally{if(operation.current===controller){operation.current=null;setBusy(false);}}
 }
 return <><div className="school-heading"><div><span className="eyebrow">NCG SCHOOL</span><h1>{t('배움으로 깊어지는 믿음','Grow deeper in faith.')}</h1><p>{t('새신자 교육부터 깊은 성경공부까지, 한 걸음씩.','From your first questions to deeper Bible study, one step at a time.')}</p></div><GraduationCap size={64} strokeWidth={1}/></div><div className="school-status"><div><Sprout size={22}/><span>{t('나의 믿음 여정','My learning journey')}</span><b>{learned} / {count} {t('과 완료','lessons')}</b></div><label>{t('교육 언어','Lesson language')}<select value={language} onChange={e=>setManual({site:siteLanguage,language:e.target.value})}>{!isOriginalEducationLanguage(siteLanguage)&&<option value={siteLanguage}>{languageName(siteLanguage,siteLanguage)}</option>}<option value="ko">한국어</option><option value="en">English</option><option value="th">ภาษาไทย</option></select></label></div>{!original&&<EducationNotice language={language} loading={loading||busy} error={error} onRetry={retryTranslation} onOriginal={useOriginal}/>} {original&&error&&<p className="error" role="alert">{t('교육 자료를 불러오지 못했습니다.','Could not load the lessons.')} <button className="text-link" onClick={retryTranslation}>{t('다시 시도','Try again')}</button></p>}{manual?.site===siteLanguage&&language!==siteLanguage&&<p className="callout">{t('선택한 언어의 번역을 준비 중입니다. 현재 교육 언어:','Translation is being prepared. Current lesson language:')} {languageName(language,state.ui)}</p>}{!visible.length?(loading?<p role="status">{t('교육 자료를 불러오고 있습니다.','Loading lessons…')}</p>:null):active?<><a href="#/school" className="text-link back-link"><ArrowLeft size={16}/>{t('모든 교육','All courses')}</a><div className="course-detail-heading"><div lang={language} dir={educationDirection(language)}><span className="eyebrow">{t("말씀으로 자라는 믿음","GROW IN THE WORD")}</span><h2>{active.title}</h2><p>{active.subtitle}</p></div><button className="button secondary" disabled={busy} aria-busy={busy} onClick={()=>void download(active)}><Download size={17}/>{t('본문 저장','Save lesson text')}</button></div><div className="lesson-list" lang={language} dir={educationDirection(language)}>{active.lessons.map(l=><button key={l.id} disabled={busy} onClick={()=>void openLesson(active,l)} className="lesson-row"><span className="lesson-number">{state.completed.includes(`${active.slug}:${l.id}`)?<Check size={23}/>:l.id.padStart(2,'0')}</span><span><b>{l.title}</b><small><span lang={original?language:'en'} dir="ltr">{l.verseRef}</span> · {l.questions.length}{t('문항',' questions')}</small></span><ArrowRight size={19}/></button>)}</div></>:slug==='quiz'?<><div className="section-head"><h2>{t('어떤 말씀으로 시작할까요?','Where shall we begin?')}</h2><a href="#/school" className="text-link">{t('전체 교육','All courses')}</a></div><div className="quiz-topics" lang={language} dir={educationDirection(language)}>{visible.map(c=><section className="panel" key={c.slug}><BookOpen size={25}/><h3>{c.title}</h3>{c.lessons.map(l=><button key={l.id} className="quiz-topic" disabled={busy} onClick={()=>void openLesson(c,l,true)}>{l.title}<ArrowUpRightIcon/></button>)}</section>)}</div></>:<><div className="school-intro"><span className="pill">{t('시작이 처음이어도 괜찮아요','EVERY BEGINNING MATTERS')}</span><h2>{t('질문에서 시작하는, 하나님과의 만남.','Start with a question. Grow in His love.')}</h2><p>{t('다바르의 성경교육 콘텐츠를 바탕으로 한 단계씩 배웁니다. 모든 과정은 무료입니다.','Learn step by step with Bible education content from Dabar. Every course is free.')}</p></div><div className="tabs school-levels">{[["all",t("전체 과정","All courses")],["beginner",t("입문 · 믿음의 시작","Beginner · First steps")],["growing",t("성장 · 신앙의 기초","Growing · Foundations")],["deep",t("심화 · 제자 양육","Advanced · Discipleship")]].map(([id,label])=><button key={id} className={level===id?"active":""} onClick={()=>setLevel(id)}>{label}</button>)}</div><div className="course-grid" lang={language} dir={educationDirection(language)}>{visibleCourses.map((c,i)=><a className={`course-panel course-${i}`} href={'#/school/'+c.slug} key={c.slug}><span className="course-number">0{i+1}</span><BookOpen size={32} strokeWidth={1.2}/><h2>{c.title}{c.slug==='newcomer'&&language==='ko'?' 교육':''}</h2><p>{c.subtitle}</p><div><span>{c.lessons.length}{t('과 · 본문과 퀴즈',' lessons · Read & reflect')}</span><ArrowRight size={19}/></div></a>)}</div><a className="catechism-callout" href="#/school/catechism"><BookOpen size={34} strokeWidth={1.2}/><div><span className="eyebrow">{t("웨스트민스터 소요리문답","WESTMINSTER SHORTER CATECHISM")}</span><h2>{t("웨스트민스터 소요리문답","Westminster Shorter Catechism")}</h2><p>{t("107개의 문답으로 배우고, 생각하고, 마음에 새겨요.","Learn, reflect, and remember through 107 questions and answers.")}</p><small>{catechismLearned} / 107 {t("문답 학습","studied")}</small></div><ArrowRight size={20}/></a><a className="quiz-callout" href="#/school/quiz"><div><span className="eyebrow">{t("성경퀴즈","BIBLE QUIZ")}</span><h2>{t('한 문제씩, 말씀을 마음에.','One question. A deeper understanding.')}</h2><p>{t('성경퀴즈를 풀고 해설과 함께 다시 배워보세요.','Learn with Bible questions, answers, and explanations.')}</p></div><span className="button">{t('성경퀴즈 시작','Start a quiz')}<ArrowRight size={17}/></span></a></>}{ready&&lesson&&active&&<Modal wide title={lesson.title} onClose={()=>setLesson(null)}>{!original&&<EducationNotice language={language}/>}<article className="lesson-reading" lang={language} dir={educationDirection(language)}><span className="eyebrow">{active.title} · {lesson.id}</span><blockquote>{lesson.verse}<cite lang={original?language:'en'} dir="ltr">{!original&&<>{t('본문 출처','Source')}: English · </>}{lesson.verseRef}</cite></blockquote>{lesson.teaching.map((p,i)=><p key={i}>{p}</p>)}</article><button className="button" onClick={()=>{setQuiz({course:active,lesson});setLesson(null);}}>{t('성경퀴즈로 확인하기','Try the lesson quiz')}<ArrowRight size={17}/></button></Modal>}{ready&&quiz&&<Quiz {...quiz} language={language} onClose={()=>setQuiz(null)}/>}<p className="library-note">{t('로그인 전 진도는 이 기기에 저장됩니다. 계정 연결 후에는 학습 진도를 함께 보관합니다.','Guest progress is saved on this device. Connected accounts also keep their learning progress.')}</p></>;
}
function errorCode(error:unknown){return error&&typeof error==='object'&&'code' in error?String(error.code):'translation_unavailable';}
function ArrowUpRightIcon(){return <ArrowRight size={16}/>;}
