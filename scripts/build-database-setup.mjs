import fs from 'node:fs';import {createHash} from 'node:crypto';
const files=fs.readdirSync('supabase/migrations').filter(f=>/^\d+_.*\.sql$/.test(f)).sort();
const migrations=files.map(name=>({name,sql:fs.readFileSync(`supabase/migrations/${name}`,'utf8')}));
const header=`-- Generated NCG setup for a NEW, empty NCG project only.\n-- No user is granted administrator access. No content is published.\n-- One transaction: an error rolls back the entire setup.\nbegin;\ndo $$begin if exists(select 1 from pg_tables where schemaname='public' and tablename like 'ncg_%') then raise exception 'NCG tables already exist. Apply reviewed incremental migrations instead.';end if;end;$$;\n`;
const log=`\ncreate table public.ncg_schema_migrations(name text primary key,sha256 text not null,applied_at timestamptz not null default now());\nalter table public.ncg_schema_migrations enable row level security;\nrevoke all on public.ncg_schema_migrations from public,anon,authenticated;\ninsert into public.ncg_schema_migrations(name,sha256) values\n${migrations.map(({name,sql})=>`('${name}','${createHash('sha256').update(sql).digest('hex')}')`).join(',\n')};\ncommit;\n`;
fs.writeFileSync('supabase/setup-new-project.sql',header+migrations.map(({name,sql})=>`\n-- ${name}\n${sql}`).join('\n')+log);
console.log(`Prepared ${files.length} migrations in one transaction.`);
