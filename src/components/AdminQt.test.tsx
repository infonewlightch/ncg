// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),read:vi.fn(),index:vi.fn()}));
vi.mock('../auth',()=>({supabase:{rpc:mocks.rpc,from:()=>{const query={select:()=>query,order:()=>query,limit:mocks.read};return query;}}}));
vi.mock('../core/bible',async importOriginal=>({...await importOriginal<typeof import('../core/bible')>(),bibleRequest:mocks.index}));
import {AdminQt} from './AdminQt';
let root:Root,container:HTMLElement;
beforeEach(()=>{
 vi.resetAllMocks();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 mocks.read.mockResolvedValue({data:[],error:null});mocks.rpc.mockResolvedValue({error:null});
 mocks.index.mockResolvedValue({books:[{id:'NAH',chapters:[{id:'1',verses:Array.from({length:15},(_,i)=>({id:String(i+1)}))}]}]});
 document.body.innerHTML='<div id="root"></div>';container=document.getElementById('root')!;root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();});
async function saveRange(value:string){
 await act(async()=>root.render(<AdminQt/>));
 await act(async()=>{const field=container.querySelector('textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>{[...container.querySelectorAll('button')].find(button=>button.textContent==='초안 저장')!.click();});
}
it.each(['NAH.1.1-7','NAM.1.1-7'])('saves %s with the existing database book code after canonical validation',async reference=>{
 await saveRange(reference);
 expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('ncg_save_qt_reading',{document:{date:expect.any(String),passage:'NAM.1.1-7',passages:['NAM.1.1-7'],status:'draft'}});
 expect(container.textContent).toContain('초안을 저장했습니다.');
});
it('rejects a nonexistent Nahum verse before submitting to the database',async()=>{
 await saveRange('NAH.1.1-16');expect(mocks.rpc).not.toHaveBeenCalled();expect(container.querySelector('[role=alert]')?.textContent).toContain('실제 성경에 있는 장절 범위');
});
