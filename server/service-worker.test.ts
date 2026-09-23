import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
function worker(){
 const listeners:Record<string,(e:any)=>void>={};const cached=new Map<string,Response>();
 const cache={put:vi.fn(async(key:Request|string,r:Response)=>{cached.set(typeof key==='string'?key:key.url,r);}),match:vi.fn(async(key:Request|string)=>cached.get(typeof key==='string'?key:key.url)),keys:vi.fn(async()=>[]),delete:vi.fn(async()=>true),addAll:vi.fn(async()=>{})};
 const clients={claim:vi.fn(),matchAll:vi.fn(async()=>[]),openWindow:vi.fn(async()=>{})};const showNotification=vi.fn(async()=>{});
 const fetcher=vi.fn(async()=>new Response('public app shell'));
 vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self:{location:{origin:'https://ncg.example'},clients,registration:{showNotification},addEventListener:(name:string,handler:(e:any)=>void)=>listeners[name]=handler},caches:{open:async()=>cache,match:async(key:string)=>cached.get(key),delete:vi.fn()},fetch:fetcher,URL,Promise});
 return {listeners,cache,clients,showNotification,fetcher};
}
function request(path:string,mode='navigate'){return {url:`https://ncg.example${path}`,method:'GET',headers:new Headers(),mode};}
describe('Service worker privacy boundary',()=>{
 it('never replaces the public offline shell with admin, callback, or API responses',async()=>{
  const w=worker();for(const path of ['/admin.html','/auth/callback?code=private','/api/bible/passage','/?code=private','/api/translate']){const respondWith=vi.fn();w.listeners.fetch({request:request(path),respondWith});expect(respondWith).not.toHaveBeenCalled();}
  let response:Promise<Response>|undefined;w.listeners.fetch({request:request('/'),respondWith:(p:Promise<Response>)=>response=p});await response;expect(w.cache.put).toHaveBeenCalledWith('/',expect.any(Response));
 });
 it('opens only the local QT route even if a push payload contains an external URL',async()=>{
  const w=worker();let task:Promise<unknown>|undefined;
  w.listeners.notificationclick({notification:{close:vi.fn(),data:{date:'2028-03-12',url:'https://attacker.example'}},waitUntil:(p:Promise<unknown>)=>task=p});await task;
  expect(w.clients.openWindow).toHaveBeenCalledWith('https://ncg.example/#/qt?date=2028-03-12');
 });
 it('collapses repeated delivery tags and tolerates malformed notification data',async()=>{
  const w=worker();let task:Promise<unknown>|undefined;w.listeners.push({data:{json:()=>({date:'2028-03-12',title:'QT',body:'Today'})},waitUntil:(p:Promise<unknown>)=>task=p});await task;expect(w.showNotification).toHaveBeenCalledWith('QT',expect.objectContaining({tag:'ncg-qt-2028-03-12',renotify:false}));
  w.listeners.push({data:{json:()=>{throw Error();}},waitUntil:(p:Promise<unknown>)=>task=p});await task;expect(w.showNotification).toHaveBeenLastCalledWith('NCG · Global QT',expect.objectContaining({data:{date:''}}));
 });
});
