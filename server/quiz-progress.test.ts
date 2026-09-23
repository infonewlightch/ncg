import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
let db:PGlite;
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const op=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const first={answered:10,correct:7,rounds:1,bestScore:90,bestStreak:4};
type Result={answered:number;correct:number;rounds:number;best_score:number;best_streak:number;revision:number};
async function user<T>(id:string,sql:string,args:unknown[]=[]){await db.exec('set role authenticated');try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return await db.query<T>(sql,args);}finally{await db.exec('reset role');}}
async function change(id:string,n:number,delta:unknown){return (await user<Result>(id,'select * from ncg_update_quiz_progress($1,$2)',[op(n),JSON.stringify(delta)])).rows[0];}
beforeAll(async()=>{
 db=new PGlite();await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;");
 for(const file of ['001_ncg_members.sql','009_ncg_quiz_progress.sql'])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
 for(const id of [A,B])await db.query('insert into auth.users values($1)',[id]);
},20000);
afterAll(async()=>{await db?.close();});
describe('private quiz database',()=>{
 it('adds work from different devices, takes maxima, and never counts a replay twice',async()=>{
  await change(A,1,first);await change(A,2,{answered:5,correct:5,rounds:1,bestScore:60,bestStreak:5});
  const result=await change(A,1,first);expect(result).toMatchObject({answered:15,correct:12,rounds:2,best_score:90,best_streak:5,revision:2});
  await expect(change(A,1,{...first,answered:11})).rejects.toThrow('operation_conflict');
 });
 it('keeps rounds and best scores when a completed round is sent after its answers',async()=>{
  expect(await change(A,3,{answered:0,correct:0,rounds:1,bestScore:120,bestStreak:6})).toMatchObject({answered:15,correct:12,rounds:3,best_score:120,best_streak:6});
 });
 it('isolates accounts and denies anonymous reads, direct writes and replay ledger access',async()=>{
  await change(B,1,first);expect((await user<{user_id:string}>(B,'select user_id from ncg_quiz_progress')).rows).toEqual([{user_id:B}]);
  await expect(user(A,'update ncg_quiz_progress set answered=100 where user_id=$1',[A])).rejects.toThrow();
  await expect(user(A,'select * from ncg_quiz_operations')).rejects.toThrow();
  await db.exec('set role anon');try{await expect(db.query('select * from ncg_quiz_progress')).rejects.toThrow();await expect(db.query('select ncg_update_quiz_progress($1,$2)',[op(20),JSON.stringify(first)])).rejects.toThrow();}finally{await db.exec('reset role');}
 });
 it('rejects malformed, oversized and impossible counts without changing saved totals',async()=>{
  for(const value of [null,[],{}, {...first,correct:11},{...first,answered:-1},{...first,correct:'7'},{...first,rounds:null},{...first,rounds:0.5},{...first,bestStreak:31},{...first,bestScore:601},{...first,answered:1000001},{...first,extra:1}])await expect(change(A,4,value)).rejects.toThrow('invalid_quiz');
  expect((await user<Result>(A,'select * from ncg_quiz_progress')).rows[0].answered).toBe(15);
 });
 it('rejects suspended users and rate limits new writes while allowing safe retries',async()=>{
  await db.query('insert into ncg_suspensions(user_id) values($1)',[B]);await expect(change(B,2,first)).rejects.toThrow('not_authorized');
  await db.query("insert into ncg_quiz_operations(user_id,operation_id,payload_hash) select $1,('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'test' from generate_series(1,300) n",[A]);
  await expect(change(A,4,first)).rejects.toThrow('rate_limited');expect((await change(A,1,first)).answered).toBe(15);
 });
});
