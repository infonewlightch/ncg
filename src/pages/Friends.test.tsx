// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({read:vi.fn(),send:vi.fn(),block:vi.fn(),language:'en'}));
const me='11111111-1111-4111-8111-111111111111',peer='22222222-2222-4222-8222-222222222222';
vi.mock('../auth',()=>({useAuth:()=>({session:{user:{id:'11111111-1111-4111-8111-111111111111'},access_token:'test-only'},loading:false}),supabase:{
 from:(table:string)=>{const query:any={select:()=>query,or:()=>query,order:()=>query,limit:()=>query,abortSignal:()=>query,then:(resolve:any,reject:any)=>{
  const result=table==='ncg_messages'?mocks.read():Promise.resolve({error:null,data:table==='ncg_profiles'?[{id:'11111111-1111-4111-8111-111111111111',display_name:'Me',nationality:'Korea',language:'en',friend_code:'111111111111'},{id:'22222222-2222-4222-8222-222222222222',display_name:'Friend',nationality:'Canada',language:'en',friend_code:'222222222222'}]:table==='ncg_friends'?[{id:'friendship',sender:'11111111-1111-4111-8111-111111111111',recipient:'22222222-2222-4222-8222-222222222222',status:'accepted'}]:[]});return result.then(resolve,reject);
 }};return query;},rpc:(name:string,args:unknown)=>name==='ncg_send_message'?mocks.send(args):mocks.block(args)
}}));
vi.mock('../state',()=>({useApp:()=>({state:{ui:'en',language:mocks.language},t:(_ko:string,en:string)=>en,notify:()=>{}})}));
import Friends from './Friends';
let root:Root,container:HTMLElement;
const message=(body:string,id=body)=>({id,sender:peer,recipient:me,body,language:'en',status:'published',created_at:'2026-09-23T12:00:00Z'});
const response=(body:string)=>({data:[message(body)],error:null});
const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const button=(label:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent===label||b.getAttribute('aria-label')===label)!;
const click=async(label:string)=>act(async()=>button(label).click());
const type=async(text:string)=>act(async()=>{const field=container.querySelector('textarea')!;Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')!.set!.call(field,text);field.dispatchEvent(new Event('input',{bubbles:true}));});
const submit=()=>container.querySelector('form.chat-input')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
async function openChat(){await act(async()=>root.render(<Friends/>));await click('Chat');}
beforeEach(()=>{vi.resetAllMocks();mocks.language='en';vi.useFakeTimers();document.body.innerHTML='<div id="root"></div>';vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.getElementById('root')!;root=createRoot(container);mocks.read.mockResolvedValue({data:[],error:null});mocks.send.mockResolvedValue({data:'message-id',error:null});mocks.block.mockResolvedValue({data:null,error:null});});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();vi.useRealTimers();});
it('keeps a new draft typed while the previous message is being sent',async()=>{
 const sent=deferred();mocks.send.mockReturnValueOnce(sent.promise);await openChat();await type('First message');await act(async()=>submit());await type('Next message');
 await act(async()=>sent.resolve({data:'message-id',error:null}));expect(container.querySelector('textarea')!.value).toBe('Next message');
 expect(mocks.send).toHaveBeenCalledWith({target:peer,content:'First message',source_language:'en'});
});
it('sends only once when two submit events arrive before the UI is rerendered',async()=>{
 const sent=deferred();mocks.send.mockReturnValue(sent.promise);await openChat();await type('A kind hello');await act(async()=>{submit();submit();});
 expect(mocks.send).toHaveBeenCalledTimes(1);await act(async()=>sent.resolve({data:'message-id',error:null}));expect(container.querySelector('textarea')!.value).toBe('');
});
it('ignores an older conversation response after a newer refresh has completed',async()=>{
 const old=deferred();mocks.read.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response('Latest conversation'));
 await openChat();await click('Refresh messages');expect(container.textContent).toContain('Latest conversation');
 await act(async()=>old.resolve(response('Old conversation')));expect(container.textContent).toContain('Latest conversation');expect(container.textContent).not.toContain('Old conversation');
});
it('distinguishes failed loading from an empty conversation and clears the load error after retry',async()=>{
 mocks.read.mockResolvedValueOnce({data:null,error:{message:'offline'}}).mockResolvedValueOnce(response('Recovered conversation'));
 await openChat();expect(container.textContent).toContain('Could not load the conversation.');expect(container.textContent).not.toContain('Begin with a kind hello.');
 await click('Refresh messages');expect(container.textContent).toContain('Recovered conversation');expect(container.textContent).not.toContain('Could not load the conversation.');
});
it('keeps the draft and explains a failed send without automatically retrying it',async()=>{
 mocks.send.mockResolvedValueOnce({data:null,error:{message:'content_rejected'}});await openChat();await type('Draft to revise');await act(async()=>submit());
 expect(container.querySelector('textarea')!.value).toBe('Draft to revise');expect(container.textContent).toContain('Please revise inappropriate language');
 await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(mocks.send).toHaveBeenCalledTimes(1);
});
it('shows a failed block action inside the open conversation',async()=>{
 mocks.block.mockResolvedValueOnce({data:null,error:{message:'offline'}});await openChat();await click('Block');
 expect(container.textContent).toContain('Unable to complete the request.');expect(container.querySelector('textarea')).not.toBeNull();
});

it('does not replace the selected chat language with a late previous translation',async()=>{
 const old=deferred();const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:()=>old.promise}).mockResolvedValueOnce({ok:true,json:async()=>({text:'French message'})});vi.stubGlobal('fetch',fetcher);
 mocks.language='es';mocks.read.mockResolvedValue(response('Original message'));await openChat();mocks.language='fr';await act(async()=>root.render(<Friends/>));
 expect(container.querySelector('.chat-bubble p')?.textContent).toBe('French message');await act(async()=>old.resolve({text:'Spanish message'}));expect(container.querySelector('.chat-bubble p')?.textContent).toBe('French message');
});
it('removes chat translation controls when a message is no longer published',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({text:'Translated message'})});vi.stubGlobal('fetch',fetcher);mocks.language='es';mocks.read.mockResolvedValueOnce(response('Original message')).mockResolvedValueOnce({data:[{...message('Original message'),status:'pending'}],error:null});
 await openChat();await click('Refresh messages');expect(container.querySelector('.chat-bubble p')?.textContent).toBe('Original message');expect(container.textContent).not.toContain('Translated · Show original');expect(container.textContent).not.toContain('translation unavailable');expect(fetcher).toHaveBeenCalledTimes(1);
});
it('shows only the original after switching back to a message’s source language',async()=>{
 const old=deferred();vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:()=>old.promise}));mocks.language='es';mocks.read.mockResolvedValue(response('Original message'));await openChat();mocks.language='en';await act(async()=>root.render(<Friends/>));
 await act(async()=>old.resolve({text:'Spanish message'}));expect(container.querySelector('.chat-bubble p')?.textContent).toBe('Original message');
});
