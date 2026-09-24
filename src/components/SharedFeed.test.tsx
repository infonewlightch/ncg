// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({feed:vi.fn()}));
vi.mock('../auth',()=>({useAuth:()=>({session:{user:{id:'member'}}}),supabase:{rpc:(_name:string,args:unknown)=>{const result={abortSignal:()=>result,then:(done:any,fail:any)=>mocks.feed(args).then(done,fail)};return result;}}}));
vi.mock('../state',()=>({useApp:()=>({state:{ui:'en',language:'en',posts:[],prayed:[]},t:(_ko:string,en:string)=>en,notify:()=>{},update:()=>{}})}));
import {SharedFeed,type ServerPost} from './SharedFeed';
let root:Root,container:HTMLElement;
const post=(id:string):ServerPost=>({id,body:id,author:'Member',authorId:'writer',nationality:'Korea',language:'en',category:'story',createdAt:'2026-09-23T12:00:00Z',status:'published',prayerCount:0,hasPrayed:false});
const response=(ids:string[])=>({data:ids.map(post),error:null});
const firstPage=()=>response(Array.from({length:30},(_,i)=>`Original reflection ${i+1}`));
const button=(name:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent===name)!;
const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
beforeEach(()=>{vi.resetAllMocks();document.body.innerHTML='<div id="root"></div>';vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.getElementById('root')!;root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();});
it('does not append an old page after changing the QT passage',async()=>{
 const old=deferred();mocks.feed.mockResolvedValueOnce(firstPage()).mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(['New passage reflection']));
 await act(async()=>root.render(<SharedFeed topic="qt:11111111-1111-4111-8111-111111111111"/>));
 await act(async()=>button('More reflections').click());
 await act(async()=>root.render(<SharedFeed topic="qt:22222222-2222-4222-8222-222222222222"/>));
 await act(async()=>old.resolve(response(['Previous passage late page'])));
 expect(container.textContent).toContain('New passage reflection');expect(container.textContent).not.toContain('Previous passage late page');
});
it('does not restore withdrawn results from a pagination request after refreshing',async()=>{
 const old=deferred();mocks.feed.mockResolvedValueOnce(firstPage()).mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(['Current visible reflection']));
 await act(async()=>root.render(<SharedFeed/>));await act(async()=>button('More reflections').click());await act(async()=>button('Refresh reflections').click());
 await act(async()=>old.resolve(response(['Withdrawn late reflection'])));
 expect(container.textContent).toContain('Current visible reflection');expect(container.textContent).not.toContain('Withdrawn late reflection');
});
it('requests the next page only once for rapid repeated clicks',async()=>{
 const pending=deferred();mocks.feed.mockResolvedValueOnce(firstPage()).mockReturnValue(pending.promise);
 await act(async()=>root.render(<SharedFeed/>));await act(async()=>{button('More reflections').click();button('More reflections').click();});
 expect(mocks.feed).toHaveBeenCalledTimes(2);await act(async()=>pending.resolve(response(['Next reflection'])));
 expect([...container.querySelectorAll('.post-body')].filter(p=>p.textContent==='Next reflection')).toHaveLength(1);
});
it('loads replies for the selected parent without adding nested reply controls',async()=>{
 mocks.feed.mockResolvedValueOnce(response(['Parent reflection'])).mockResolvedValueOnce(response(['A reply']));
 await act(async()=>root.render(<SharedFeed/>));await act(async()=>button('Comments').click());
 expect(mocks.feed).toHaveBeenLastCalledWith({parent:'Parent reflection'});
 expect(container.textContent).toContain('A reply');expect([...container.querySelectorAll('button')].filter(b=>b.textContent==='Comments')).toHaveLength(1);
});
it('discards a previous parent’s comments when switching conversations',async()=>{
 const old=deferred();mocks.feed.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(['Current reply']));
 await act(async()=>root.render(<SharedFeed parent="first"/>));await act(async()=>root.render(<SharedFeed parent="second"/>));
 await act(async()=>old.resolve(response(['Old reply'])));expect(container.textContent).toContain('Current reply');expect(container.textContent).not.toContain('Old reply');
});
