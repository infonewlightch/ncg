import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {Check,ChevronDown,Globe,Search} from 'lucide-react';
import {useApp} from '../state';
import {countryName,resolveCountry,searchCountries} from '../core/countries';
import {Modal} from './Ui';

const flags=import.meta.glob('/node_modules/flag-icons/flags/4x3/*.svg',{eager:true,query:'?url&no-inline',import:'default'}) as Record<string,string>;
export function CountryLabel({value}:{value:string}){
 const {state}=useApp();const code=resolveCountry(value);
 return <span className="country-label">{code&&<img className="country-flag" src={flags[`/node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`]} alt="" width="24" height="18" loading="lazy"/>}<span dir="auto">{code?countryName(code,state.language):value}</span></span>;
}

export function CountrySelect({value,onChange,disabled=false}:{value:string;onChange:(code:string)=>void;disabled?:boolean}){
 const {state,t}=useApp();const [open,setOpen]=useState(false);const [query,setQuery]=useState('');const [active,setActive]=useState(0);const id=useId();const list=useRef<HTMLDivElement>(null);
 const code=resolveCountry(value);const options=useMemo(()=>searchCountries(query,state.language),[query,state.language]);
 useEffect(()=>{list.current?.querySelector('[data-active="true"]')?.scrollIntoView({block:'nearest'});},[active]);
 function select(selected:string){onChange(selected);setOpen(false);}
 return <div className="country-field"><span id={`${id}-label`} className="field-label">{t('국적','Nationality')}</span><button type="button" className="select-button country-trigger" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={()=>{setQuery('');setActive(0);setOpen(true);}}><span id={`${id}-value`}>{code?<CountryLabel value={code}/>:<span className="country-label"><Globe size={19}/>{t('국가 선택','Select a country')}</span>}</span><ChevronDown size={17}/></button>{value&&!code&&<small className="muted">{t('기존 국적을 목록에서 다시 선택해주세요.','Please reselect your nationality from the list.')}</small>}{open&&<Modal title={t('국가 선택','Select a country')} onClose={()=>setOpen(false)}><label className="search-box country-search"><Search size={18}/><input autoFocus type="search" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls={`${id}-list`} aria-activedescendant={options[active]?`${id}-${options[active].code}`:undefined} aria-label={t('국가 검색','Search countries')} placeholder={t('국가명 또는 코드 검색','Search by country name or code')} value={query} onChange={e=>{setQuery(e.target.value);setActive(0);}} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setActive(index=>Math.max(0,Math.min(options.length-1,index+(e.key==='ArrowDown'?1:-1))));}else if(e.key==='Enter'){e.preventDefault();if(options[active])select(options[active].code);}}}/></label><p className="tiny muted" role="status">{options.length} {t('개 국가·지역','countries and regions')}</p><div id={`${id}-list`} ref={list} role="listbox" aria-label={t('국가 목록','Country list')} className="country-options">{options.map((country,index)=><button id={`${id}-${country.code}`} type="button" role="option" aria-selected={code===country.code} data-active={index===active} key={country.code} onClick={()=>select(country.code)}><CountryLabel value={country.code}/><span className="country-option-meta"><small>{country.code}</small>{code===country.code&&<Check size={18}/>}</span></button>)}</div>{!options.length&&<p>{t('검색 결과가 없습니다. 국가명이나 코드를 다시 확인해주세요.','No countries found. Check the country name or code.')}</p>}</Modal>}</div>;
}
