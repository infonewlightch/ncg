import {useEffect,useRef,useState} from 'react';
import {useVideoTranslation} from './useVideoTranslation';
import {Play,Bookmark,ExternalLink,Globe,Maximize,Minimize} from 'lucide-react';
import {parseMedia,mediaEmbed} from '../core/media';
import {requestVideoLandscape} from '../core/video-orientation';
import type {Video} from '../core/model';
import {useApp} from '../state';
import {Modal,Empty} from './Ui';
import {languageName} from '../core/languages';

export function VideoCard({video,onOpen}:{video:Video;onOpen:(v:Video)=>void}){
 const {state,update,t}=useApp();const copy=useVideoTranslation(video);const media=parseMedia(video.url);const saved=state.bookmarks.includes(video.id);
 return <article className="video-card"><button className="video-cover" onClick={()=>onOpen(video)} aria-label={t('재생: ','Play: ')+copy.title}>{!state.lowData&&media?.kind==='youtube'?<img src={`https://i.ytimg.com/vi/${media.id}/hqdefault.jpg`} alt="" loading="lazy" width="480" height="360"/>:<div className="video-placeholder"><Play size={40}/></div>}<span className="play-circle"><Play size={19} fill="currentColor"/></span><span className="image-label">{languageName(video.language,state.ui)}</span></button><div className="video-info"><span className="eyebrow">{video.category==='worship'?t("예배","WORSHIP"):t("말씀","MESSAGE")}</span><button className="plain title-button" onClick={()=>onOpen(video)}><h3 dir="auto" lang={copy.language}>{copy.title}</h3></button><div className="video-meta"><span>{video.speaker||t('새빛교회','Newlight Church')}</span><button className={`icon-button ${saved?'saved':''}`} aria-label={saved?t('보관 해제','Remove bookmark'):t('말씀 보관','Save message')} aria-pressed={saved} onClick={()=>update(s=>({...s,bookmarks:s.bookmarks.includes(video.id)?s.bookmarks.filter(id=>id!==video.id):[...s.bookmarks,video.id]}))}><Bookmark size={18} fill={saved?'currentColor':'none'}/></button></div></div></article>;
}
type FullscreenStage=HTMLDivElement&{webkitRequestFullscreen?:()=>void};
type FullscreenVideo=HTMLVideoElement&{webkitEnterFullscreen?:()=>void;webkitExitFullscreen?:()=>void};
type FullscreenDocument=Document&{webkitFullscreenElement?:Element|null;webkitExitFullscreen?:()=>void};
export function VideoPlayer({video,onClose}:{video:Video;onClose:()=>void}){
 const {state,t}=useApp();const copy=useVideoTranslation(video);const [playing,setPlaying]=useState(false);const [failed,setFailed]=useState(false);const media=parseMedia(video.url);
 const stage=useRef<FullscreenStage>(null),file=useRef<FullscreenVideo>(null),ownsFullscreen=useRef(false),nativeVideo=useRef(false);
 const [view,setView]=useState<'inline'|'expanded'|'fullscreen'>('inline');const expanded=view!=='inline';
 useEffect(()=>{
  let releaseOrientation=()=>{};
  const sync=()=>{const doc=document as FullscreenDocument;const active=doc.fullscreenElement||doc.webkitFullscreenElement;if(active&&stage.current?.contains(active)){if(!ownsFullscreen.current)releaseOrientation=requestVideoLandscape(screen.orientation);ownsFullscreen.current=true;setView('fullscreen');}else if(ownsFullscreen.current){releaseOrientation();ownsFullscreen.current=false;setView('inline');}};
  document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);return()=>{releaseOrientation();document.removeEventListener('fullscreenchange',sync);document.removeEventListener('webkitfullscreenchange',sync);};
 },[]);
 useEffect(()=>{const element=file.current;if(!element)return;const done=()=>{nativeVideo.current=false;setView('inline');};element.addEventListener('webkitendfullscreen',done);return()=>element.removeEventListener('webkitendfullscreen',done);},[playing]);
 async function expand(){
  const element=stage.current;if(!element||!media)return;setPlaying(true);setView('expanded');
  try{
   if(element.requestFullscreen)await element.requestFullscreen();
   else if(element.webkitRequestFullscreen)element.webkitRequestFullscreen();
   else if(file.current?.webkitEnterFullscreen){file.current.webkitEnterFullscreen();nativeVideo.current=true;setView('fullscreen');}
  }catch{if(element.isConnected)setView('expanded');}
 }
 async function shrink(){
  const doc=document as FullscreenDocument;const active=doc.fullscreenElement||doc.webkitFullscreenElement;
  try{
   if(active&&stage.current?.contains(active)){if(doc.exitFullscreen)await doc.exitFullscreen();else doc.webkitExitFullscreen?.();}
   else if(nativeVideo.current){file.current?.webkitExitFullscreen?.();nativeVideo.current=false;}
   setView('inline');
  }catch{ /* Keep the exit control available if the browser refuses to exit. */ }
 }
 return <Modal wide className={`video-modal ${expanded?'video-expanded':''}`} title={copy.title} onClose={()=>expanded?void shrink():onClose()}>
  <div ref={stage} className="video-stage">
   <div className="player">{!playing?<button className="player-start" aria-label={t('영상 재생','Play video')} onClick={()=>setPlaying(true)}><span className="play-circle"><Play size={28} fill="currentColor"/></span><b>{t('영상 재생','Play video')}</b><small>{t('재생을 누르면 영상 서비스에 연결됩니다.','Connects to the video provider when you play.')}</small></button>:media?.kind==='youtube'?<iframe title={copy.title} src={mediaEmbed(media,state.language)} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:media?.kind==='file'?<video ref={file} src={media.url} controls autoPlay playsInline onError={()=>setFailed(true)}/>:null}</div>
   <div className="video-controls"><button type="button" onClick={()=>void (expanded?shrink():expand())} disabled={!media}>{expanded?<Minimize size={19}/>:<Maximize size={19}/>}<span>{view==='fullscreen'?t('전체화면 종료','Exit fullscreen'):expanded?t('확대 종료','Exit expanded view'):t('전체화면','Fullscreen')}</span></button>{media&&<a href={media.url} target="_blank" rel="noreferrer">{media.kind==='youtube'?t('YouTube에서 열기','Open in YouTube'):t('원본에서 열기','Open original')}<ExternalLink size={17}/></a>}</div>
   {view==='expanded'&&<p className="video-screen-note" role="status">{t('이 브라우저에서는 화면 확대 보기로 전환됩니다.','Using expanded view in this browser.')}</p>}
   {expanded&&<p className="video-screen-note video-rotate-hint">{t('휴대폰을 가로로 돌리면 더 크게 볼 수 있어요.','Rotate your phone sideways for a wider view.')}</p>}
  </div>
  <div className="video-details">
   {failed&&<p className="error" role="alert">{t('영상 파일에 연결하지 못했습니다. 주소와 접근 권한을 확인해주세요.','Could not load this file. Check the URL and access permissions.')}</p>}
   <p className="tiny muted">{video.speaker}{video.speaker&&video.scripture?' · ':''}{video.scripture}{video.recordedOn?' · '+video.recordedOn:''}</p>
   <p className="muted video-description" dir="auto" lang={copy.language}>{copy.description||t('말씀과 함께하는 시간을 가져보세요.','Take a moment with the Word.')}</p>
   {copy.status==='done'&&<div className="translation-status"><span>{t('자동 번역','Automatic translation')}</span><button onClick={copy.toggle}>{copy.original?t('번역 보기','Show translation'):t('원문 보기','Show original')}</button></div>}
   {copy.status==='loading'&&<p className="translation-status" role="status">{t('내 언어로 번역 중…','Translating into your language…')}</p>}
   {copy.status==='unavailable'&&<p className="translation-status">{t('이 언어의 번역을 불러오지 못해 원문으로 표시합니다.','Translation unavailable for this language · showing original.')}</p>}
   {media?.kind==='youtube'&&<div className="video-language-help"><div className="callout"><Globe size={19}/><span>{t('영상의 설정(⚙)에서 오디오 트랙과 자막 언어를 각각 선택하세요.','Choose your audio track and subtitles separately in the video settings (⚙).')}</span></div>{Boolean(video.audioLanguages?.length)&&<p><b>{t('오디오 더빙','Dubbed audio')}</b><span>{video.audioLanguages!.map(code=>languageName(code,state.ui)).join(' · ')}</span></p>}{Boolean(video.captionLanguages?.length)&&<p><b>{t('자막','Subtitles')}</b><span>{video.captionLanguages!.map(code=>languageName(code,state.ui)).join(' · ')}</span></p>}</div>}
  </div>
 </Modal>;
}
export function EmptyVideos(){const {t}=useApp();return <Empty title={t('아직 이 말씀을 찾지 못했어요.','No messages here yet.')}><p>{t('핵심 말씀 콘텐츠는 누구나 무료로 이용할 수 있습니다.','Core Gospel content is free and open to everyone.')}</p></Empty>;}
