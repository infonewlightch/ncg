// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
vi.mock('../state',()=>({useApp:()=>({state:{language:'en',ui:'en',videos:[]},t:(_ko:string,en:string)=>en,update:()=>{},notify:()=>{}})}));
vi.mock('./LanguagePicker',async()=>{throw new TypeError('Module fetch failed');});
import {AddVideo} from './Media';
let root:Root,container:HTMLElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);document.body.innerHTML='<div id="root"></div>';container=document.getElementById('root')!;root=createRoot(container,{onCaughtError:()=>{}});Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.setAttribute('open','');}});});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();delete (HTMLDialogElement.prototype as any).showModal;});
it('preserves the video-link draft when its language module cannot load',async()=>{
 await act(async()=>root.render(<AddVideo onClose={()=>{}}/>));const title=container.querySelector('input[maxlength="160"]') as HTMLInputElement;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(title,'Keep my video draft');title.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>{(container.querySelector('.select-button') as HTMLButtonElement).click();});
 const dialogs=container.querySelectorAll('dialog');expect(dialogs.length).toBe(2);expect(dialogs[1].textContent).toContain('This screen needs to be reloaded.');expect(title.value).toBe('Keep my video draft');
 await act(async()=>{(dialogs[1].querySelector('[aria-label="Close"]') as HTMLButtonElement).click();});expect(container.querySelectorAll('dialog').length).toBe(1);expect(container.querySelector('input[maxlength="160"]')).toBe(title);expect(title.value).toBe('Keep my video draft');
});
