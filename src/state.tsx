import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import type {BookmarkStatus} from './core/bible-bookmarks';
import {uuidPattern,type QuizSyncStatus} from './core/quiz-progress';
import type {AppState} from './core/model';
import {initialState,readState} from './core/storage';
import {interfaceLanguage} from './core/languages';
import {translateInterface} from './core/interface';

type Store={videoBookmarkStatus:BookmarkStatus;setVideoBookmarkStatus:(status:BookmarkStatus)=>void;quizStatus:QuizSyncStatus;setQuizStatus:(status:QuizSyncStatus)=>void;bookmarkStatus:BookmarkStatus;setBookmarkStatus:(status:BookmarkStatus)=>void;state:AppState;update:(fn:(s:AppState)=>AppState)=>void;t:(ko:string,en:string)=>string;storageError:boolean;notice:string;notify:(message:string)=>void};
const Context=createContext<Store|null>(null);
export function Provider({children,storageKey='ncg:v1'}:{children:ReactNode;storageKey?:string}){
  const [state,setState]=useState(()=>{try{const saved=readState(localStorage.getItem(storageKey),storageKey==='ncg:v1'?localStorage.getItem('ncg:reader:v1'):null);return {...saved,quizSourceId:uuidPattern.test(saved.quizSourceId)?saved.quizSourceId:crypto.randomUUID()};}catch{return {...structuredClone(initialState),quizSourceId:crypto.randomUUID()};}});
  const [storageError,setStorageError]=useState(false);
  const [notice,setNotice]=useState('');
  const [bookmarkStatus,setBookmarkStatus]=useState<BookmarkStatus>('waiting');
  const [videoBookmarkStatus,setVideoBookmarkStatus]=useState<BookmarkStatus>('waiting');
  const [quizStatus,setQuizStatus]=useState<QuizSyncStatus>('waiting');
  useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.storageArea===localStorage&&event.key===storageKey)setState(readState(event.newValue));};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[storageKey]);
  useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(state));setStorageError(false);}catch{setStorageError(true);}},[state,storageKey]);
  function update(fn:(s:AppState)=>AppState){setState(previous=>{const next=fn(previous);return {...next,ui:interfaceLanguage(next.language)};});}
  const t=(ko:string,en:string)=>translateInterface(ko,en,state.ui);
  return <Context.Provider value={{state,update,t,storageError,notice,notify:setNotice,bookmarkStatus,setBookmarkStatus,quizStatus,setQuizStatus,videoBookmarkStatus,setVideoBookmarkStatus}}>{children}</Context.Provider>;
}
export function useApp(){const value=useContext(Context);if(!value)throw Error('Provider required');return value;}
