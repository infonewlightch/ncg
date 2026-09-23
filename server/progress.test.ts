import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
let db:PGlite;
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const op=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function user<T>(id:string,sql:string,args:unknown[]=[]){await db.exec('set role authenticated');try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return await db.query<T>(sql,args);}finally{await db.exec('reset role');}}
async function change(id:string,operation:string,added:string[],removed:string[]){return (await user<{completed:string[]}>(id,'select (ncg_update_progress($1,$2,$3)).completed',[operation,added,removed])).rows[0].completed;}
beforeAll(async()=>{
 db=new PGlite();await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;");
 for(const file of ['001_ncg_members.sql','005_ncg_progress.sql'])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
 for(const id of [A,B])await db.query('insert into auth.users values($1)',[id]);
},20000);
afterAll(async()=>{await db?.close();});
describe('account learning progress changes',()=>{
 it('merges independent device work and applies an explicit undo',async()=>{
  expect(await change(A,op(1),['newcomer:1','qt:today'],[])).toEqual(['newcomer:1','qt:today']);
  await change(A,op(2),['catechism:2'],[]);
  expect(await change(A,op(3),[],['qt:today'])).toEqual(['catechism:2','newcomer:1']);
 });
 it('a delayed replay cannot resurrect the undone completion or change its original payload',async()=>{
  expect(await change(A,op(1),['newcomer:1','qt:today'],[])).toEqual(['catechism:2','newcomer:1']);
  await expect(change(A,op(1),['qt:today'],[])).rejects.toThrow('operation_conflict');
 });
 it('isolates operation IDs and progress by authenticated owner',async()=>{
  expect(await change(B,op(1),['baptism:1'],[])).toEqual(['baptism:1']);
  const rows=await user<{user_id:string}>(B,'select user_id from ncg_progress');expect(rows.rows).toEqual([{user_id:B}]);
  await expect(user(A,'select * from ncg_progress_operations')).rejects.toThrow();
  await expect(user(A,"update ncg_progress set completed='{}' where user_id=$1",[B])).rejects.toThrow();
  await expect(user(A,"select ncg_save_progress(array['qt:today'],array[]::text[])")).rejects.toThrow();
 });
 it('rejects invalid milestones, contradictory changes and suspended writers',async()=>{
  await expect(change(A,op(4),['bad html <x>'],[])).rejects.toThrow('invalid_progress');
  await expect(change(A,op(4),['qt:today'],['qt:today'])).rejects.toThrow('invalid_progress');
  await db.query('insert into ncg_suspensions(user_id) values($1)',[B]);await expect(change(B,op(2),['qt:today'],[])).rejects.toThrow('not_authorized');
 });
});
