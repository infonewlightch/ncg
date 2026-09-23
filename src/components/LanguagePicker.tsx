import {useEffect,useMemo,useState} from 'react';
import {Check,Globe,Search} from 'lucide-react';
import {Modal} from './Ui';
import {useApp} from '../state';
import type {Language} from '../core/model';

import {languageName,hasInterfaceTranslation} from '../core/languages';
export default function LanguagePicker({onClose,onSelect}:{onClose:()=>void;onSelect?:(code:string)=>void}){
 const {state,update,t}=useApp();const [languages,setLanguages]=useState<Language[]>([]);const [limit,setLimit]=useState(60);const [query,setQuery]=useState('');const [custom,setCustom]=useState('');const [error,setError]=useState('');
 useEffect(()=>{import('../data/languages-index.json').then(x=>setLanguages(x.default.map(([iso3,name,code])=>({iso3,name,code:code||iso3})))).catch(()=>setError(t('언어 목록을 불러오지 못했습니다. 아래에서 언어 태그를 직접 입력할 수 있습니다.','The language list could not load. You can enter a language tag below.')));},[]);
 useEffect(()=>setLimit(60),[query]);
 const options=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase();
  const common=['ko','en','es','pt','zh','hi','ar','fa','th','lo','fr','sw','id','vi','ja','ru'];
  if(!q)return common.flatMap(c=>languages.filter(l=>l.code===c));
  return languages.filter(l=>[l.code,l.iso3,l.name,languageName(l.code,state.ui)].some(v=>v.toLocaleLowerCase().includes(q)));
 },[languages,query,state.ui]);
 function select(code:string){if(onSelect)onSelect(code);else update(s=>({...s,language:code}));onClose();}
 function applyCustom(){try{const tag=Intl.getCanonicalLocales(custom.trim())[0];if(!tag||tag.length>40)throw Error();select(tag);}catch{setError(t('언어 태그를 확인해주세요. 예: en-GB, zh-Hant, ase','Enter a valid language tag, e.g. en-GB, zh-Hant, ase.'));}}
 return <Modal title={t('모든 언어를 향해','Every language matters')} onClose={onClose}><p className="muted">{t('선택한 언어를 메뉴와 콘텐츠에 함께 적용합니다. 아직 번역되지 않은 화면은 영어로 안내하며, 성경은 정식 역본이 있을 때만 표시합니다.','Your language applies to menus and content. Untranslated screens use English. Scripture is shown only from an available Bible version.')}</p><label className="search-box"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('언어 이름 또는 코드 검색','Search a language or code')} aria-label={t('언어 검색','Search languages')}/></label><p className="tiny muted">ISO 639-3 · {languages.length.toLocaleString()} {t('개 항목 · 수어 포함','entries · includes sign languages')}</p><div className="language-grid">{options.slice(0,limit).map(l=><button key={l.iso3} onClick={()=>select(l.code)} className={state.language===l.code?'selected':''}><span><b dir="auto">{languageName(l.code,l.code)}</b><small>{languageName(l.code,state.ui)} · {l.iso3}{!onSelect&&!hasInterfaceTranslation(l.code)&&<em>{t('화면 번역 준비 중','Interface translation pending')}</em>}</small></span>{state.language===l.code?<Check size={17}/>:<Globe size={15}/>}</button>)}</div>{options.length>limit&&<button className="text-link" onClick={()=>setLimit(n=>n+60)}>{t("더 보기","Show more")} · {Math.min(limit,options.length)} / {options.length}</button>}{query&&options.length===0&&<p>{t('일치하는 언어가 없습니다. 아래에서 언어 태그를 지정할 수 있습니다.','No match. You can enter a language tag below.')}</p>}{error&&<p role="alert" className="error">{error}</p>}<details className="custom-language"><summary>{t('지역·문자별 언어 태그 직접 입력','Enter a regional or script language tag')}</summary><label>{t('BCP 47 언어 태그','BCP 47 language tag')}<input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="zh-Hant, en-GB, ase"/></label><button className="button secondary" onClick={applyCustom}>{t('이 언어 선택','Use this language')}</button></details></Modal>;
}
