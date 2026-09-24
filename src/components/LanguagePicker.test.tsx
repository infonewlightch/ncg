// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({update:vi.fn(),prepare:vi.fn()}));
vi.mock('../state',()=>({useApp:()=>({state:{language:'en',ui:'en'},t:(_ko:string,en:string)=>en,update:mocks.update})}));
vi.mock('../data/languages-index.json',()=>({default:[['jpn','Japanese','ja'],['zho','Chinese','zh'],['fil','Filipino'],['khm','Khmer','km']]}));
vi.mock('../core/interface-seeds',()=>({interfaceSeed:()=>true,interfaceSeedLanguages:['ja','zh','zh-Hant','fil','km']}));
vi.mock('../core/interface-runtime',()=>({prepareInterface:mocks.prepare}));
import LanguagePicker from './LanguagePicker';
let root:Root,container:HTMLElement,finish:()=>void;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);document.body.innerHTML='<div id="root"></div>';container=document.getElementById('root')!;root=createRoot(container);mocks.update.mockClear();mocks.prepare.mockReset();mocks.prepare.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.setAttribute('open','');}});});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();delete (HTMLDialogElement.prototype as any).showModal;});
it('loads the selected static pack before changing the screen language',async()=>{
 const close=vi.fn();await act(async()=>root.render(<LanguagePicker onClose={close}/>));await act(async()=>{await import('../data/languages-index.json');});
 const button=[...container.querySelectorAll<HTMLButtonElement>('.language-grid button')].find(button=>button.textContent?.includes('jpn'))!;expect(button).toBeDefined();
 await act(async()=>button.click());expect(mocks.prepare).toHaveBeenCalledWith('ja');expect(mocks.update).not.toHaveBeenCalled();expect(button.getAttribute('aria-busy')).toBe('true');
 await act(async()=>finish());expect(mocks.update.mock.calls[0][0]({language:'en'}).language).toBe('ja');expect(close).toHaveBeenCalledOnce();
});
it('lists every prepared language and script variant before searching',async()=>{
 await act(async()=>root.render(<LanguagePicker onClose={vi.fn()}/>));await act(async()=>{await import('../data/languages-index.json');});
 const buttons=[...container.querySelectorAll<HTMLButtonElement>('.language-grid button')];
 expect(buttons).toHaveLength(5);
 for(const iso of ['jpn','fil','khm'])expect(buttons.some(button=>button.textContent?.includes(iso))).toBe(true);
 const traditional=buttons.find(button=>button.textContent?.includes('Traditional Chinese'))!;
 expect(traditional).toBeDefined();await act(async()=>traditional.click());expect(mocks.prepare).toHaveBeenCalledWith('zh-Hant');
 await act(async()=>finish());expect(mocks.update.mock.calls[0][0]({language:'en'}).language).toBe('zh-Hant');
});
it('finds prepared languages by their native names and Chinese script variants',async()=>{
 await act(async()=>root.render(<LanguagePicker onClose={vi.fn()}/>));await act(async()=>{await import('../data/languages-index.json');});
 for(const [query,code] of [['ខ្មែរ','khm'],['繁體','zho']]){
  await act(async()=>{const input=container.querySelector('input')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,query);input.dispatchEvent(new Event('input',{bubbles:true}));});
  const buttons=container.querySelectorAll('.language-grid button');expect(buttons).toHaveLength(1);expect(buttons[0].textContent).toContain(code);
 }
});
it('does not change language after the picker is dismissed during a download',async()=>{
 const close=vi.fn();await act(async()=>root.render(<LanguagePicker onClose={close}/>));await act(async()=>{await import('../data/languages-index.json');});
 await act(async()=>{(container.querySelector('.language-grid button') as HTMLButtonElement).click();});
 await act(async()=>root.render(null));await act(async()=>finish());expect(mocks.update).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();
});
