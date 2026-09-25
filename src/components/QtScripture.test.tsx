// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({request:vi.fn(),language:'ko'}));
vi.mock('../state',()=>({useApp:()=>({state:{language:mocks.language,ui:'en'},t:(_ko:string,en:string)=>en})}));
vi.mock('../core/bible',async()=>({...await vi.importActual('../core/bible'),bibleRequest:mocks.request}));
import {QtScripture} from './QtScripture';
let root:Root,container:HTMLElement;
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();mocks.language='ko';
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

it('loads every chapter of a shared range and preserves their separate verse numbers',async()=>{
 mocks.request.mockImplementation(async(resource:string,params:{passage:string})=>resource==='versions'?{data:[{id:'webp',title:'WEB',language_tag:'en',access:'public'}]}:{reference:params.passage,verses:[{id:params.passage,number:params.passage.includes('.22.')?'1':'18',text:`Text ${params.passage}`}]});
 await act(async()=>root.render(<QtScripture passage="1CH.21.18-30" passages={['1CH.21.18-30','1CH.22.1-1']} onLanguage={()=>{}}/>));
 expect(container.querySelectorAll('.qt-chapter')).toHaveLength(2);
 expect(container.textContent).toContain('Text 1CH.22.1-1');
 expect([...container.querySelectorAll('sup')].map(n=>n.textContent)).toEqual(['18','1']);
});
it('does not silently show an incomplete reading when a later chapter fails',async()=>{
 mocks.request.mockImplementation(async(resource:string,params:{passage:string})=>{if(resource==='versions')return {data:[{id:'webp',title:'WEB',language_tag:'en',access:'public'}]};if(params.passage.includes('.22.'))throw Error('provider_failed');return {reference:params.passage,verses:[{id:params.passage,number:'18',text:'Partial reading'}]};});
 await act(async()=>root.render(<QtScripture passage="1CH.21.18-30" passages={['1CH.21.18-30','1CH.22.1-1']} onLanguage={()=>{}}/>));
 expect(container.textContent).toContain('Unable to load the passage');expect(container.textContent).not.toContain('Partial reading');
});
it('offers each chapter at the official Korean Bible reader',async()=>{
 await act(async()=>root.render(<QtScripture passage="1CH.21.18-30" passages={['1CH.21.18-30','1CH.22.1-1']} onLanguage={()=>{}}/>));
 expect(container.querySelector('a[href="https://bible.bskorea.or.kr/bible/NKRV/1CH.22"]')).not.toBeNull();
});
it('opens each Lao QT chapter at the licensed source without attempting an unlicensed text request',async()=>{
 mocks.language='lo';mocks.request.mockResolvedValue({data:[{id:'3755',title:'Lao Contemporary Version',abbreviation:'LCV',language_tag:'lo',access:'external',copyright:'© 2023, 2025 Biblica, Inc.',youversion_deep_link:'https://www.bible.com/bible/3755/GEN.1.LCV'}]});
 await act(async()=>root.render(<QtScripture passage="1CH.21.18-30" passages={['1CH.21.18-30','1CH.22.1-1']} onLanguage={()=>{}}/>));
 expect(container.querySelector('a[href="https://www.bible.com/bible/3755/1CH.21.LCV"]')).not.toBeNull();
 expect(container.querySelector('a[href="https://www.bible.com/bible/3755/1CH.22.LCV"]')).not.toBeNull();
 expect(mocks.request).toHaveBeenCalledTimes(1);expect(container.textContent).toContain('Biblica');
});
