import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {previewQtWeek} from '../src/core/qt';
let db:PGlite;
const USER='00000000-0000-4000-8000-000000000001',ADMIN='00000000-0000-4000-8000-000000000002';
async function asRole<T>(role:string,id:string,sql:string,args:unknown[]=[]){await db.exec(`set role ${role}`);try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return await db.query<T>(sql,args);}finally{await db.exec('reset role');}}
const save=(user:string,document:unknown)=>asRole('authenticated',user,'select ncg_save_qt_reading($1::jsonb)',[JSON.stringify(document)]);
beforeAll(async()=>{db=new PGlite();await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;");for(const file of ['001_ncg_members.sql','002_ncg_qt.sql','007_ncg_qt_bounds.sql'])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));for(const id of [USER,ADMIN])await db.query('insert into auth.users(id) values($1)',[id]);await db.query('insert into ncg_admins(user_id) values($1)',[ADMIN]);},20000);
afterAll(()=>db.close());
describe('QT publication access rules',()=>{
 it('allows only a server-designated admin to save drafts',async()=>{await expect(save(USER,previewQtWeek[0])).rejects.toThrow('not_authorized');await save(ADMIN,previewQtWeek[0]);expect((await asRole('authenticated',ADMIN,'select id from ncg_qt_readings')).rows).toHaveLength(1);});
 it('keeps drafts hidden from both guests and ordinary members',async()=>{expect((await asRole('anon','','select id from ncg_qt_readings')).rows).toHaveLength(0);expect((await asRole('authenticated',USER,'select id from ncg_qt_readings')).rows).toHaveLength(0);});
 it('publishes one stable shared ID without exposing operator metadata',async()=>{await save(ADMIN,{...previewQtWeek[0],status:'published'});expect((await asRole('anon','','select id,passage from ncg_qt_readings')).rows).toHaveLength(1);await expect(asRole('anon','','select updated_by from ncg_qt_readings')).rejects.toThrow();await expect(asRole('authenticated',USER,"update ncg_qt_readings set status='published'")).rejects.toThrow();});
 it('locks published ranges even after unpublishing while allowing guide corrections',async()=>{const original=previewQtWeek[0];await save(ADMIN,{...original,status:'published',translations:{en:{...original.translations.en,title:'Corrected editorial title'}}});await expect(save(ADMIN,{...original,status:'published',passage:'JHN.1.1-6'})).rejects.toThrow('published_range_locked');await save(ADMIN,original);await expect(save(ADMIN,{...original,passage:'JHN.1.1-6'})).rejects.toThrow('published_range_locked');});
 it('rejects nonexistent chapters, verse overflow and mismatched section coordinates',async()=>{
  for(const passage of ['JHN.99.1','JHN.1.51-52','REV.23.1'])await expect(save(ADMIN,{...previewQtWeek[1],passage})).rejects.toThrow();
  await expect(save(ADMIN,{...previewQtWeek[1],section:'MAT.1.1-18'})).rejects.toThrow();
  await expect(save(ADMIN,{...previewQtWeek[1],section:'JHN.1.1-10'})).rejects.toThrow();
  await expect(save(ADMIN,{...previewQtWeek[1],part:1,parts:1})).rejects.toThrow();
  for(const row of previewQtWeek.slice(1))await save(ADMIN,row);
 });
 it('rejects invalid ranges and empty translated guides',async()=>{await expect(save(ADMIN,{...previewQtWeek[1],passage:'JHN.1.13-6'})).rejects.toThrow();await expect(save(ADMIN,{...previewQtWeek[1],translations:{en:{title:'',guide:'x',question:'x'}}})).rejects.toThrow();});
});
