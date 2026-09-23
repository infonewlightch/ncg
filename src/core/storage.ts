import type {AppState} from './model';
import {emptyQuiz,readQuiz,readQuizSync,readQuizImports,uuidPattern} from './quiz-progress';
import {readBookmarks,readBookmarkSync} from './bible-bookmarks';
import {parseMedia} from './media';
import {interfaceLanguage} from './languages';
export const initialState:AppState={version:1,ui:'ko',language:'ko',lowData:false,profile:{name:'',nationality:''},videos:[],posts:[],bookmarks:[],completed:[],prayed:[],requests:[],quiz:{...emptyQuiz},quizSourceId:'',quizSync:{baseline:{...emptyQuiz},pending:null,revision:0},quizImports:{},bibleBookmarks:[],bibleSync:{baseline:[],pending:null,revision:0},progressSync:{baseline:[],pending:null,revision:0}};
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:0;
const strings=(v:unknown):string[]=>Array.isArray(v)?v.filter((s):s is string=>typeof s==='string').slice(0,5000):[];
const str=(v:unknown,max=500)=>typeof v==='string'&&v.length<=max;
export function readState(raw:string|null,legacyReader:string|null=null):AppState {
  try {
    const s=JSON.parse(raw||'null');
    if(!s||s.version!==1) return {...structuredClone(initialState),bibleBookmarks:readLegacyBookmarks(legacyReader)};
    const language=typeof s.language==='string'&&/^[a-zA-Z0-9-]{2,40}$/.test(s.language)?s.language:'ko';
    return {...initialState,ui:interfaceLanguage(language),language,lowData:s.lowData===true,
      profile:{name:str(s.profile?.name,80)?s.profile.name:'',nationality:str(s.profile?.nationality,80)?s.profile.nationality:''},
      bibleBookmarks:Array.isArray(s.bibleBookmarks)?readBookmarks(s.bibleBookmarks):readLegacyBookmarks(legacyReader),bibleSync:readBookmarkSync(s.bibleSync),
      bookmarks:strings(s.bookmarks),completed:strings(s.completed).filter(id=>!id.startsWith('quiz:')),prayed:strings(s.prayed),requests:strings(s.requests),
      progressSync:{baseline:strings(s.progressSync?.baseline),revision:count(s.progressSync?.revision),pending:typeof s.progressSync?.pending?.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.progressSync.pending.id)?{id:s.progressSync.pending.id,added:strings(s.progressSync.pending.added),removed:strings(s.progressSync.pending.removed),sent:strings(s.progressSync.pending.sent)}:null},
      quiz:readQuiz(s.quiz),quizSourceId:typeof s.quizSourceId==='string'&&uuidPattern.test(s.quizSourceId)?s.quizSourceId:'',quizSync:readQuizSync(s.quizSync),quizImports:readQuizImports(s.quizImports),
      videos:Array.isArray(s.videos)?s.videos.filter((v:Record<string,unknown>)=>v&&str(v.id)&&str(v.title,160)&&str(v.description,2000)&&str(v.language,40)&&str(v.createdAt)&&typeof v.url==='string'&&parseMedia(v.url)&&['sermon','worship'].includes(String(v.category))).slice(0,500):[],
      posts:Array.isArray(s.posts)?s.posts.filter((p:Record<string,unknown>)=>p&&str(p.id)&&str(p.body,1500)&&str(p.language,40)&&str(p.author,80)&&str(p.nationality,80)&&str(p.createdAt)&&['prayer','story'].includes(String(p.category))).slice(0,200):[]};
  } catch {return structuredClone(initialState);}
}

function readLegacyBookmarks(raw:string|null){try{return readBookmarks(JSON.parse(raw||'null')?.bookmarks);}catch{return [];}}
