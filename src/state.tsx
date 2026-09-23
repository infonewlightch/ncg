import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import type {AppState} from './core/model';
import {initialState,readState} from './core/storage';
import {interfaceLanguage} from './core/languages';
import {translateInterface} from './core/interface';

type Store={state:AppState;update:(fn:(s:AppState)=>AppState)=>void;t:(ko:string,en:string)=>string;storageError:boolean;notice:string;notify:(message:string)=>void};
const Context=createContext<Store|null>(null);
export function Provider({children,storageKey='ncg:v1'}:{children:ReactNode;storageKey?:string}){
  const [state,setState]=useState(()=>{try{return readState(localStorage.getItem(storageKey));}catch{return structuredClone(initialState);}});
  const [storageError,setStorageError]=useState(false);
  const [notice,setNotice]=useState('');
  useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.storageArea===localStorage&&event.key===storageKey)setState(readState(event.newValue));};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[storageKey]);
  useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(state));setStorageError(false);}catch{setStorageError(true);}},[state,storageKey]);
  function update(fn:(s:AppState)=>AppState){setState(previous=>{const next=fn(previous);return {...next,ui:interfaceLanguage(next.language)};});}
  const t=(ko:string,en:string)=>translateInterface(ko,en,state.ui);
  return <Context.Provider value={{state,update,t,storageError,notice,notify:setNotice}}>{children}</Context.Provider>;
}
export function useApp(){const value=useContext(Context);if(!value)throw Error('Provider required');return value;}
