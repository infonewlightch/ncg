// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
vi.mock('../auth',()=>({supabase:null,useAuth:()=>({session:null})}));
vi.mock('../state',()=>({useApp:()=>({state:{language:'en',ui:'en',completed:[]},t:(_ko:string,en:string)=>en,update:()=>{}})}));
// No live Bible or authentication calls are needed to exercise date navigation.
vi.mock('../core/bible',async()=>({...await vi.importActual('../core/bible'),bibleRequest:async()=>({data:[]})}));
import QuietTime from './QuietTime';
let root:Root,container:HTMLElement;
const render=()=>act(async()=>root.render(<QuietTime onLanguage={()=>{}}/>));
const click=async(button:HTMLButtonElement)=>act(async()=>{button.click();await new Promise(resolve=>setTimeout(resolve,0));});
beforeEach(async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-09-24T07:00:00Z'));
 history.replaceState(null,'','#/qt?date=2026-10-07');document.body.innerHTML='<div id="root"></div>';container=document.getElementById('root')!;root=createRoot(container);await render();
});
afterEach(async()=>{await act(async()=>root.unmount());vi.useRealTimers();vi.unstubAllGlobals();});
it('keeps the chosen day in the shareable URL and restores that passage after remounting',async()=>{
 const day=[...container.querySelectorAll<HTMLButtonElement>('.qt-week-grid button')].find(b=>b.querySelector('b')?.textContent==='8')!;
 await click(day);expect(location.hash).toBe('#/qt?date=2026-10-08');
 await act(async()=>root.unmount());root=createRoot(container);await render();
 expect(container.querySelector('.qt-reading h2')?.textContent).toContain('21:1-8');
 expect(container.querySelector('.qt-week-grid [aria-pressed="true"] b')?.textContent).toBe('8');
});
it.each([
 ['Today','2026-09-24','14:1-17'],
 ['Previous week','2026-09-28','16:7-22'],
 ['Next week','2026-10-12','23:1-32'],
])('updates the URL and reading together when choosing %s',async(label,date,range)=>{
 const button=[...container.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label||b.textContent===label)!;
 await click(button);expect(location.hash).toBe(`#/qt?date=${date}`);
 expect(container.querySelector('.qt-reading h2')?.textContent).toContain(range);
});
