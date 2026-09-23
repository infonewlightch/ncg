import type { Media } from './model';
export function parseMedia(input:string):Media|null {
  try {
    const u=new URL(input.trim());
    if (u.protocol!=='https:' || u.username || u.password || u.port) return null;
    const host=u.hostname.toLowerCase();
    let id:string|null=null;
    if (host==='youtu.be') id=u.pathname.slice(1);
    else if (['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com','youtube-nocookie.com'].includes(host)) {
      if (u.pathname==='/watch') id=u.searchParams.get('v');
      else id=u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})\/?$/)?.[1]??null;
    } else if (/\.(mp4|webm)$/i.test(u.pathname)) return {kind:'file',url:u.href};
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    return {kind:'youtube',id,url:`https://www.youtube.com/watch?v=${id}`};
  } catch {return null;}
}
export function mediaEmbed(media:Media,language:string):string {
  if(media.kind==='file') return media.url;
  const query=new URLSearchParams({autoplay:'1',playsinline:'1',rel:'0',cc_load_policy:'1',cc_lang_pref:language});
  return `https://www.youtube-nocookie.com/embed/${media.id}?${query}`;
}
