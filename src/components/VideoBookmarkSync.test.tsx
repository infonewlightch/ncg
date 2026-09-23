import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {parseHTML} from 'linkedom';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({read:vi.fn(),write:vi.fn()}));
vi.mock('../auth',()=>({useAuth:()=>({session:{user:{id:'test'}}}),supabase:{from:()=>({select:()=>({eq:()=>({abortSignal:()=>({maybeSingle:()=>mocks.read()})})})}),rpc:(_name:string,args:unknown)=>({abortSignal:()=>mocks.write(args)})}}));
import {Provider,useApp} from '../state';
import {VideoBookmarkSync,VideoBookmarkStatus} from './VideoBookmarkSync';
import {initialState} from '../core/storage';
let root:Root,container:HTMLElement,storage:Map<string,string>;
const one='10000000-0000-4000-8000-000000000001',local='10000000-0000-4000-8000-000000000002';
const response=(items:string[],revision:number)=>({data:{items,revision},error:null});
function Workspace(){const {state,update}=useApp();return <><VideoBookmarkSync/><VideoBookmarkStatus/><button onClick={()=>update(s=>({...s,bookmarks:s.bookmarks.filter(id=>id!==one)}))}>remove</button><output>{JSON.stringify(state.bookmarks)}</output></>;}
const render=()=>root.render(<Provider storageKey="ncg:user:test:v1"><Workspace/></Provider>);
const tick=async()=>act(async()=>vi.advanceTimersByTimeAsync(600));
beforeEach(()=>{
 vi.resetAllMocks();vi.useFakeTimers();const {window}=parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');Object.defineProperty(window.document,'visibilityState',{value:'visible'});storage=new Map();
 storage.set('ncg:user:test:v1',JSON.stringify({...initialState,bookmarks:[local,one],videos:[{id:local,title:'Personal title',description:'',url:'https://example.com/private.mp4',language:'ko',category:'sermon',createdAt:'2026-09-24'}]}));
 vi.stubGlobal('window',window);vi.stubGlobal('document',window.document);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)});
 container=document.getElementById('root')!;root=createRoot(container);mocks.read.mockResolvedValue(response([],0));
});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();vi.useRealTimers();});
it('uploads only church references and preserves an in-flight removal alongside private local bookmarks',async()=>{
 let resolve!:(value:ReturnType<typeof response>)=>void;mocks.write.mockReturnValueOnce(new Promise(done=>{resolve=done;})).mockResolvedValueOnce(response([],2));
 await act(async()=>render());await tick();expect(mocks.write.mock.calls[0][0]).toMatchObject({added:[one],removed:[]});
 expect(JSON.stringify(mocks.write.mock.calls)).not.toContain(local);expect(JSON.stringify(mocks.write.mock.calls)).not.toContain('private.mp4');
 await act(async()=>container.querySelector('button')!.click());await act(async()=>resolve(response([one],1)));expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual([local]);
 await tick();expect(mocks.write.mock.calls[1][0]).toMatchObject({added:[],removed:[one]});expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual([local]);
});
it('keeps pending changes after a connection failure and retries the same operation on reconnect',async()=>{
 mocks.write.mockResolvedValueOnce({data:null,error:{message:'offline'}}).mockResolvedValueOnce(response([one],1));
 await act(async()=>render());await tick();expect(container.textContent).toContain('영상 책갈피 동기화가 지연');mocks.read.mockResolvedValue(response([one],1));
 await act(async()=>window.dispatchEvent(new window.Event('online')));expect(mocks.write.mock.calls[1][0]).toEqual(mocks.write.mock.calls[0][0]);
 expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual([local,one]);expect(container.textContent).toContain('교회 영상 책갈피가 계정에 저장되었습니다.');
});
