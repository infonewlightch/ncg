// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({find:vi.fn(),profiles:vi.fn()}));
vi.mock('../auth',()=>({useAuth:()=>({session:{user:{id:'self'},access_token:'test-only'},loading:false}),supabase:{
 from:(table:string)=>{const query:any={select:()=>query,abortSignal:()=>query,then:(done:any,fail:any)=>(table==='ncg_profiles'?mocks.profiles():Promise.resolve({data:table==='ncg_friends'?[{id:'link',sender:'self',recipient:'friend',status:'accepted'}]:[],error:null})).then(done,fail)};return query;},
 rpc:(_name:string,args:unknown)=>{const query:any={abortSignal:()=>query,then:(done:any,fail:any)=>mocks.find(args).then(done,fail)};return query;}
}}));
vi.mock('../state',()=>({useApp:()=>({state:{ui:'en',language:'en'},t:(_ko:string,en:string)=>en,notify:()=>{}})}));
import Friends from './Friends';
let root:Root,container:HTMLElement;
const member=(name:string)=>({id:'friend',display_name:name,nationality:'Canada',language:'en',friend_code:'222222222222'});
const result=(name:string)=>({data:[member(name)],error:null});
const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const button=(name:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent===name||b.getAttribute('aria-label')===name)!;
const type=async(text:string)=>act(async()=>{const input=container.querySelector('input[aria-label="Friend code"]')!;Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')!.set!.call(input,text);input.dispatchEvent(new Event('input',{bubbles:true}));});
const submit=()=>container.querySelector('form.friend-search')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
const render=()=>act(async()=>root.render(<Friends/>));
beforeEach(()=>{vi.resetAllMocks();document.body.innerHTML='<div id="root"></div>';vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.getElementById('root')!;root=createRoot(container);mocks.profiles.mockResolvedValue(result('Existing friend'));mocks.find.mockResolvedValue(result('Search result'));});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();});
it('removes the previous request target as soon as the friend code changes',async()=>{
 await render();await type('111111111111');await act(async()=>submit());expect(container.querySelector('.friend-result')?.textContent).toContain('Search result');
 await type('222222222222');expect(container.querySelector('.friend-result')).toBeNull();expect(button('Send request')).toBeUndefined();
});
it('ignores a pending result when the user has already edited the code',async()=>{
 const old=deferred();mocks.find.mockReturnValueOnce(old.promise);await render();await type('111111111111');await act(async()=>submit());await type('222222222222');
 await act(async()=>old.resolve(result('Wrong code result')));expect(container.querySelector('.friend-result')).toBeNull();expect(button('Find').disabled).toBe(false);
});
it('does not keep an old target or claim no matches when the new search fails',async()=>{
 mocks.find.mockResolvedValueOnce(result('Old target')).mockResolvedValueOnce({data:null,error:{message:'offline'}});
 await render();await type('111111111111');await act(async()=>submit());await type('222222222222');await act(async()=>submit());
 expect(container.querySelector('.friend-result')).toBeNull();expect(container.textContent).toContain('Search failed.');expect(container.textContent).not.toContain('No available member found.');
});
it('starts one lookup for repeated submit events before a rerender',async()=>{
 const pending=deferred();mocks.find.mockReturnValue(pending.promise);await render();await type('111111111111');await act(async()=>{submit();submit();});
 expect(mocks.find).toHaveBeenCalledTimes(1);await act(async()=>pending.resolve(result('One result')));expect(container.querySelector('.friend-result')?.textContent).toContain('One result');
});
it('ignores an old friend-list response after a newer refresh',async()=>{
 const old=deferred();mocks.profiles.mockReturnValueOnce(old.promise).mockResolvedValueOnce(result('Current friend'));
 await render();await act(async()=>button('Refresh list').click());expect(container.querySelector('.friend-list')?.textContent).toContain('Current friend');
 await act(async()=>old.resolve(result('Stale friend')));expect(container.querySelector('.friend-list')?.textContent).toContain('Current friend');expect(container.textContent).not.toContain('Stale friend');
});
it('distinguishes a failed friend-list lookup from an empty list and recovers on refresh',async()=>{
 mocks.profiles.mockResolvedValueOnce({data:null,error:{message:'offline'}}).mockResolvedValueOnce(result('Recovered friend'));
 await render();expect(container.textContent).toContain('Could not load friends.');expect(container.textContent).not.toContain('Find a friend to share the journey.');
 await act(async()=>button('Refresh list').click());expect(container.querySelector('.friend-list')?.textContent).toContain('Recovered friend');expect(container.textContent).not.toContain('Could not load friends.');
});
