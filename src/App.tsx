import {Component,lazy,Suspense,useEffect,useState,type ReactNode} from 'react';
import {BookOpen,Globe,GraduationCap,Heart,Home as HomeIcon,Leaf,Mail,Radio,Search,Sun,User,X} from 'lucide-react';
import {Brand,Cross,Footer} from './components/Ui';
import {AddVideo,VideoPlayer} from './components/Media';
import {useApp} from './state';
import {languageName,hasInterfaceTranslation} from './core/languages';
import {interfaceDirection} from './core/interface';
import type {Video} from './core/model';
import Home from './pages/Home';
import {useAuth} from './auth';
import {BibleBookmarkSync} from './components/BibleBookmarkSync';
import {QuizProgressSync} from './components/QuizProgressSync';
import {VideoBookmarkSync} from './components/VideoBookmarkSync';
import {CloudSync} from './components/CloudSync';
const Bible=lazy(()=>import('./pages/Bible'));
const Sermons=lazy(()=>import('./pages/Sermons'));
const Catechism=lazy(()=>import('./pages/Catechism'));
const QuizGame=lazy(()=>import('./pages/QuizGame'));
const School=lazy(()=>import('./pages/School'));
const Community=lazy(()=>import('./pages/Community'));
const QuietTime=lazy(()=>import('./pages/QuietTime'));
const Gospel=lazy(()=>import('./pages/Gospel'));
const Profile=lazy(()=>import('./pages/Profile'));
const Friends=lazy(()=>import('./pages/Friends'));
const Contact=lazy(()=>import('./pages/Contact'));
const LanguagePicker=lazy(()=>import('./components/LanguagePicker'));

