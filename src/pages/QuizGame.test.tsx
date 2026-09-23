import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {parseHTML} from 'linkedom';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
vi.mock('../auth',()=>({supabase:null,useAuth:()=>({session:null})}));
import {Provider} from '../state';
import QuizGame from './QuizGame';
let root:Root,container:HTMLElement,storage:Map<string,string>;
const button=(text:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent===text)!;
beforeEach(()=>{
 const {window}=parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');storage=new Map();
 vi.stubGlobal('window',window);vi.stubGlobal('document',window.document);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>Array.from({length:5},(_,i)=>({id:String(i),book:'요한복음',testament:'new',level:'easy',hint:'hint',lang:'ko',question:`Question ${i+1}`,options:['Correct','Wrong 1','Wrong 2','Wrong 3'],answer:0,explanation:'Explanation'}))}));
 container=document.getElementById('root')!;root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();});
it('counts rapid repeated answer/next/result actions only once and restores the round after reload',async()=>{
 await act(async()=>root.render(<Provider><QuizGame/></Provider>));
 await act(async()=>button('도전 시작').click());
 for(let i=0;i<5;i++){
  const answer=[...container.querySelectorAll('.quiz-options button')].find(b=>b.textContent?.endsWith('Correct')) as HTMLButtonElement;
  await act(async()=>{answer.click();answer.click();});
  expect(JSON.parse(storage.get('ncg:v1')!).quiz.answered).toBe(i+1);
  const next=button(i===4?'결과 보기':'다음 문제');await act(async()=>{next.click();next.click();});
 }
 const saved=JSON.parse(storage.get('ncg:v1')!);expect(saved.quiz).toEqual({answered:5,correct:5,rounds:1,bestScore:70,bestStreak:5});
 await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(<Provider><QuizGame/></Provider>));
 expect(container.textContent).toContain('나의 최고 점수 · 70');expect(JSON.parse(storage.get('ncg:v1')!).quiz).toEqual(saved.quiz);
});
