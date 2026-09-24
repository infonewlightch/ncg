// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
vi.mock('../state',()=>({useApp:()=>({state:{language:'en',ui:'en',videos:[]},t:(_ko:string,en:string)=>en,update:()=>{},notify:()=>{}})}));
vi.mock('./LanguagePicker',async()=>{throw new TypeError('Module fetch failed');});
import {LanguageDialog} from './LanguageDialog';
let root:Root,container:HTMLElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);document.body.innerHTML='<div id="root"></div>';container=document.getElementById('root')!;root=createRoot(container,{onCaughtError:()=>{}});Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.setAttribute('open','');}});});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();delete (HTMLDialogElement.prototype as any).showModal;});
it('shows a dismissible fallback when the language module cannot load',async()=>{
 const close=vi.fn();await act(async()=>root.render(<LanguageDialog onClose={close}/>));
 expect(container.textContent).toContain('This screen needs to be reloaded.');
 await act(async()=>{(container.querySelector('[aria-label="Close"]') as HTMLButtonElement).click();});expect(close).toHaveBeenCalledOnce();
});
