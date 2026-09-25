// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {applyEducationMessages,educationMessages} from '../core/education-content';
import englishCourses from '../data/courses/en.json';
const mocks=vi.hoisted(()=>({language:'pt',completed:[] as string[],load:vi.fn(),update:vi.fn()}));
vi.mock('../state',()=>({useApp:()=>({state:{language:mocks.language,ui:'en',completed:mocks.completed},t:(_ko:string,en:string)=>en,update:mocks.update,notify:()=>{}})}));
vi.mock('../core/education',async()=>({...await vi.importActual('../core/education'),loadEducationUnits:mocks.load}));
import School from './School';
import Catechism from './Catechism';
let root:Root,container:HTMLElement;
function translated(language:string,units:{id:string;kind:any;data:any}[]){return new Map(units.map(unit=>[unit.id,applyEducationMessages(unit.kind,unit.data,Object.fromEntries(Object.entries(educationMessages(unit.kind,unit.data)).map(([key,text])=>[key,`${language} — ${text}`])))]));}
async function flush(){await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});}
async function until(check:()=>boolean){for(let i=0;i<25&&!check();i++)await flush();expect(check()).toBe(true);}
async function renderSchool(path='/school'){await act(async()=>root.render(<School path={path}/>));}
async function renderCatechism(){await act(async()=>root.render(<Catechism/>));}
async function click(button:HTMLButtonElement){expect(button).toBeDefined();await act(async()=>button.click());}
function button(label:string){return [...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label)!;}
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);mocks.language='pt';mocks.completed=[];mocks.load.mockReset();mocks.update.mockReset();mocks.load.mockImplementation(async(language,units)=>translated(language,units));
 document.body.innerHTML='<div id="root"></div>';container=document.getElementById('root')!;root=createRoot(container);
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.setAttribute('open','');}});
});
afterEach(async()=>{await act(async()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();delete (HTMLDialogElement.prototype as any).showModal;});
it('loads the requested catalogue and lesson before rendering translated teaching and the lesson quiz',async()=>{
 await renderSchool('/school/newcomer');await until(()=>container.querySelectorAll('.lesson-row').length===4);
 expect(mocks.load.mock.calls[0][0]).toBe('pt');expect(mocks.load.mock.calls[0][1][0].id).toBe('catalogue');
 expect(container.querySelector('.lesson-row b')?.textContent).toMatch(/^pt — /);
 await click(container.querySelector('.lesson-row')!);await until(()=>!!container.querySelector('.lesson-reading'));
 expect(mocks.load.mock.calls.at(-1)?.[1][0].id).toBe('lesson:newcomer:1');
 expect(container.querySelector('.lesson-reading')?.getAttribute('lang')).toBe('pt');
 expect(container.querySelector('.lesson-reading p')?.textContent).toMatch(/^pt — /);
 expect(container.querySelector('cite')?.textContent).toBe(`Source: English · ${englishCourses[0].lessons[0].verseRef}`);
 await click(button('Try the lesson quiz'));
 expect(container.querySelector('.question-title')?.textContent).toMatch(/^pt — /);
 expect(container.querySelector('.quiz-options button')?.textContent).toContain('pt — ');
 expect(container.querySelector('dialog .education-notice')?.textContent).toContain('Automatic translation');
});
it('does not silently show English after a translation error, and offers explicit original-language reading',async()=>{
 mocks.load.mockRejectedValue({code:'unsupported_language'});await renderSchool();await until(()=>!!container.querySelector('[role="alert"]'));
 expect(container.querySelector('.course-panel')).toBeNull();expect(container.textContent).toContain('A reliable automatic translation could not be provided');
 await click(button('Show original'));await until(()=>container.querySelectorAll('.course-panel').length===4);
 expect(container.querySelector('select')?.value).toBe('en');expect(container.textContent).toContain('Current lesson language:');
 expect(container.querySelector('.course-panel h2')?.textContent).toBe(englishCourses[0].title);
});
it('ignores an earlier catalogue response when the site language changes',async()=>{
 let resolvePortuguese!:(map:Map<string,any>)=>void;let oldUnits:any[]=[];
 mocks.load.mockImplementation((language,units)=>language==='pt'?(oldUnits=units,new Promise(resolve=>{resolvePortuguese=resolve;})):Promise.resolve(translated(language,units)));
 await renderSchool();await until(()=>!!resolvePortuguese);mocks.language='zh';await renderSchool();await until(()=>container.querySelector('.course-panel h2')?.textContent?.startsWith('zh — ')===true);
 await act(async()=>resolvePortuguese(translated('pt',oldUnits)));
 expect(container.querySelector('.course-panel h2')?.textContent).toMatch(/^zh — /);expect(container.querySelector('.course-grid')?.getAttribute('lang')).toBe('zh');
});
it('does not open a stale lesson after changing language while it is translating',async()=>{
 let resolveLesson!:(map:Map<string,any>)=>void;let oldUnits:any[]=[];
 mocks.load.mockImplementation((language,units)=>units[0].kind==='lesson'?(oldUnits=units,new Promise(resolve=>{resolveLesson=resolve;})):Promise.resolve(translated(language,units)));
 await renderSchool('/school/newcomer');await until(()=>!!container.querySelector('.lesson-row'));await click(container.querySelector('.lesson-row')!);
 expect(resolveLesson).toBeDefined();expect((container.querySelector('.lesson-row') as HTMLButtonElement).disabled).toBe(true);
 mocks.language='ar';await renderSchool('/school/newcomer');await until(()=>container.querySelector('.lesson-list')?.getAttribute('lang')==='ar');
 await act(async()=>resolveLesson(translated('pt',oldUnits)));expect(container.querySelector('dialog')).toBeNull();expect(container.querySelector('.lesson-list')?.getAttribute('dir')).toBe('rtl');
});
it('loads ten catechism entries at a time and retrieves question 107 by number',async()=>{
 mocks.language='zh-Hant';await renderCatechism();await until(()=>container.querySelectorAll('.catechism-list button').length===10);
 expect(mocks.load.mock.calls[0][0]).toBe('zh-Hant');expect(mocks.load.mock.calls[0][1][0].id).toBe('catechism:0');
 expect(container.querySelector('.catechism-list b')?.textContent).toMatch(/^zh-Hant — /);
 await click(button('Next'));await until(()=>container.querySelector('.catechism-number')?.textContent==='11');
 expect(mocks.load.mock.calls.at(-1)?.[1][0].id).toBe('catechism:1');
 await act(async()=>{const input=container.querySelector('input')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'107');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await until(()=>container.querySelector('.catechism-number')?.textContent==='107');expect(mocks.load.mock.calls.at(-1)?.[1][0].id).toBe('catechism:10');
 await click(container.querySelector('.catechism-list button')!);await click(button('Think it through, then reveal the answer'));
 expect(container.querySelector('.catechism-answer p')?.textContent).toMatch(/^zh-Hant — /);expect(container.querySelector('.catechism-card')?.getAttribute('lang')).toBe('zh-Hant');
});
it('does not display a stale catechism translation as the new language',async()=>{
 let resolveOld!:(map:Map<string,any>)=>void;let oldUnits:any[]=[];
 mocks.load.mockImplementation((language,units)=>language==='pt'?(oldUnits=units,new Promise(resolve=>{resolveOld=resolve;})):Promise.resolve(translated(language,units)));
 await renderCatechism();await until(()=>!!resolveOld);mocks.language='fa';await renderCatechism();await until(()=>container.querySelector('.catechism-list b')?.textContent?.startsWith('fa — ')===true);
 await act(async()=>resolveOld(translated('pt',oldUnits)));expect(container.querySelector('.catechism-list b')?.textContent).toMatch(/^fa — /);expect(container.querySelector('.catechism-list')?.getAttribute('dir')).toBe('rtl');
});
it('keeps all 107 original-language questions and full text search without a translation request',async()=>{
 mocks.language='ko';await renderCatechism();await until(()=>container.querySelectorAll('.catechism-list button').length===107);
 expect(mocks.load).not.toHaveBeenCalled();expect(container.querySelector('input')?.type).toBe('search');expect(container.querySelector('.library-pagination')).toBeNull();
});
it('does not download a partial translated course when any lesson translation fails',async()=>{
 const create=vi.fn();Object.defineProperty(URL,'createObjectURL',{configurable:true,value:create});
 mocks.load.mockImplementation(async(language,units)=>{if(units[0]?.kind==='lesson')throw {code:'translation_busy'};return translated(language,units);});
 await renderSchool('/school/newcomer');await until(()=>!!container.querySelector('.lesson-row'));await click(button('Save lesson text'));await until(()=>!!container.querySelector('[role="alert"]'));
 expect(mocks.load.mock.calls.at(-1)?.[1].map((unit:any)=>unit.id)).toEqual(['lesson:newcomer:1','lesson:newcomer:2','lesson:newcomer:3','lesson:newcomer:4']);
 expect(create).not.toHaveBeenCalled();expect(button('Save lesson text').disabled).toBe(false);delete (URL as any).createObjectURL;
});

it('leaves a catechism group when continuing to an unfinished question outside its range',async()=>{
 mocks.completed=Array.from({length:99},(_,index)=>`catechism:${index+1}`);
 await renderCatechism();await until(()=>container.querySelectorAll('.catechism-list button').length===10);
 await click(button('God & salvation'));expect(container.querySelector('.catechism-tabs .active')?.textContent).toBe('God & salvation');
 await click(button('Continue learning'));await until(()=>container.querySelector('dialog .modal-heading h2')?.textContent==='Question 100');
 await click(container.querySelector('dialog button[aria-label="Close"]')!);
 expect(container.querySelector('.catechism-tabs .active')?.textContent).toBe('All');
 expect(container.querySelector('.library-pagination span')?.textContent).toBe('91–100 / 107');
 expect(container.querySelectorAll('.catechism-list button')).toHaveLength(10);
 expect(container.querySelector('dialog')).toBeNull();
});
