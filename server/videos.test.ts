import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
let db:PGlite;
const MEMBER='00000000-0000-4000-8000-000000000001',ADMIN='00000000-0000-4000-8000-000000000002';
const content={title:'Test sermon',description:'Test-only fixture',url:'https://www.youtube.com/watch?v=Abc_def-123',language:'en',category:'sermon',speaker:'Test speaker',scripture:'John 1:1–5'};
async function user<T>(id:string,sql:string,args:unknown[]=[]){await db.exec('set role authenticated');try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return await db.query<T>(sql,args);}finally{await db.exec('reset role');}}
async function guest<T>(sql:string,args:unknown[]=[]){await db.exec('set role anon');try{return await db.query<T>(sql,args);}finally{await db.exec('reset role');}}
async function save(input:Record<string,unknown>=content,publish=false,reviewed=false,id:string|null=null){return (await user<{id:string}>(ADMIN,'select ncg_save_video($1,$2,$3,$4) id',[id,input,publish,reviewed])).rows[0].id;}
beforeAll(async()=>{
 db=new PGlite();await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;");
 for(const file of ['001_ncg_members.sql','006_ncg_videos.sql'])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
 for(const id of [MEMBER,ADMIN])await db.query('insert into auth.users values($1)',[id]);await db.query('insert into ncg_admins values($1)',[ADMIN]);
},20000);
afterAll(async()=>{await db?.close();});
describe('church video publishing and public catalogue',()=>{
 it('prevents members and guests publishing or writing directly',async()=>{
  await expect(user(MEMBER,'select ncg_save_video(null,$1,true,true)',[content])).rejects.toThrow('not_authorized');
  await expect(guest('select ncg_save_video(null,$1,true,true)',[content])).rejects.toThrow();
  await expect(user(MEMBER,"insert into ncg_videos(title,url,language,category) values('x','x','en','sermon')")).rejects.toThrow();
 });
 it('hides drafts, requires review, allows public reading and revokes it when unpublished',async()=>{
  const id=await save();expect((await guest('select * from ncg_videos')).rows).toHaveLength(0);expect((await user(ADMIN,'select * from ncg_videos')).rows).toHaveLength(1);
  await expect(save(content,true,false,id)).rejects.toThrow('review_required');await save(content,true,true,id);
  expect((await guest('select * from ncg_video_feed()')).rows).toHaveLength(1);
  await save(content,false,false,id);expect((await guest('select * from ncg_videos where id=$1',[id])).rows).toHaveLength(0);
 });
 it('rejects executable, credentialed, spoofed YouTube and invalid media links',async()=>{
  for(const url of ['javascript:alert(1)','https://user:pass@example.com/test.mp4','https://youtube.com.evil.test/watch?v=Abc_def-123','https://example.com/page','http://example.com/test.mp4'])await expect(save({...content,url})).rejects.toThrow('invalid_video_url');
  await expect(save({...content,url:'https://cdn.example.com/messages/test.mp4?token=public-example'})).resolves.toBeTypeOf('string');
 });
 it('paginates equal-time rows without omission and treats search characters literally',async()=>{
  const ids=[];for(let n=0;n<26;n++)ids.push(await save({...content,title:n===0?'Literal 100% grace':`Page test ${n}`,language:n===0?'ko':'en'},true,true));
  await db.query("update ncg_videos set published_at='2026-09-23T00:00:00Z' where status='published'");
  const first=await guest<{id:string;published_at:Date}>('select * from ncg_video_feed()');expect(first.rows).toHaveLength(24);const last=first.rows.at(-1)!;
  const second=await guest<{id:string}>('select * from ncg_video_feed(before_time=>$1,before_id=>$2)',[last.published_at,last.id]);expect(second.rows).toHaveLength(2);expect(new Set([...first.rows,...second.rows].map(v=>v.id)).size).toBe(26);
  expect((await guest('select * from ncg_video_feed(query=>$1)',['%'])).rows).toHaveLength(1);
  expect((await guest('select * from ncg_video_feed(source_language=>$1)',['ko-KR'])).rows).toHaveLength(1);
  expect((await guest('select * from ncg_video_feed(saved=>$1)',[[ids[0]]])).rows).toHaveLength(1);
 });
});
