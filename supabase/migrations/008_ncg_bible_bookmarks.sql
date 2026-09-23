-- Private, account-scoped Bible references only; no licensed Scripture text is copied.
create table public.ncg_bible_bookmarks (
 user_id uuid primary key references auth.users(id) on delete cascade,
 items jsonb not null default '[]',
 revision bigint not null default 0,
 updated_at timestamptz not null default now()
);
create table public.ncg_bible_bookmark_operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,
 payload_hash text not null,
 created_at timestamptz not null default now(),
 primary key(user_id,operation_id)
);
alter table public.ncg_bible_bookmarks enable row level security;
alter table public.ncg_bible_bookmark_operations enable row level security;
revoke all on public.ncg_bible_bookmarks,public.ncg_bible_bookmark_operations from public,anon,authenticated;
grant select on public.ncg_bible_bookmarks to authenticated;
create policy bible_bookmarks_read on public.ncg_bible_bookmarks for select to authenticated using(user_id=auth.uid());
create index ncg_bible_bookmark_operations_time on public.ncg_bible_bookmark_operations(user_id,created_at desc);

create function public.ncg_bible_bookmark_key(item jsonb) returns text
language sql immutable set search_path='' as $$select (item->>'version')||':'||(item->>'passage')||':'||(item->>'language');$$;
revoke all on function public.ncg_bible_bookmark_key(jsonb) from public,anon,authenticated;

create function public.ncg_update_bible_bookmarks(operation_id uuid,added jsonb,removed text[])
returns public.ncg_bible_bookmarks language plpgsql security definer set search_path='' as $$
declare result public.ncg_bible_bookmarks; digest text; previous_hash text; item jsonb; parts text[]; merged jsonb;
begin
 if not public.ncg_active(auth.uid()) then raise exception 'not_authorized';end if;
 if operation_id is null or added is null or jsonb_typeof(added)<>'array' or removed is null then raise exception 'invalid_bookmarks';end if;
 if jsonb_array_length(added)>5000 or cardinality(removed)>5000 or octet_length(added::text)>2500000
  or exists(select 1 from unnest(removed) key where key is null or length(key)>160) then raise exception 'invalid_bookmarks';end if;
 for item in select value from jsonb_array_elements(added) loop
  if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>4
   or not (item ?& array['version','passage','reference','language'])
   or exists(select 1 from jsonb_each(item) e where jsonb_typeof(e.value)<>'string') then raise exception 'invalid_bookmarks';end if;
  if item->>'version' !~ '^(webp|ext-nkrv|eb-[a-zA-Z0-9_-]{1,60}|[1-9][0-9]{0,8})$'
   or item->>'language' !~ '^[a-zA-Z0-9-]{2,40}$'
   or length(btrim(item->>'reference'))=0 or length(item->>'reference')>240 or item->>'reference' ~ '[<>[:cntrl:]]'
   or public.ncg_bible_bookmark_key(item)=any(removed) then raise exception 'invalid_bookmarks';end if;
  parts:=regexp_match(item->>'passage','^([A-Z0-9]{3})\.([1-9][0-9]{0,2})(?:\.([1-9][0-9]{0,2})(?:-([1-9][0-9]{0,2}))?)?$');
  if parts is null or (parts[4] is not null and parts[4]::int<parts[3]::int) then raise exception 'invalid_bookmarks';end if;
 end loop;
 if (select count(*)<>count(distinct public.ncg_bible_bookmark_key(value)) from jsonb_array_elements(added)) then raise exception 'invalid_bookmarks';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 digest:=md5(jsonb_build_array(added,removed)::text);
 select op.payload_hash into previous_hash from public.ncg_bible_bookmark_operations op where op.user_id=auth.uid() and op.operation_id=ncg_update_bible_bookmarks.operation_id;
 if previous_hash is not null and previous_hash<>digest then raise exception 'operation_conflict';end if;
 insert into public.ncg_bible_bookmarks(user_id) values(auth.uid()) on conflict do nothing;
 if previous_hash is null then
  if (select count(*) from public.ncg_bible_bookmark_operations where user_id=auth.uid() and created_at>now()-interval '1 hour')>=300 then raise exception 'rate_limited';end if;
  select added||coalesce(jsonb_agg(old.value order by old.position) filter(where old.value is not null),'[]') into merged
  from public.ncg_bible_bookmarks b, jsonb_array_elements(b.items) with ordinality old(value,position)
  where b.user_id=auth.uid() and not public.ncg_bible_bookmark_key(old.value)=any(removed)
   and not exists(select 1 from jsonb_array_elements(added) a where public.ncg_bible_bookmark_key(a.value)=public.ncg_bible_bookmark_key(old.value));
  if jsonb_array_length(merged)>5000 then raise exception 'bookmark_limit';end if;
  update public.ncg_bible_bookmarks set items=merged,revision=revision+1,updated_at=now() where user_id=auth.uid();
  insert into public.ncg_bible_bookmark_operations(user_id,operation_id,payload_hash) values(auth.uid(),operation_id,digest);
 end if;
 select * into result from public.ncg_bible_bookmarks where user_id=auth.uid();return result;
end;$$;
revoke all on function public.ncg_update_bible_bookmarks(uuid,jsonb,text[]) from public,anon;
grant execute on function public.ncg_update_bible_bookmarks(uuid,jsonb,text[]) to authenticated;
