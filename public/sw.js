const SHELL='ncg-public-shell-v2';
// Online eviction must never delete the user's verified offline download.
const RUNTIME='ncg-public-runtime-v1';
const CONTENT='ncg-public-content-v1';
const ICON='/brand/newlight-symbol.png';
self.addEventListener('install',event=>event.waitUntil(caches.open(RUNTIME).then(cache=>cache.addAll(['/','/offline.html',ICON]))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.delete('ncg-public-shell-v1'),self.clients.claim()])));
async function store(cacheName,request,response,max){
 if(!response.ok||response.type==='opaque')return;
 const cache=await caches.open(cacheName);await cache.put(request,response.clone());
 const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-max)))await cache.delete(key);
}
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||request.headers.has('Authorization')||url.search)return;
 // Never cache admin pages, callbacks, APIs, or private account responses as the public shell.
 if(request.mode==='navigate'){
  if(url.pathname!=='/'&&url.pathname!=='/index.html')return;
  event.respondWith(fetch(request).then(async response=>{await store(RUNTIME,'/',response,100).catch(()=>{});return response;}).catch(async()=>await caches.match('/offline-entry.html')||await caches.match('/')||await caches.match('/offline.html')));return;
 }
 const asset=url.pathname.startsWith('/assets/')||url.pathname===ICON;
 const publicContent=/^\/bibles\/webp\/(index|[A-Z0-9]{3}\.\d+)\.json$/.test(url.pathname)||/^\/quizzes\/(ko|en|th)\.json$/.test(url.pathname);
 if(!asset&&!publicContent)return;
 const cacheName=asset?RUNTIME:CONTENT;
 event.respondWith((async()=>{const cache=await caches.open(cacheName);const cached=await cache.match(request)||(asset?await (await caches.open(SHELL)).match(request):undefined);if(asset&&cached)return cached;try{const response=await fetch(request);if(response.ok)await store(cacheName,request,response,asset?100:200).catch(()=>{});return response;}catch(error){if(cached)return cached;throw error;}})());
});
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{};}catch{}
 const date=typeof payload.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(payload.date)?payload.date:'';
 const title=typeof payload.title==='string'?payload.title.slice(0,120):'NCG · Global QT';
 const body=typeof payload.body==='string'?payload.body.slice(0,300):'Take a moment with the Word today.';
 event.waitUntil(self.registration.showNotification(title,{body,icon:ICON,badge:ICON,tag:`ncg-qt-${date||'daily'}`,renotify:false,data:{date},lang:typeof payload.language==='string'?payload.language:'en'}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const date=event.notification.data?.date;
 const url=new URL(typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)?`/#/qt?date=${date}`:'/#/qt',self.location.origin).href;
 event.waitUntil((async()=>{const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of clients){const current=new URL(client.url);if(current.origin===self.location.origin&&current.pathname==='/'){await client.navigate(url);await client.focus();return;}}await self.clients.openWindow(url);})());
});
