// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({login:vi.fn(),reset:vi.fn(),update:vi.fn(),clear:vi.fn()}));
vi.mock('../auth',()=>({supabase:{auth:{signInWithPassword:mocks.login,resetPasswordForEmail:mocks.reset,updateUser:mocks.update}},useAuth:()=>({configured:true,clearIssue:mocks.clear})}));
import {AdminLogin,AdminPassword} from './AdminAuth';
let root:Root,container:HTMLElement;
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);document.body.innerHTML='<div id="root"></div>';container=document.getElementById('root')!;root=createRoot(container);mocks.login.mockResolvedValue({error:null});mocks.reset.mockResolvedValue({error:null});mocks.update.mockResolvedValue({error:null});});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();});
async function input(selector:string,value:string){await act(async()=>{const element=container.querySelector(selector)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));});}
async function submit(){await act(async()=>{container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});}
it('uses password authentication without a public registration or OAuth path',async()=>{
 await act(async()=>root.render(<AdminLogin/>));await input('[type=email]','admin@example.test');await input('[type=password]','test-only-password');await submit();
 expect(mocks.login).toHaveBeenCalledWith({email:'admin@example.test',password:'test-only-password'});expect(mocks.reset).not.toHaveBeenCalled();expect(container.querySelector<HTMLInputElement>('[type=password]')!.value).toBe('');expect(container.textContent).not.toContain('Google');expect(container.textContent).not.toContain('회원가입');
});
it('sends account recovery to the admin entry without revealing account existence',async()=>{
 await act(async()=>root.render(<AdminLogin/>));await input('[type=email]','admin@example.test');await act(async()=>{[...container.querySelectorAll('button')].find(x=>x.textContent?.includes('처음 설정'))!.click();});await submit();expect(mocks.reset).toHaveBeenCalledWith('admin@example.test',{redirectTo:new URL('/admin.html',location.origin).href});expect(container.textContent).toContain('등록된 계정이라면');expect(mocks.login).not.toHaveBeenCalled();
});
it('requires matching password confirmation and leaves server authorization unchanged',async()=>{
 const done=vi.fn();await act(async()=>root.render(<AdminPassword onDone={done}/>));await input('input:first-of-type','test-only-password');await submit();expect(mocks.update).not.toHaveBeenCalled();
 const inputs=container.querySelectorAll('input');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(inputs[1],'test-only-password');inputs[1].dispatchEvent(new Event('input',{bubbles:true}));});await submit();expect(mocks.update).toHaveBeenCalledWith({password:'test-only-password'});expect(container.textContent).toContain('비밀번호를 저장했습니다');expect(container.querySelector('input')).toBeNull();expect(done).not.toHaveBeenCalled();
});
