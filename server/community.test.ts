import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {previewQtWeek} from '../src/core/qt';
let db:PGlite,postA:string,postB:string;
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003',ADMIN='00000000-0000-4000-8000-000000000004';
async function role<T>(name:string,id:string,sql:string,args:unknown[]=[]){await db.exec(`set role ${name}`);try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return await db.query<T>(sql,args);}finally{await db.exec('reset role');}}
const member=<T>(id:string,sql:string,args:unknown[]=[])=>role<T>('authenticated',id,sql,args);
const feed=(id='',args:unknown[]=[])=>role<{id:string;authorId:string;prayerCount:number;hasPrayed:boolean;createdAt:Date}>(id?'authenticated':'anon',id,args.length?'select * from ncg_feed($1,$2,$3,$4,$5)':'select * from ncg_feed()',args);
async function submit(id:string,body:string,topic:string|null=null){const result=await member<{id:string}>(id,"select ncg_create_post($1,'en','story','Test member','Test country',$2) as id",[body,topic]);return result.rows[0].id;}
beforeAll(async()=>{db=new PGlite();await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;");for(const f of ['001_ncg_members.sql','002_ncg_qt.sql','004_ncg_community.sql'])await db.exec(readFileSync(new URL(`../supabase/migrations/${f}`,import.meta.url),'utf8'));for(const id of [A,B,C,ADMIN])await db.query('insert into auth.users(id) values($1)',[id]);await db.query('insert into ncg_admins(user_id) values($1)',[ADMIN]);},20000);
afterAll(()=>db.close());
describe('Worldwide reflections with review and blocking',()=>{
 it('keeps new posts pending and prevents forged identity or direct publication',async()=>{
  postA=await submit(A,'Thankful for a new day.');postB=await submit(B,'Praying for peace today.');
  expect((await feed()).rows).toHaveLength(0);expect((await feed(A)).rows.map(p=>p.id)).toEqual([postA]);
  await expect(member(A,"insert into ncg_posts(author_id,author,nationality,body,language,category,status) values($1,'Fake','X','Body','en','story','published')",[B])).rejects.toThrow();
  await expect(member(A,"select ncg_review_post($1,'published')",[postA])).rejects.toThrow('not_authorized');
  const own=await member<{author_id:string}>(A,'select author_id from ncg_posts');expect(own.rows[0].author_id).toBe(A);
 });
 it('makes approved posts readable worldwide with private, idempotent prayer reactions',async()=>{
  for(const id of [postA,postB])await member(ADMIN,"select ncg_review_post($1,'published')",[id]);expect((await feed()).rows).toHaveLength(2);
  await member(B,'select ncg_pray_for_post($1,true)',[postA]);await member(B,'select ncg_pray_for_post($1,true)',[postA]);
  expect((await feed(B)).rows.find(p=>p.id===postA)).toMatchObject({prayerCount:1,hasPrayed:true});expect((await feed()).rows.find(p=>p.id===postA)).toMatchObject({prayerCount:1,hasPrayed:false});
  await expect(member(A,'select user_id from ncg_post_prayers')).rejects.toThrow();
 });
 it('accepts one open report per reporter/post and gives the admin the reported text',async()=>{
  await member(A,"select ncg_report_post($1,'Review this reflection')",[postB]);await member(A,"select ncg_report_post($1,'Again')",[postB]);
  expect((await member(A,'select post_id from ncg_reports')).rows).toHaveLength(1);expect((await member(B,'select post_id from ncg_reports')).rows).toHaveLength(0);
  await member(ADMIN,"select ncg_review_post($1,'rejected')",[postB]);expect((await member(ADMIN,'select body from ncg_posts where id=$1',[postB])).rows).toHaveLength(1);expect((await feed()).rows).toHaveLength(1);
  await member(ADMIN,"select ncg_review_post($1,'published')",[postB]);
 });
 it('enforces blocking in feeds, direct table access and reactions in both directions',async()=>{
  await member(A,'select ncg_block_user($1)',[B]);expect((await feed(A)).rows.map(p=>p.id)).toEqual([postA]);expect((await feed(B)).rows.map(p=>p.id)).toEqual([postB]);
  expect((await member(A,'select id from ncg_posts where id=$1',[postB])).rows).toHaveLength(0);expect((await member<{blocked:boolean}>(C,'select ncg_blocked($1,$2) as blocked',[A,B])).rows[0].blocked).toBe(false);await expect(member(B,'select ncg_pray_for_post($1,true)',[postA])).rejects.toThrow('not_authorized');
 });
 it('requires published QT topics and separates their discussion from the general feed',async()=>{
  const result=await member<{id:string}>(ADMIN,'select ncg_save_qt_reading($1::jsonb) as id',[JSON.stringify(previewQtWeek[0])]);const qt=result.rows[0].id;
  await expect(submit(C,'A reflection on the Word.',qt)).rejects.toThrow('qt_not_published');
  await member(ADMIN,'select ncg_save_qt_reading($1::jsonb)',[JSON.stringify({...previewQtWeek[0],status:'published'})]);const post=await submit(C,'A reflection on the Word.',qt);await member(ADMIN,"select ncg_review_post($1,'published')",[post]);
  expect((await feed()).rows.map(p=>p.id)).not.toContain(post);expect((await feed('', ['qt',qt,null,null,null])).rows.map(p=>p.id)).toEqual([post]);
 });
 it('can withdraw only one’s own reflection and does not allow admin re-publication after withdrawal',async()=>{
  await expect(member(C,'select ncg_withdraw_post($1)',[postA])).rejects.toThrow('not_authorized');await member(A,'select ncg_withdraw_post($1)',[postA]);expect((await feed()).rows.map(p=>p.id)).not.toContain(postA);await expect(member(ADMIN,"select ncg_review_post($1,'published')",[postA])).rejects.toThrow('post_unavailable');
 });
 it('paginates equal timestamps without duplicate or skipped posts',async()=>{
  await db.query("insert into ncg_posts(author_id,author,nationality,body,language,category,status,created_at) select $1,'Test member','Test country','Page fixture '||n,'en','story','published','2020-01-01T00:00:00Z' from generate_series(1,35) n",[C]);
  const first=(await feed()).rows;expect(first).toHaveLength(30);const last=first.at(-1)!;const next=(await feed('', ['community',null,null,last.createdAt,last.id])).rows;const all=[...first,...next];expect(new Set(all.map(p=>p.id)).size).toBe(all.length);expect(all).toHaveLength(36);
 });
});
