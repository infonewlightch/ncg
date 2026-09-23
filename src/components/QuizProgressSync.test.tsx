import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {parseHTML} from 'linkedom';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({read:vi.fn(),write:vi.fn(),session:{user:{id:'account-a'}}}));
vi.mock('../auth',()=>({useAuth:()=>({session:mocks.session}),supabase:{from:()=>({select:()=>({eq:()=>({abortSignal:()=>({maybeSingle:()=>mocks.read()})})})}),rpc:(_name:string,args:unknown)=>({abortSignal:()=>mocks.write(args)})}}));
import {Provider,useApp} from '../state';
import {QuizProgressSync,QuizSaveStatus} from './QuizProgressSync';
import {emptyQuiz} from '../core/quiz-progress';
let root:Root,container:HTMLElement,storage:Map<string,string>;
const response=(answered:number,revision:number)=>({data:{answered,correct:answered,rounds:0,best_score:0,best_streak:0,revision},error:null});
function Workspace(){const {state,update}=useApp();return <><QuizProgressSync/><QuizSaveStatus/><button onClick={()=>update(s=>({...s,quiz:{...s.quiz,answered:s.quiz.answered+1,correct:s.quiz.correct+1}}))}>answer</button><output>{state.quiz.answered}</output></>;}
const render=()=>root.render(<Provider key={mocks.session.user.id} storageKey={`ncg:user:${mocks.session.user.id}:v1`}><Workspace/></Provider>);
const answer=async()=>act(async()=>container.querySelector('button')!.click());
const tick=async(ms=800)=>act(async()=>vi.advanceTimersByTimeAsync(ms));
beforeEach(()=>{
 vi.resetAllMocks();vi.useFakeTimers();mocks.session={user:{id:'account-a'}};
 const {window}=parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');Object.defineProperty(window.document,'visibilityState',{value:'visible'});storage=new Map();
 vi.stubGlobal('window',window);vi.stubGlobal('document',window.document);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)});
 container=document.getElementById('root')!;root=createRoot(container);mocks.read.mockResolvedValue(response(0,0));
});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();vi.useRealTimers();});
it('retries an uncertain write with the original ID, without adding a confirmed server total twice',async()=>{
 mocks.write.mockResolvedValueOnce({data:null,error:{message:'network_failed'}}).mockResolvedValueOnce(response(1,1));
 await act(async()=>render());await answer();await tick();expect(mocks.write).toHaveBeenCalledTimes(1);
 expect(container.textContent).toContain('퀴즈 동기화가 지연');mocks.read.mockResolvedValue(response(1,1));
 await act(async()=>window.dispatchEvent(new window.Event('online')));
 expect(mocks.write).toHaveBeenCalledTimes(2);expect(mocks.write.mock.calls[1][0]).toEqual(mocks.write.mock.calls[0][0]);
 expect(container.querySelector('output')!.textContent).toBe('1');expect(container.textContent).toContain('퀴즈 기록이 계정에 저장');
 expect(JSON.parse(storage.get('ncg:user:account-a:v1')!).quizSync.pending).toBeNull();
});
it('preserves new answers during an in-flight save and sends only the remaining change',async()=>{
 let resolve!:(value:ReturnType<typeof response>)=>void;mocks.write.mockReturnValueOnce(new Promise(done=>{resolve=done;})).mockResolvedValueOnce(response(2,2));
 await act(async()=>render());await answer();await tick();await answer();await act(async()=>resolve(response(1,1)));
 expect(container.querySelector('output')!.textContent).toBe('2');await tick();
 expect(mocks.write.mock.calls[1][0].delta).toEqual({...emptyQuiz,answered:1,correct:1});
 expect(container.querySelector('output')!.textContent).toBe('2');
});
it('does not apply an old account response after switching accounts',async()=>{
 let resolve!:(value:ReturnType<typeof response>)=>void;mocks.write.mockReturnValueOnce(new Promise(done=>{resolve=done;}));
 await act(async()=>render());await answer();await tick();mocks.session={user:{id:'account-b'}};await act(async()=>render());
 await act(async()=>resolve(response(1,1)));expect(container.querySelector('output')!.textContent).toBe('0');
 expect(JSON.parse(storage.get('ncg:user:account-a:v1')!).quizSync.pending).not.toBeNull();expect(JSON.parse(storage.get('ncg:user:account-b:v1')!).quiz).toEqual(emptyQuiz);
});
