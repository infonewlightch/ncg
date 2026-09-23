import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
let db:PGlite;
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const op=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const one={version:'webp',passage:'JHN.3.16',reference:'John 3:16',language:'en'};
const two={...one,passage:'JHN.3.17',reference:'John 3:17'};
const key=(b:typeof one)=>`${b.version}:${b.passage}:${b.language}`;
async function user<T>(id:string,sql:string,args:unknown[]=[]){await db.exec('set role authenticated');try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return await db.query<T>(sql,args);}finally{await db.exec('reset role');}}
async function change(id:string,n:number,added:unknown,removed:string[]=[]){return (await user<{items:typeof one[];revision:number}>(id,'select items,revision from ncg_update_bible_bookmarks($1,$2,$3)',[op(n),JSON.stringify(added),removed])).rows[0];}
beforeAll(async()=>{
 db=new PGlite();await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;");
 for(const file of ['001_ncg_members.sql','008_ncg_bible_bookmarks.sql'])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
 for(const id of [A,B])await db.query('insert into auth.users values($1)',[id]);
},20000);
afterAll(async()=>{await db?.close();});
describe('account Bible bookmark database',()=>{
 it('preserves independent device saves and applies removal without replacing another device work',async()=>{
  expect((await change(A,1,[one])).items).toEqual([one]);
  expect((await change(A,2,[two])).items).toEqual([two,one]);
  expect((await change(A,3,[],[key(one)])).items).toEqual([two]);
  expect((await change(A,1,[one])).items).toEqual([two]);
  expect((await change(A,1,[one])).revision).toBe(3);
  await expect(change(A,1,[two])).rejects.toThrow('operation_conflict');
 });
 it('can clear the last bookmark and later create a new one',async()=>{
  expect((await change(A,4,[],[key(two)])).items).toEqual([]);
  expect((await change(A,5,[one,{...one,language:'ga'}])).items).toHaveLength(2);
 });
 it('isolates accounts even if operation IDs match and denies direct mutations',async()=>{
  expect((await change(B,1,[two])).items).toEqual([two]);
  expect((await user<{user_id:string}>(B,'select user_id from ncg_bible_bookmarks')).rows).toEqual([{user_id:B}]);
  await expect(user(A,'update ncg_bible_bookmarks set items=$1 where user_id=$2',['[]',B])).rejects.toThrow();
  await expect(user(A,'select * from ncg_bible_bookmark_operations')).rejects.toThrow();
  await db.exec('set role anon');try{await expect(db.query('select * from ncg_bible_bookmarks')).rejects.toThrow();await expect(db.query('select ncg_update_bible_bookmarks($1,$2,$3)',[op(99),'[]',[]])).rejects.toThrow();}finally{await db.exec('reset role');}
 });
 it('rejects malformed or contradictory bookmarks without changing the existing list',async()=>{
  for(const added of [null,{},[null],[{...one,reference:null}],[{...one,reference:'<img src=x>'}],[{...one,passage:'JHN.3.19-16'}],[{...one,language:'a/b'}],[{...one,secret:'bad'}],[one,one]])await expect(change(A,6,added)).rejects.toThrow('invalid_bookmarks');
  await expect(change(A,6,[one],[key(one)])).rejects.toThrow('invalid_bookmarks');
  expect((await user<{items:unknown[]}>(A,'select items from ncg_bible_bookmarks')).rows[0].items).toHaveLength(2);
 });
 it('rejects suspended writers and rate limits new operations, while keeping an accepted replay safe',async()=>{
  await db.query('insert into ncg_suspensions(user_id) values($1)',[B]);await expect(change(B,2,[one])).rejects.toThrow('not_authorized');
  await db.query("insert into ncg_bible_bookmark_operations(user_id,operation_id,payload_hash) select $1,('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'test' from generate_series(1,300) n",[A]);
  await expect(change(A,7,[two])).rejects.toThrow('rate_limited');
  expect((await change(A,5,[one,{...one,language:'ga'}])).items).toHaveLength(2);
 });
});
