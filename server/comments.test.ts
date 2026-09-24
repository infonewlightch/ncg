import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
let db:PGlite,parent:string;
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003',ADMIN='00000000-0000-4000-8000-000000000004';
async function role<T>(id:string,sql:string,args:unknown[]=[]){await db.exec(`set role ${id?'authenticated':'anon'}`);try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return await db.query<T>(sql,args);}finally{await db.exec('reset role');}}
const create=async(id=B,p=parent,body='A thoughtful response.')=>(await role<{id:string}>(id,"select ncg_create_comment($1,$2,'en','Member','KR') as id",[p,body])).rows[0].id;
const comments=(id='')=>role<{id:string;status:string}>(id,'select * from ncg_comments($1)',[parent]);
const review=(id:string)=>role(ADMIN,"select ncg_review_post($1,'published')",[id]);
beforeAll(async()=>{
 db=new PGlite();await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;");
 for(const file of ['001_ncg_members.sql','002_ncg_qt.sql','004_ncg_community.sql','014_ncg_reflection_comments.sql'])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
 for(const id of [A,B,C,ADMIN])await db.query('insert into auth.users(id) values($1)',[id]);await db.query('insert into ncg_admins(user_id) values($1)',[ADMIN]);
},20000);
beforeEach(async()=>{await db.exec('truncate ncg_posts cascade;truncate ncg_blocks;');parent=(await db.query<{id:string}>("insert into ncg_posts(author_id,author,nationality,body,language,category,status) values($1,'Parent','KR','Shared reflection.','en','story','published') returning id",[A])).rows[0].id;});
afterAll(()=>db.close());
it('keeps replies pending and private until review, then keeps them out of top-level feeds',async()=>{
 const child=await create();expect((await comments()).rows).toEqual([]);expect((await comments(B)).rows).toEqual([expect.objectContaining({id:child,status:'pending'})]);
 expect((await role(ADMIN,'select id from ncg_posts where status=\'pending\'')).rows).toHaveLength(1);
 await expect(role(B,"update ncg_posts set status='published' where id=$1",[child])).rejects.toThrow();await expect(role(B,"select ncg_review_post($1,'published')",[child])).rejects.toThrow('not_authorized');
 await review(child);expect((await comments()).rows.map(p=>p.id)).toEqual([child]);expect((await role<{id:string}>('','select * from ncg_feed()')).rows.map(p=>p.id)).toEqual([parent]);
});
it('rejects anonymous, nested and nonpublic parents',async()=>{
 await expect(create('')).rejects.toThrow();const child=await create();await review(child);await expect(create(C,child)).rejects.toThrow('parent_unavailable');
 await db.query("update ncg_posts set status='pending' where id=$1",[parent]);await expect(create(C)).rejects.toThrow('parent_unavailable');expect((await comments(B)).rows).toEqual([]);
});
it('enforces parent visibility on direct table reads, translations, replies and reactions after blocking or withdrawal',async()=>{
 const child=await create();await review(child);await role(C,'select ncg_block_user($1)',[A]);
 expect((await comments(C)).rows).toEqual([]);expect((await role(C,'select body from ncg_posts where id=$1',[child])).rows).toEqual([]);await expect(create(C)).rejects.toThrow('parent_unavailable');await expect(role(C,'select ncg_pray_for_post($1,true)',[child])).rejects.toThrow('not_authorized');
 await role(A,'select ncg_withdraw_post($1)',[parent]);expect((await comments()).rows).toEqual([]);expect((await role(B,'select body from ncg_posts where id=$1',[child])).rows).toEqual([]);
});
it('enforces blocking between comment readers and authors while allowing reporting and owner withdrawal',async()=>{
 const child=await create();await review(child);await role(C,"select ncg_report_post($1,'Please review this comment')",[child]);expect((await role(ADMIN,'select body from ncg_posts where id=$1',[child])).rows).toHaveLength(1);
 await role(C,'select ncg_block_user($1)',[B]);expect((await comments(C)).rows).toEqual([]);await expect(role(C,'select ncg_withdraw_post($1)',[child])).rejects.toThrow('not_authorized');await role(B,'select ncg_withdraw_post($1)',[child]);expect((await comments()).rows).toEqual([]);
});
it('shares server rate limits and content filtering with reflections',async()=>{
 await create();await expect(create(B,parent,'Repeated very quickly.')).rejects.toThrow('rate_limited');
 await expect(create(C,parent,'fuck')).rejects.toThrow('content_rejected');
});
it('paginates replies without duplicates for equal timestamps',async()=>{
 await db.query("insert into ncg_posts(author_id,author,nationality,body,language,category,status,parent_post_id,created_at) select $1,'Member','KR','Comment '||n,'en','story','published',$2,'2026-09-01T00:00:00Z' from generate_series(1,35) n",[B,parent]);
 const first=(await role<{id:string;createdAt:Date}>('','select * from ncg_comments($1)',[parent])).rows;expect(first).toHaveLength(30);const last=first.at(-1)!;
 const next=(await role<{id:string}>('','select * from ncg_comments($1,$2,$3)',[parent,last.createdAt,last.id])).rows;expect(next).toHaveLength(5);expect(new Set([...first,...next].map(p=>p.id)).size).toBe(35);
});
