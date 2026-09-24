// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';import {createRoot,type Root} from 'react-dom/client';
import type {BibleIndex} from '../core/bible';
vi.mock('../state',()=>({useApp:()=>({state:{ui:'en'},t:(_ko:string,en:string)=>en})}));
import {BibleNavigator} from './BibleNavigator';
const index:BibleIndex={text_direction:'ltr',books:['GEN','MAT'].map((id,i)=>({id,title:i?'Matthew':'Genesis',full_title:id,abbreviation:id,canon:i?'new_testament':'old_testament',chapters:[1,2].map(n=>({id:n,title:n,passage_id:`${id}.${n}`,verses:[1,2].map(v=>({id:v,title:v,passage_id:`${id}.${n}.${v}`}))}))}))};
let root:Root,container:HTMLElement;const select=vi.fn();
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});document.body.innerHTML='<div id="root"></div>';container=document.getElementById('root')!;root=createRoot(container);select.mockClear();});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();});
it('shows verse one selected without an All option, and starts book/chapter changes at verse one',async()=>{
 await act(async()=>root.render(<BibleNavigator index={index} passage="GEN.1" onSelect={select}/>));const verses=container.querySelector('[aria-label="Verses"]')!;expect([...verses.querySelectorAll('button')].map(b=>b.textContent)).toEqual(['1','2']);expect(verses.querySelector('[aria-current=true]')?.textContent).toBe('1');
 await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="Genesis 2"]')!.click());expect(select).toHaveBeenLastCalledWith('GEN.2.1');
 await act(async()=>[...container.querySelectorAll<HTMLButtonElement>('[aria-label="Bible books"] button')].find(b=>b.textContent==='Matthew')!.click());expect(select).toHaveBeenLastCalledWith('MAT.1.1');
});
