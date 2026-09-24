// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import type {Video} from '../core/model';
vi.mock('../state',()=>({useApp:()=>({state:{language:'en',ui:'en',bookmarks:[]},t:(_ko:string,en:string)=>en,update:()=>{}})}));
import {VideoPlayer} from './Media';
const video:Video={id:'sermon',title:'A message',description:'First paragraph.\n\nSecond paragraph.',url:'https://www.youtube.com/watch?v=4YFNv1Szab8',language:'en',category:'sermon',createdAt:'2026-09-24'};
let root:Root,container:HTMLElement;
const close=vi.fn();
const button=(label:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent===label||b.getAttribute('aria-label')===label);
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);close.mockReset();document.body.innerHTML='<div id="root"></div>';container=document.getElementById('root')!;root=createRoot(container);Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.open=true;}});});
afterEach(async()=>{await act(async()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();delete (HTMLDialogElement.prototype as any).showModal;delete (HTMLElement.prototype as any).requestFullscreen;delete (HTMLVideoElement.prototype as any).webkitEnterFullscreen;delete (document as any).exitFullscreen;delete (document as any).fullscreenElement;});
it('loads YouTube only on playback and exposes its controls and fullscreen permission',async()=>{
 await act(async()=>root.render(<VideoPlayer video={video} onClose={close}/>));expect(container.querySelector('iframe')).toBeNull();
 expect(button('Fullscreen')).toBeDefined();await act(async()=>button('Fullscreen')!.click());
 const frame=container.querySelector('iframe')!;expect(frame.allowFullscreen).toBe(true);expect(frame.getAttribute('allow')!.split(';').map(s=>s.trim())).toContain('fullscreen');
 expect(new URL(frame.src).searchParams.get('fs')).toBe('1');expect(new URL(frame.src).searchParams.get('controls')).toBe('1');
 expect(container.querySelector('a[href="https://www.youtube.com/watch?v=4YFNv1Szab8"]')?.textContent).toContain('Open in YouTube');
});
it('falls back to expanded viewing and preserves the playing iframe when returning',async()=>{
 await act(async()=>root.render(<VideoPlayer video={video} onClose={close}/>));expect(button('Fullscreen')).toBeDefined();await act(async()=>button('Fullscreen')!.click());
 const frame=container.querySelector('iframe');expect(container.querySelector('dialog')?.classList.contains('video-expanded')).toBe(true);
 expect(container.textContent).toContain('Using expanded view in this browser.');
 await act(async()=>container.querySelector('dialog')!.dispatchEvent(new Event('cancel',{cancelable:true})));
 expect(close).not.toHaveBeenCalled();expect(container.querySelector('dialog')?.classList.contains('video-expanded')).toBe(false);expect(container.querySelector('iframe')).toBe(frame);
 await act(async()=>container.querySelector('dialog')!.dispatchEvent(new Event('cancel',{cancelable:true})));expect(close).toHaveBeenCalledOnce();
});
it('requests native fullscreen on the video stage and restores inline viewing on exit',async()=>{
 let active:Element|null=null;
 Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>active});
 HTMLElement.prototype.requestFullscreen=async function(){expect(this.tagName).not.toBe('DIALOG');active=this;document.dispatchEvent(new Event('fullscreenchange'));};
 document.exitFullscreen=async()=>{active=null;document.dispatchEvent(new Event('fullscreenchange'));};
 await act(async()=>root.render(<VideoPlayer video={video} onClose={close}/>));expect(button('Fullscreen')).toBeDefined();await act(async()=>button('Fullscreen')!.click());
 expect(active).toBe(container.querySelector('.video-stage'));expect(button('Exit fullscreen')).toBeDefined();
 const frame=container.querySelector('iframe');await act(async()=>button('Exit fullscreen')!.click());
 expect(active).toBeNull();expect(container.querySelector('dialog')?.classList.contains('video-expanded')).toBe(false);expect(container.querySelector('iframe')).toBe(frame);
});
it('keeps a usable expanded player when a browser rejects the fullscreen request',async()=>{
 HTMLElement.prototype.requestFullscreen=async()=>{throw new Error('Fullscreen blocked by browser');};
 await act(async()=>root.render(<VideoPlayer video={video} onClose={close}/>));expect(button('Fullscreen')).toBeDefined();await act(async()=>button('Fullscreen')!.click());
 expect(container.querySelector('iframe')).not.toBeNull();expect(button('Exit expanded view')).toBeDefined();expect(container.textContent).toContain('Using expanded view in this browser.');
});
it('uses the native iPhone video fullscreen API for a directly hosted file',async()=>{
 let entered:HTMLVideoElement|undefined;(HTMLVideoElement.prototype as HTMLVideoElement&{webkitEnterFullscreen?:()=>void}).webkitEnterFullscreen=function(){entered=this;};
 await act(async()=>root.render(<VideoPlayer video={{...video,url:'https://cdn.example.com/message.mp4'}} onClose={close}/>));
 await act(async()=>button('Play video')?.click());expect(button('Fullscreen')).toBeDefined();await act(async()=>button('Fullscreen')!.click());
 expect(entered).toBe(container.querySelector('video'));expect(button('Exit fullscreen')).toBeDefined();
 await act(async()=>entered!.dispatchEvent(new Event('webkitendfullscreen')));expect(button('Fullscreen')).toBeDefined();
});