class PageBoundary extends Component<{children:ReactNode;t:(ko:string,en:string)=>string},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div className="empty-state"><h2>{this.props.t('화면을 불러오지 못했습니다.','Unable to load this page.')}</h2><p>{this.props.t('연결을 확인한 뒤 다시 시도해주세요.','Check your connection and try again.')}</p><button className="button" onClick={()=>location.reload()}>{this.props.t('다시 불러오기','Reload')}</button></div>:this.props.children;}
}
export default function App(){
 const {session}=useAuth();
 const {state,t,update,storageError,notice,notify}=useApp();const [path,setPath]=useState(location.hash.slice(1)||'/');const [language,setLanguage]=useState(false);const [video,setVideo]=useState<Video|null>(null);const [add,setAdd]=useState(false);
 useEffect(()=>{const route=()=>{setPath(location.hash.slice(1)||'/');setVideo(null);window.scrollTo({top:0});};window.addEventListener('hashchange',route);return()=>window.removeEventListener('hashchange',route);},[]);
 useEffect(()=>{document.documentElement.lang=state.ui;document.documentElement.dir=interfaceDirection(state.ui);document.title='NCG';},[state.ui]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>notify(''),6000);return()=>clearTimeout(timer);},[notice,notify]);
 const root=path.split('?')[0].split('/')[1]||'home';const nav=[{id:'home',href:'/',icon:HomeIcon,label:t('홈','Home')},{id:'qt',href:'/qt',icon:Sun,label:t('전 세계 QT','Global QT'),tag:t("함께","TOGETHER")},{id:'bible',href:'/bible',icon:BookOpen,label:t('성경 읽기','Bible')},{id:'worship',href:'/worship',icon:Radio,label:t('온라인 예배','Worship')},{id:'sermons',href:'/sermons',icon:BookOpen,label:t('말씀 · 설교','Messages')},{id:'community',href:'/community',icon:Heart,label:t('나눔 공동체','Community')},{id:'friends',href:'/friends',icon:User,label:t('친구 · 대화','Friends & chat')},{id:'school',href:'/school',icon:GraduationCap,label:t('성경교육','Bible School')}];
 const openLanguage=()=>setLanguage(true);
 let content:ReactNode;
 if(root==='home')content=<Home onVideo={setVideo} onLanguage={openLanguage}/>;
 else if(root==='worship'||root==='sermons')content=<Sermons key={root} worship={root==='worship'} onVideo={setVideo} onAdd={()=>setAdd(true)} onLanguage={openLanguage}/>;
 else if(root==='bible')content=<Bible key={path} onLanguage={openLanguage}/>;
 else if(path==='/school/catechism')content=<Catechism/>;
 else if(path==='/school/quiz')content=<QuizGame/>;
 else if(root==='school')content=<School path={path}/>;
 else if(root==='qt')content=<QuietTime onLanguage={openLanguage}/>;
 else if(root==='community')content=<Community onLanguage={openLanguage}/>;
 else if(root==='gospel')content=<Gospel/>;
 else if(root==='friends')content=<Friends/>;
 else if(root==='contact')content=<Contact/>;
 else if(root==='profile')content=<Profile onLanguage={openLanguage} onVideo={setVideo}/>;
 else content=<div className="empty-state"><h1>{t('페이지를 찾지 못했어요.','Page not found.')}</h1><a className="button" href="#/">{t('홈으로','Go home')}</a></div>;
 return <><a className="skip-link" href="#main" onClick={e=>{e.preventDefault();document.getElementById("main")?.focus();}}>{t('본문으로 이동','Skip to content')}</a><aside className="sidebar"><Brand/><div className="nav-label">{t('함께하는 믿음의 여정','YOUR JOURNEY OF FAITH')}</div><nav aria-label={t('주 메뉴','Main navigation')}>{nav.map(n=><a key={n.id} href={'#'+n.href} className={root===n.id?'active':''} aria-current={root===n.id?'page':undefined}><n.icon size={21}/><span>{n.label}</span>{n.tag&&<small>{n.tag}</small>}</a>)}</nav><div className="sidebar-school"><span>NCG SCHOOL</span><a href="#/school/quiz">{t('성경퀴즈','Bible quizzes')}</a><a href="#/school/newcomer">{t('새신자 교육','New believers')}</a></div><div className="sidebar-bottom"><a href="#/contact" className="sidebar-contact" aria-current={root==='contact'?'page':undefined}><Mail size={18}/>{t('문의하기','Contact')}</a><a href="#/gospel" className="sidebar-mission"><Cross/><p>{t('하나의 복음.','One Gospel.')}<br/>{t('모든 민족. 모든 언어.','Every nation. Every language.')}</p><span>{t('NCG의 믿음과 사명','Our faith & mission')} ↗</span></a><a href="#/profile" className="profile-link"><span className="avatar"><User size={18}/></span><span><b>{state.profile.name||t('로그인 / 회원가입','Sign in / Join')}</b><small>{t('마이페이지','My page')}</small></span></a></div></aside><div className="app-body"><header className="topbar"><span className="topbar-wordmark">NEWLIGHT CHURCH GLOBAL <span>/</span> {t('복음으로 연결되는 우리','CONNECTED IN THE GOSPEL')}</span><div className="mobile-brand"><Brand/></div><div className="topbar-actions"><a className="account-link" href="#/profile">{session?t("마이페이지","My page"):t("로그인","Sign in")}</a><a href="#/sermons" className="icon-button" aria-label={t('말씀 검색','Search messages')}><Search size={20}/></a><button className={`icon-button data-saver ${state.lowData?'enabled':''}`} onClick={()=>update(s=>({...s,lowData:!s.lowData}))} aria-label={t('데이터 절약 모드','Data saver')} aria-pressed={state.lowData}><Leaf size={19}/></button><button className="language-button" onClick={openLanguage}><Globe size={17}/><span>{languageName(state.language,state.ui)}</span></button><a href="#/profile" className="icon-button header-user" aria-label={t('내 공간','My space')}><User size={20}/></a></div></header>{storageError&&<div className="system-notice" role="alert">{t('이 브라우저에서 저장이 차단되어 있습니다. 현재 내용은 창을 닫으면 사라질 수 있습니다.','Storage is unavailable. Changes may be lost when you close this page.')}</div>}{state.lowData&&<div className="system-notice"><Leaf size={14}/>{t('데이터 절약 모드 · 영상 썸네일을 불러오지 않습니다.','Data saver · Video thumbnails are not loaded.')}</div>}{!hasInterfaceTranslation(state.language)&&<div className="language-fallback" role="status"><Globe size={17}/><span><b>{languageName(state.language,state.language)}</b> · {t("이 언어의 화면 번역을 준비하고 있습니다. 현재 메뉴는 영어로 표시합니다.","Interface translation is being prepared. Menus currently appear in English.")}</span><button className="text-link" onClick={openLanguage}>{t("언어 변경","Change language")}</button></div>}<CloudSync/><BibleBookmarkSync/><QuizProgressSync/><VideoBookmarkSync/><main id="main" tabIndex={-1}><PageBoundary key={path} t={t}><Suspense fallback={<div className="loading-state">{t('잠시만 기다려주세요.','Loading…')}</div>}>{content}</Suspense></PageBoundary><Footer/></main></div><nav className="mobile-nav" aria-label={t('모바일 메뉴','Mobile navigation')}>{['home','bible','qt','community','school'].map(id=>{const n=nav.find(n=>n.id===id)!;return <a href={'#'+n.href} key={id} className={root===id?'active':''} aria-current={root===id?'page':undefined}><n.icon size={21}/><span>{id==='sermons'?t('말씀','Messages'):id==='community'?t('나눔','Share'):n.label}</span></a>;})}</nav><Suspense>{language&&<LanguagePicker onClose={()=>setLanguage(false)}/>}</Suspense>{video&&<VideoPlayer video={video} onClose={()=>setVideo(null)}/>} {add&&<AddVideo category={root==='worship'?'worship':'sermon'} onClose={()=>setAdd(false)}/>} {notice&&<div className="toast" role="status"><span>{notice}</span><button onClick={()=>notify('')} aria-label={t('알림 닫기','Dismiss message')}><X size={17}/></button></div>}</>;
}
