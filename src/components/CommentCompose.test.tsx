// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act} from 'react';import {createRoot,type Root} from 'react-dom/client';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),close:vi.fn(),session:{user:{id:'member'}} as unknown}));
vi.mock('../auth',()=>({useAuth:()=>({session:mocks.session}),supabase:{rpc:mocks.rpc}}));
vi.mock('./Ui',()=>({Modal:({children}:{children:import('react').ReactNode})=><div>{children}</div>}));
vi.mock('../state',()=>({useApp:()=>({state:{language:'en',ui:'en',profile:{name:'Member',nationality:'KR'}},t:(_ko:string,en:string)=>en,notify:()=>{},update:()=>{}})}));
import {Compose} from './Sharing';
let root:Root,container:HTMLElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();mocks.rpc.mockResolvedValue({error:null});mocks.session={user:{id:'member'}};document.body.innerHTML='<div id="root"></div>';container=document.getElementById('root')!;root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();});
it('sends a reply only to the server comment endpoint with its actual parent',async()=>{
 await act(async()=>root.render(<Compose parentId="11111111-1111-4111-8111-111111111111" onClose={mocks.close}/>));
 const input=container.querySelector('textarea')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,'Thank you for sharing.');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(mocks.rpc).toHaveBeenCalledWith('ncg_create_comment',{parent:'11111111-1111-4111-8111-111111111111',content:'Thank you for sharing.',source_language:'en',display_name:'Member',country:'KR'});expect(mocks.close).toHaveBeenCalledOnce();
});
