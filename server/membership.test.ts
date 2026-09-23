import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
let db:PGlite;
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003',D='00000000-0000-4000-8000-000000000004',ADMIN='00000000-0000-4000-8000-000000000005';
async function asUser<T>(id:string,sql:string,args:unknown[]=[]){
 await db.exec('set role authenticated');
 try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return await db.query<T>(sql,args);}finally{await db.exec('reset role');}
}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;");
 for(const file of ['001_ncg_members.sql','002_ncg_qt.sql','004_ncg_community.sql','005_ncg_progress.sql'])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
 for(const id of [A,B,C,D,ADMIN])await db.query('insert into auth.users(id) values($1)',[id]);
 await db.query('insert into public.ncg_admins(user_id) values($1)',[ADMIN]);
},20000);
afterAll(async()=>{await db?.close();});
describe('membership access rules in PostgreSQL',()=>{
 it('does not allow direct message insertion or role escalation',async()=>{
  await expect(asUser(A,'insert into ncg_messages(sender,recipient,body,language) values($1,$2,$3,$4)',[A,B,'hello','en'])).rejects.toThrow();
  await expect(asUser(A,'insert into ncg_admins(user_id) values($1)',[A])).rejects.toThrow();
 });
 it('only the recipient can accept a request, then the pair can chat',async()=>{
  await asUser(A,'select ncg_request_friend($1)',[B]);
  const r=await asUser<{id:string}>(A,'select id from ncg_friends');const id=r.rows[0].id;
  await expect(asUser(A,'select ncg_answer_friend($1,true)',[id])).rejects.toThrow('not_authorized');
  await expect(asUser(A,"select ncg_send_message($1,'Hello','en')",[B])).rejects.toThrow('contact_not_allowed');
  await asUser(B,'select ncg_answer_friend($1,true)',[id]);
  await asUser(A,"select ncg_send_message($1,'A peaceful day','en')",[B]);
  expect((await asUser(B,'select * from ncg_messages')).rows).toHaveLength(1);
  expect((await asUser(C,'select * from ncg_messages')).rows).toHaveLength(0);
 });
 it('does not expose ordinary private messages to the admin',async()=>{expect((await asUser(ADMIN,'select * from ncg_messages')).rows).toHaveLength(0);});
 it('blocking prevents messages and new requests in both directions',async()=>{
  await asUser(B,'select ncg_block_user($1)',[A]);
  for(const [from,to] of [[A,B],[B,A]]){
   await expect(asUser(from,"select ncg_send_message($1,'blocked','en')",[to])).rejects.toThrow('contact_not_allowed');
   await expect(asUser(from,'select ncg_request_friend($1)',[to])).rejects.toThrow('contact_not_allowed');
  }
  expect((await asUser(B,'select * from ncg_messages')).rows).toHaveLength(0);
 });
 it('holds links, blocks rapid sending, and requires admin approval',async()=>{
  await asUser(C,'select ncg_request_friend($1)',[D]);const f=await asUser<{id:string}>(D,'select id from ncg_friends');
  await asUser(D,'select ncg_answer_friend($1,true)',[f.rows[0].id]);
  const m=await asUser<{ncg_send_message:{id:string,status:string}}>(C,"select to_jsonb(ncg_send_message($1,'Please see https://example.com','en')) as ncg_send_message",[D]);
  const msg=m.rows[0].ncg_send_message;expect(msg.status).toBe('pending');
  expect((await asUser(D,'select * from ncg_messages')).rows).toHaveLength(0);
  await expect(asUser(C,"select ncg_send_message($1,'Too fast','en')",[D])).rejects.toThrow('rate_limited');
  await expect(asUser(C,"select ncg_review_message($1,'published')",[msg.id])).rejects.toThrow('not_authorized');
  await asUser(ADMIN,"select ncg_review_message($1,'published')",[msg.id]);
  expect((await asUser(D,'select * from ncg_messages')).rows).toHaveLength(1);
 });
 it('rejects explicit profanity before it reaches the recipient',async()=>{await expect(asUser(D,"select ncg_send_message($1,'motherfucker','en')",[C])).rejects.toThrow('content_rejected');});
 it('users see only their own reports and saved progress',async()=>{
  await asUser(D,"select ncg_report($1,null,'spam')",[C]);
  expect((await asUser(C,'select * from ncg_reports')).rows).toHaveLength(0);
  expect((await asUser(ADMIN,'select * from ncg_reports')).rows).toHaveLength(1);
  await asUser(C,"select ncg_update_progress('11111111-1111-4111-8111-111111111111',array['newcomer:1'],array[]::text[])");
  expect((await asUser(C,'select * from ncg_progress')).rows).toHaveLength(1);
  expect((await asUser(D,'select * from ncg_progress')).rows).toHaveLength(0);
 });
 it('suspension prevents writing even through a direct RPC',async()=>{
  await asUser(ADMIN,"select ncg_suspend_user($1,'review',true)",[D]);
  await expect(asUser(D,"select ncg_send_message($1,'Still here','en')",[C])).rejects.toThrow('contact_not_allowed');
 });
});
