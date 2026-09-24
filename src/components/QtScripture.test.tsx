// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('../state',()=>({useApp:()=>({state:{language:'ko',ui:'en'},t:(_ko:string,en:string)=>en})}));
vi.mock('../core/bible',async()=>({...await vi.importActual('../core/bible'),bibleRequest:mocks.request}));
import {QtScripture} from './QtScripture';
let root:Root,container:HTMLElement;
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();
 document.body.innerHTML='<div id="root"></div>';container=document.getElementById('root')!;root=createRoot(container);
 mocks.request.mockImplementation(async(resource:string)=>resource==='versions'?{data:[{id:'ext-nkrv',title:'NKRV',language_tag:'ko',access:'external'}]}:{reference:'1 Chronicles 14:1–17',verses:[{id:'1CH.14.1',number:'1',text:'Verified WEB passage.'}]});
});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();});
it('offers an official external NKRV link without treating licensing as a network failure, then reads the chosen WEB range',async()=>{
 await act(async()=>root.render(<QtScripture passage="1CH.14.1-17" onLanguage={()=>{}}/>));
 expect(mocks.request).toHaveBeenCalledTimes(1);
 expect(container.querySelector('a[href="https://bible.bskorea.or.kr/bible/NKRV/1CH.14"]')).not.toBeNull();
 expect(container.textContent).not.toContain('Unable to load the passage');
 const fallback=[...container.querySelectorAll('button')].find(b=>b.textContent==='Read the WEB in English')!;
 await act(async()=>fallback.click());
 expect(mocks.request).toHaveBeenLastCalledWith('passage',{version:'webp',passage:'1CH.14.1-17'},expect.any(AbortSignal));
 expect(container.textContent).toContain('Verified WEB passage.');
});
