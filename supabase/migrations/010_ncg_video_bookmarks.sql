-- Store private video references only. Feed RLS still decides which videos can be read.
create table public.ncg_video_bookmarks (
 user_id uuid primary key references auth.users(id) on delete cascade,
 items uuid[] not null default '{}',revision bigint not null default 0,updated_at timestamptz not null default now()
);
create table public.ncg_video_bookmark_operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,payload_hash text not null,created_at timestamptz not null default now(),primary key(user_id,operation_id)
);
alter table public.ncg_video_bookmarks enable row level security;
alter table public.ncg_video_bookmark_operations enable row level security;
revoke all on public.ncg_video_bookmarks,public.ncg_video_bookmark_operations from public,anon,authenticated;
grant select on public.ncg_video_bookmarks to authenticated;
create policy video_bookmarks_read on public.ncg_video_bookmarks for select to authenticated using(user_id=auth.uid());
create index ncg_video_bookmark_operations_time on public.ncg_video_bookmark_operations(user_id,created_at desc);
create function public.ncg_update_video_bookmarks(operation_id uuid,added uuid[],removed uuid[])
returns public.ncg_video_bookmarks language plpgsql security definer set search_path='' as $$
declare result public.ncg_video_bookmarks;digest text;previous_hash text;merged uuid[];
begin
 if not public.ncg_active(auth.uid()) then raise exception 'not_authorized';end if;
 if operation_id is null or added is null or removed is null or cardinality(added)>5000 or cardinality(removed)>5000
  or array_position(added,null) is not null or array_position(removed,null) is not null or added&&removed
  or (select count(*)<>count(distinct id) from unnest(added) id) or (select count(*)<>count(distinct id) from unnest(removed) id) then raise exception 'invalid_bookmarks';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 digest:=md5(jsonb_build_array(added,removed)::text);
 select op.payload_hash into previous_hash from public.ncg_video_bookmark_operations op where op.user_id=auth.uid() and op.operation_id=ncg_update_video_bookmarks.operation_id;
 if previous_hash is not null and previous_hash<>digest then raise exception 'operation_conflict';end if;
 insert into public.ncg_video_bookmarks(user_id) values(auth.uid()) on conflict do nothing;
 if previous_hash is null then
  if (select count(*) from public.ncg_video_bookmark_operations where user_id=auth.uid() and created_at>now()-interval '1 hour')>=300 then raise exception 'rate_limited';end if;
  select added||coalesce(array_agg(old.id order by old.position) filter(where old.id is not null),'{}'::uuid[]) into merged
  from public.ncg_video_bookmarks b,unnest(b.items) with ordinality old(id,position)
  where b.user_id=auth.uid() and not old.id=any(removed) and not old.id=any(added);
  if cardinality(merged)>5000 then raise exception 'bookmark_limit';end if;
  update public.ncg_video_bookmarks set items=merged,revision=revision+1,updated_at=now() where user_id=auth.uid();
  insert into public.ncg_video_bookmark_operations(user_id,operation_id,payload_hash) values(auth.uid(),operation_id,digest);
 end if;
 select * into result from public.ncg_video_bookmarks where user_id=auth.uid();return result;
end;$$;
revoke all on function public.ncg_update_video_bookmarks(uuid,uuid[],uuid[]) from public,anon;
grant execute on function public.ncg_update_video_bookmarks(uuid,uuid[],uuid[]) to authenticated;
