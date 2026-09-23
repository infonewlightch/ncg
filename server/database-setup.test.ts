import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
it('applies the complete production schema with RLS everywhere and no published content or admins',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;grant usage on schema auth,public to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;");
  const sql=readFileSync(new URL('../supabase/setup-new-project.sql',import.meta.url),'utf8');await db.exec(sql);
  const migrations=new URL('../supabase/migrations/',import.meta.url);
  const expected=readdirSync(migrations).filter(name=>/^\d+_.*\.sql$/.test(name)).sort().map(name=>({name,sha256:createHash('sha256').update(readFileSync(new URL(name,migrations))).digest('hex')}));
  expect((await db.query('select name,sha256 from ncg_schema_migrations order by name')).rows).toEqual(expected);
  expect((await db.query("select tablename from pg_tables where schemaname='public' and tablename like 'ncg_%' and not rowsecurity")).rows).toEqual([]);
  expect((await db.query('select * from ncg_admins')).rows).toEqual([]);
  await db.exec('set role anon');
  expect((await db.query('select id from ncg_qt_readings')).rows).toEqual([]);expect((await db.query('select * from ncg_posts')).rows).toEqual([]);
  await expect(db.query('select * from ncg_messages')).rejects.toThrow();await expect(db.query('select * from ncg_schema_migrations')).rejects.toThrow();
  await db.exec('reset role');await expect(db.exec(sql)).rejects.toThrow('NCG tables already exist');await db.exec('rollback');
 }finally{await db.close();}
},20000);
