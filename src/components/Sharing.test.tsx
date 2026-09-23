// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import type {ServerPost} from './SharedFeed';
const mocks=vi.hoisted(()=>({language:'es',user:'viewer',fetch:vi.fn()}));
vi.mock('../auth',()=>({useAuth:()=>({session:{user:{id:mocks.user},access_token:mocks.user}}),supabase:null}));
vi.mock('../state',()=>({useApp:()=>({state:{ui:'en',language:mocks.language,prayed:[]},t:(_ko:string,en:string)=>en,notify:()=>{},update:()=>{}})}));
import {SharedPost} from './Sharing';
let root:Root,container:HTMLElement,post:ServerPost;
const deferred=()=>{let resolve!:(value:any)=>void,reject!:(value:any)=>void;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};
const translated=(text:string)=>({ok:true,json:async()=>({text})});
const render=()=>act(async()=>root.render(<SharedPost post={post} remote={post}/>));
const body=()=>container.querySelector('.post-body')?.textContent;
beforeEach(()=>{vi.resetAllMocks();mocks.language='es';mocks.user='viewer';vi.stubGlobal('fetch',mocks.fetch);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);document.body.innerHTML='<div id="root"></div>';container=document.getElementById('root')!;root=createRoot(container);post={id:crypto.randomUUID(),body:'Original reflection',author:'Author',authorId:'writer',nationality:'Korea',language:'en',category:'story',createdAt:'2026-09-23T12:00:00Z',status:'published',prayerCount:0,hasPrayed:false};});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();});
it('keeps the current language when earlier JSON completes late',async()=>{
 const old=deferred();mocks.fetch.mockResolvedValueOnce({ok:true,json:()=>old.promise}).mockResolvedValueOnce(translated('Current French'));
 await render();mocks.language='fr';await render();expect(body()).toBe('Current French');
 await act(async()=>old.resolve({text:'Old Spanish'}));expect(body()).toBe('Current French');
});
it.each(['http','network'])('ignores an older %s failure after the current translation succeeds',async(kind)=>{
 const old=deferred();mocks.fetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce(translated('Current French'));
 await render();mocks.language='fr';await render();await act(async()=>kind==='http'?old.resolve({ok:false,status:503}):old.reject(new TypeError('offline')));
 expect(body()).toBe('Current French');expect(container.textContent).toContain('Automatic translation');expect(container.textContent).not.toContain('showing original');
});
it('stops translation display when a reflection moves back under review',async()=>{
 mocks.fetch.mockResolvedValue(translated('Translated reflection'));await render();post={...post,status:'pending'};await render();
 expect(body()).toBe('Original reflection');expect(container.textContent).not.toContain('Automatic translation');expect(container.textContent).toContain('Under review');expect(mocks.fetch).toHaveBeenCalledTimes(1);
});
it('does not reuse cached translations after the source language is corrected',async()=>{
 mocks.fetch.mockResolvedValueOnce(translated('From English')).mockResolvedValueOnce(translated('From Korean'));
 await render();post={...post,language:'ko'};await render();expect(mocks.fetch).toHaveBeenCalledTimes(2);expect(body()).toBe('From Korean');
});
it('does not reuse another account’s cached translation without a new request',async()=>{
 mocks.fetch.mockResolvedValueOnce(translated('For first account')).mockResolvedValueOnce({ok:false,status:403});
 await render();mocks.user='another-viewer';await render();expect(mocks.fetch).toHaveBeenCalledTimes(2);expect(body()).toBe('Original reflection');
});
