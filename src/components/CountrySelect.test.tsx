// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
vi.mock('../state',()=>({useApp:()=>({state:{ui:'en',language:'en'},t:(_ko:string,en:string)=>en})}));
import {CountrySelect} from './CountrySelect';
let root:Root,container:HTMLElement;const change=vi.fn(),submit=vi.fn();
async function query(value:string){await act(async()=>{const input=container.querySelector('input')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
beforeEach(async()=>{
 vi.clearAllMocks();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);HTMLDialogElement.prototype.showModal=function(){this.open=true;};Element.prototype.scrollIntoView=vi.fn();
 document.body.innerHTML='<div id="root"></div>';container=document.getElementById('root')!;root=createRoot(container);
 await act(async()=>root.render(<form onSubmit={e=>{e.preventDefault();submit();}}><CountrySelect value="" onChange={change}/></form>));
 await act(async()=>container.querySelector('button')!.click());
});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();});
it('only selects a catalogue code, with a flag, from search results',async()=>{
 await query('대한민국');const option=container.querySelector('[role=option]')!;
 expect(option.textContent).toContain('South Korea');expect(option.querySelector('img')?.getAttribute('src')).toContain('kr.svg');
 await act(async()=>(option as HTMLButtonElement).click());expect(change).toHaveBeenCalledWith('KR');expect(submit).not.toHaveBeenCalled();expect(container.querySelector('dialog')).toBeNull();
});
it('never saves a free-text search and does not submit its parent form',async()=>{
 await query('My invented nation');await act(async()=>container.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
 expect(change).not.toHaveBeenCalled();expect(container.textContent).toContain('No countries found.');
 await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label=Close]')!.click());expect(submit).not.toHaveBeenCalled();
});
it('supports keyboard selection of a filtered country',async()=>{
 await query('Canada');await act(async()=>container.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
 expect(change).toHaveBeenCalledWith('CA');expect(submit).not.toHaveBeenCalled();
});
