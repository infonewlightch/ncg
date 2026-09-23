// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {act,Suspense,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {PageBoundary,lazyPage} from './PageBoundary';
vi.mock('../state',()=>({useApp:()=>({t:(_ko:string,en:string)=>en})}));
const t=(_ko:string,en:string)=>en;
const reload=vi.fn<()=>void>();
let root:Root,container:HTMLElement,online=true;
function Broken(){throw Error('private render error details');return null;}
function unavailable(){return lazyPage(async()=>{throw new TypeError('Failed to fetch dynamically imported module: /old-hash.js?private=value');});}
const button=(name:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent===name||b.getAttribute('aria-label')===name)!;
beforeEach(()=>{document.body.innerHTML='<div id="root"></div>';vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.getElementById('root')!;root=createRoot(container,{onCaughtError:()=>{}});reload.mockReset();online=true;vi.spyOn(navigator,'onLine','get').mockImplementation(()=>online);Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.setAttribute('open','');}});});
afterEach(async()=>{await act(async()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();delete (HTMLDialogElement.prototype as any).showModal;});
it('distinguishes missing page files from render errors without showing technical details',async()=>{
 const Missing=unavailable();await act(async()=>root.render(<PageBoundary t={t} onReload={reload}><Suspense><Missing/></Suspense></PageBoundary>));
 expect(container.textContent).toContain('This screen needs to be reloaded.');expect(container.textContent).not.toContain('private');expect(container.textContent).not.toContain('old-hash');expect(reload).not.toHaveBeenCalled();
});
it('keeps a generic fallback for errors thrown while rendering a loaded page',async()=>{
 await act(async()=>root.render(<PageBoundary t={t} onReload={reload}><Broken/></PageBoundary>));expect(container.textContent).toContain('Unable to load this page.');expect(container.textContent).not.toContain('private');expect(container.textContent).not.toContain('app may have been updated');
});
it('waits for the reader to reload and handles repeated clicks only once',async()=>{
 const Missing=unavailable();await act(async()=>root.render(<PageBoundary t={t} onReload={reload}><Suspense><Missing/></Suspense></PageBoundary>));
 expect(reload).not.toHaveBeenCalled();await act(async()=>{button('Reload').click();button('Reload').click();});expect(reload).toHaveBeenCalledTimes(1);
});
it('responds to offline and online changes without automatically reloading',async()=>{
 const Missing=unavailable();online=false;await act(async()=>root.render(<PageBoundary t={t} onReload={reload}><Suspense><Missing/></Suspense></PageBoundary>));
 expect(container.textContent).toContain('You are offline.');expect(button('Reload').disabled).toBe(true);
 online=true;await act(async()=>window.dispatchEvent(new Event('online')));expect(button('Reload').disabled).toBe(false);expect(container.textContent).not.toContain('You are offline.');expect(reload).not.toHaveBeenCalled();
 online=false;await act(async()=>window.dispatchEvent(new Event('offline')));expect(button('Reload').disabled).toBe(true);
});
it('keeps the underlying draft mounted when a language dialog fails and closes',async()=>{
 const Missing=unavailable();function Editor(){const[open,setOpen]=useState(false);return <><textarea aria-label="Draft" defaultValue="Unsaved reflection"/><button onClick={()=>setOpen(true)}>Languages</button>{open&&<PageBoundary t={t} onReload={reload} onDismiss={()=>setOpen(false)}><Suspense><Missing/></Suspense></PageBoundary>}</>;}
 await act(async()=>root.render(<Editor/>));const input=container.querySelector('textarea');await act(async()=>button('Languages').click());expect(container.querySelector('dialog[open]')).not.toBeNull();expect(container.querySelector('textarea')).toBe(input);
 await act(async()=>button('Close').click());expect(container.querySelector('dialog')).toBeNull();expect(container.querySelector('textarea')).toBe(input);expect(input?.value).toBe('Unsaved reflection');expect(reload).not.toHaveBeenCalled();
});
it('offers a home link after a page failure and clears the error when navigating',async()=>{
 await act(async()=>root.render(<PageBoundary key="failed" t={t}><Broken/></PageBoundary>));expect(container.querySelector('a')?.getAttribute('href')).toBe('#/');
 await act(async()=>root.render(<PageBoundary key="home" t={t}><p>Home page content</p></PageBoundary>));expect(container.textContent).toBe('Home page content');
});
