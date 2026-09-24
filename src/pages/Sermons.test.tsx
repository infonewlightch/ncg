// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
vi.mock('../state',()=>({useApp:()=>({state:{language:'ko',ui:'en',bookmarks:[],lowData:true,videos:[{id:'old-local',title:'Old device video'}]},t:(_ko:string,en:string)=>en,update:vi.fn(),notify:vi.fn()})}));
vi.mock('../components/useVideos',()=>({useVideos:()=>({videos:[{id:'public',title:'Approved sermon',description:'First line\n\nSecond paragraph',language:'ko',category:'sermon',url:'https://www.youtube.com/watch?v=4YFNv1Szab8',official:true}],loading:false,hasMore:false,error:false})}));
import Sermons from './Sermons';
afterEach(()=>vi.unstubAllGlobals());
it('shows only published library videos and exposes no registration or local-video actions',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const container=document.createElement('div');const root=createRoot(container);
 try{await act(async()=>root.render(<Sermons onVideo={()=>{}} onLanguage={()=>{}}/>));expect(container.textContent).toContain('Approved sermon');expect(container.textContent).not.toContain('Old device video');expect(container.textContent).not.toContain('Add video');expect(container.textContent).not.toContain('Saved on this device');}finally{await act(async()=>root.unmount());}
});
