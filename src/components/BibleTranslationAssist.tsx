import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Languages} from 'lucide-react';
import {useApp} from '../state';
import {languageName} from '../core/languages';
import type {BiblePassage} from '../core/bible';
type Result={source:string;language:string;chapter:string;start:number;reviewed:boolean;verses:{id:string;text:string}[]};

/** A separately labelled reading aid. The published English source stays visible below. */
export function BibleTranslationAssist({language,source,selected}:{language:string;source:BiblePassage;selected:string}){
 const {state,t}=useApp();const [start,setStart]=useState(0);const [result,setResult]=useState<Result|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const controller=useRef<AbortController|null>(null);
 const verses=source.verses||[];const range=verses.slice(start,start+6);const rangeLabel=`${source.reference}:${range[0]?.number||''}–${range.at(-1)?.number||''}`;
 useEffect(()=>{const verse=Number(selected.split('.')[2]?.split('-')[0]);const position=verses.findIndex(v=>Number(v.number)===verse);if(position>=0)setStart(Math.floor(position/6)*6);},[selected]);
 useEffect(()=>{controller.current?.abort();setResult(null);setError('');setBusy(false);return()=>controller.current?.abort();},[language,source.id,start]);
 async function translate(){
  if(busy)return;controller.current?.abort();const request=new AbortController();controller.current=request;setBusy(true);setError('');
  try{
   const response=await fetch('/api/bible-translation',{method:'POST',signal:request.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({language,chapter:source.id,start})});const data=await response.json().catch(()=>({error:'translation_unavailable'}));
   if(!response.ok)throw Error(data.error||(response.status===429?'translation_busy':'translation_unavailable'));
   if(data.source!=='WEBP'||data.language!==language||data.chapter!==source.id||data.start!==start||data.reviewed!==false||!Array.isArray(data.verses))throw Error('translation_unavailable');
   if(!request.signal.aborted)setResult(data);
  }catch(e){if(!request.signal.aborted)setError(e instanceof Error?e.message:'translation_unavailable');}finally{if(!request.signal.aborted)setBusy(false);}
 }
 if(!range.length)return null;
 return <section className="bible-translation-assist" aria-label={t('영어 원문 기반 참고 번역','English-source translation aid')} lang={state.ui} dir="ltr">
  <div className="translation-aid-title"><Languages size={21}/><div><b>{t('영어 원문 기반 참고 번역','English-source translation aid')}</b><small>{languageName(language,state.ui)} · {t('자동번역 · 검수 전','Automatic translation · Unreviewed')}</small></div></div>
  <p>{t('현재 연결된 역본에서 이 언어를 찾지 못했습니다. 영어 WEB 성경을 바탕으로 참고 번역을 요청할 수 있습니다. 정식 성경 역본이 아니며, 번역 오류가 있을 수 있습니다. 영어 원문은 아래에서 함께 읽을 수 있습니다.','No connected edition was found for this language. You can request a reading aid translated from the English WEB Bible. It is not a published Bible edition and may contain errors. Read the English source below alongside it.')}</p>
  <a className="text-link" href="https://www.bible.com/languages" target="_blank" rel="noreferrer">{t('YouVersion에서 성경 읽기','Read on YouVersion')} ↗</a><div className="translation-range"><button className="icon-button" disabled={start===0||busy} onClick={()=>setStart(n=>Math.max(0,n-6))} aria-label={t('이전 구절','Previous verses')}><ArrowLeft size={18}/></button><b dir="auto">{rangeLabel}</b><button className="icon-button" disabled={start+6>=verses.length||busy} onClick={()=>setStart(n=>n+6)} aria-label={t('다음 구절','Next verses')}><ArrowRight size={18}/></button></div>
  {!result&&<button className="button secondary" onClick={()=>void translate()} disabled={busy}>{busy?t('번역하고 있습니다…','Translating…'):t('이 구절들을 내 언어로 번역','Translate these verses into my language')}</button>}
  {busy&&<p role="status">{t('잠시 기다려주세요. 영어 원문은 계속 읽을 수 있습니다.','Please wait. You can keep reading the English source.')}</p>}
  {error&&<p role="alert">{error==='unsupported_language'?t('이 언어로 신뢰할 수 있는 자동번역을 제공하지 못했습니다. 다른 언어나 영어 원문을 선택해주세요.','A reliable automatic translation could not be provided in this language. Choose another language or read the English source.'):error==='translation_daily_limit'?t('오늘의 새 참고 번역 요청이 모두 사용되었습니다. 영어 원문은 계속 읽을 수 있으며, 다음 날 다시 번역을 요청할 수 있습니다.','New reference translations have reached today’s limit. You can keep reading English and request another translation tomorrow.'):error==='translation_busy'?t('번역 요청이 많습니다. 잠시 후 다시 시도해주세요.','Translation is busy. Please try again later.'):error==='published_version_available'?t('이 언어의 출판된 역본이 확인되었습니다. 언어를 다시 선택해주세요.','A published edition is available for this language. Please select your language again.'):t('지금은 번역을 불러오지 못했습니다. 영어 원문을 읽거나 나중에 다시 시도해주세요.','Translation is unavailable right now. Read the English source or try again later.')}</p>}
  {result&&<div className="reference-translation" lang={language} dir="auto">{result.verses.map(v=><p key={v.id}><sup>{v.id.split('.')[2]}</sup> {v.text}</p>)}</div>}
  <p className="translation-source-note">{t('출처: World English Bible (공개 저작물). 자동번역은 교회나 출판사의 검수를 거치지 않았습니다.','Source: World English Bible (public domain). This automatic translation has not been reviewed by the church or a Bible publisher.')}</p>
 </section>;
}
