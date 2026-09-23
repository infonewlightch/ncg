import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const one='20000000-0000-4000-8000-000000000001',two='20000000-0000-4000-8000-000000000002';
const op=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function user<T>(id:string,sql:string,args:unknown[]=[]){await db.exec('set role authenticated');try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return await db.query<T>(sql,args);}finally{await db.exec('reset role');}}
async function change(id:string,n:number,added:unknown,removed:unknown=[]){return (await user<{items:string[];revision:number}>(id,'select items,revision from ncg_update_video_bookmarks($1,$2,$3)',[op(n),added,removed])).rows[0];}
beforeAll(async()=>{
 db=new PGlite();await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;");
 for(const file of ['001_ncg_members.sql','006_ncg_videos.sql','010_ncg_video_bookmarks.sql'])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
 for(const id of [A,B])await db.query('insert into auth.users values($1)',[id]);
 await db.query("insert into ncg_videos(id,title,url,language,category,status) values($1,'Private draft','https://example.com/private.mp4','en','sermon','draft')",[one]);
},20000);
afterAll(async()=>{await db?.close();});
it('merges independent saves, preserves removal on a late replay and rejects reused IDs with changed payloads',async()=>{
 expect((await change(A,1,[one])).items).toEqual([one]);expect((await change(A,2,[two])).items).toEqual([two,one]);
 expect((await change(A,3,[],[one])).items).toEqual([two]);expect((await change(A,1,[one])).items).toEqual([two]);
 await expect(change(A,1,[two])).rejects.toThrow('operation_conflict');expect((await change(A,4,[],[two])).items).toEqual([]);
});
it('keeps references private and cannot grant access to an unpublished video',async()=>{
 await change(B,1,[one]);expect((await user<{user_id:string}>(B,'select user_id from ncg_video_bookmarks')).rows).toEqual([{user_id:B}]);
 expect((await user(B,'select * from ncg_video_feed(saved=>$1)',[[one]])).rows).toEqual([]);
 await expect(user(A,'update ncg_video_bookmarks set items=$1',[[]])).rejects.toThrow();await expect(user(A,'select * from ncg_video_bookmark_operations')).rejects.toThrow();
 await db.exec('set role anon');try{await expect(db.query('select * from ncg_video_bookmarks')).rejects.toThrow();await expect(db.query('select ncg_update_video_bookmarks($1,$2,$3)',[op(99),[one],[]])).rejects.toThrow();}finally{await db.exec('reset role');}
});
it('rejects null, duplicate, contradictory and excessive references',async()=>{
 for(const added of [null,[null],[one,one],Array(5001).fill(one)])await expect(change(A,5,added)).rejects.toThrow('invalid_bookmarks');
 await expect(change(A,5,[one],[one])).rejects.toThrow('invalid_bookmarks');await expect(change(A,5,[],[two,two])).rejects.toThrow('invalid_bookmarks');
 const ids=Array.from({length:5000},(_,i)=>`30000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
 expect((await change(A,5,ids)).items).toHaveLength(5000);await expect(change(A,6,[one])).rejects.toThrow('bookmark_limit');
});
it('rejects suspended users and rate limits new writes without breaking accepted retries',async()=>{
 await db.query('insert into ncg_suspensions(user_id) values($1)',[B]);await expect(change(B,2,[two])).rejects.toThrow('not_authorized');
 await db.query("insert into ncg_video_bookmark_operations(user_id,operation_id,payload_hash) select $1,('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'test' from generate_series(1,300) n",[A]);
 await expect(change(A,6,[],[one])).rejects.toThrow('rate_limited');expect((await change(A,1,[one])).items).toHaveLength(5000);
});
