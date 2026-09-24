import {useEffect,useMemo,useRef,useState} from 'react';
import {Check,Globe,Search} from 'lucide-react';
import {Modal} from './Ui';
import {useApp} from '../state';
import type {Language} from '../core/model';

import {languageName,languageAutonyms,hasInterfaceTranslation} from '../core/languages';
import {interfaceLanguage} from '../core/languages';
import {interfaceSeed,interfaceSeedLanguages} from '../core/interface-seeds';
import {prepareInterface} from '../core/interface-runtime';
export default function LanguagePicker({onClose,onSelect}:{onClose:()=>void;onSelect?:(code:string)=>void}){
 const {state,update,t}=useApp();const [languages,setLanguages]=useState<Language[]>([]);const [limit,setLimit]=useState(60);const [query,setQuery]=useState('');const [custom,setCustom]=useState('');const [error,setError]=useState('');const [selecting,setSelecting]=useState('');
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{import('../data/languages-index.json').then(x=>setLanguages(x.default.map(([iso3,name,code])=>({iso3,name,code:code||iso3})))).catch(()=>setError(t('언어 목록을 불러오지 못했습니다. 아래에서 언어 태그를 직접 입력할 수 있습니다.','The language list could not load. You can enter a language tag below.')));},[]);
 useEffect(()=>setLimit(60),[query]);
 const options=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase();
  const common=[...new Set(['ko','en','es','pt','zh','zh-Hant','hi','ar','fa','th','lo','fr','sw','id','vi','ja','ru','de','it','tr','ms','bn','ur',...interfaceSeedLanguages])];
  const prepared=common.flatMap(code=>{
   const entry=languages.find(l=>l.code===code);
   if(entry)return [entry];
   // Script-specific packs (e.g. Traditional Chinese) share an ISO language entry.
   const base=languages.find(l=>l.code===new Intl.Locale(code).language);
   return base?[{...base,code}]:[];
  });
  if(!q)return prepared;
  const searchable=[...new Map([...prepared,...languages].map(l=>[l.code,l])).values()];
  return searchable.filter(l=>[l.code,l.iso3,l.name,languageAutonyms.get(l.code)||'',languageName(l.code,state.ui)].some(v=>v.toLocaleLowerCase().includes(q)));
 },[languages,query,state.ui]);
 function warm(code:string){if(!onSelect&&interfaceSeed(code))void prepareInterface(interfaceLanguage(code));}
 async function select(code:string){if(selecting)return;if(onSelect){onSelect(code);onClose();return;}setSelecting(code);if(interfaceSeed(code))await prepareInterface(interfaceLanguage(code));if(!mounted.current)return;update(s=>({...s,language:code}));onClose();}
 function applyCustom(){try{const tag=Intl.getCanonicalLocales(custom.trim())[0];if(!tag||tag.length>40)throw Error();select(tag);}catch{setError(t('언어 태그를 확인해주세요. 예: en-GB, zh-Hant, ase','Enter a valid language tag, e.g. en-GB, zh-Hant, ase.'));}}
 return <Modal title={t('모든 언어를 향해','Every language matters')} onClose={onClose}><p className="muted">{t('선택한 언어로 메뉴와 안내문을 번역합니다. 자동번역을 제공할 수 없는 언어는 영어로 안내합니다. 성경은 출판된 역본을 우선하며, 연결된 역본이 없으면 영어 기반 참고 번역을 요청할 수 있습니다.','Menus and guidance are translated into your language. Where automatic translation is unavailable, English remains available. Published Bible editions come first; if no edition is connected, you can request an English-source translation aid.')}</p><label className="search-box"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('언어 이름 또는 코드 검색','Search a language or code')} aria-label={t('언어 검색','Search languages')}/></label><p className="tiny muted">ISO 639-3 · {languages.length.toLocaleString()} {t('개 항목 · 수어 포함','entries · includes sign languages')}</p><div className="language-grid">{options.slice(0,limit).map(l=><button key={l.code} disabled={Boolean(selecting)} aria-busy={selecting===l.code} onPointerEnter={()=>warm(l.code)} onFocus={()=>warm(l.code)} onClick={()=>void select(l.code)} className={state.language===l.code?'selected':''}><span><b dir="auto">{languageName(l.code,l.code)}</b><small>{languageName(l.code,state.ui)} · {l.iso3}{!onSelect&&!hasInterfaceTranslation(l.code)&&<em>{t('자동 화면 번역','Automatic interface translation')}</em>}</small></span>{state.language===l.code?<Check size={17}/>:<Globe size={15}/>}</button>)}</div>{options.length>limit&&<button className="text-link" onClick={()=>setLimit(n=>n+60)}>{t("더 보기","Show more")} · {Math.min(limit,options.length)} / {options.length}</button>}{query&&options.length===0&&<p>{t('일치하는 언어가 없습니다. 아래에서 언어 태그를 지정할 수 있습니다.','No match. You can enter a language tag below.')}</p>}{error&&<p role="alert" className="error">{error}</p>}<details className="custom-language"><summary>{t('지역·문자별 언어 태그 직접 입력','Enter a regional or script language tag')}</summary><label>{t('BCP 47 언어 태그','BCP 47 language tag')}<input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="zh-Hant, en-GB, ase"/></label><button className="button secondary" onClick={applyCustom}>{t('이 언어 선택','Use this language')}</button></details></Modal>;
}
