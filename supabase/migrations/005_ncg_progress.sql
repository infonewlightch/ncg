-- Idempotent additions/removals. A delayed retry cannot restore a later undone milestone.
alter table public.ncg_progress add column revision bigint not null default 0;
create table public.ncg_progress_operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,
 payload_hash text not null,
 created_at timestamptz not null default now(),
 primary key(user_id,operation_id)
);
alter table public.ncg_progress_operations enable row level security;
revoke all on public.ncg_progress_operations from public,anon,authenticated;
create index ncg_progress_operations_time on public.ncg_progress_operations(user_id,created_at desc);

create function public.ncg_update_progress(operation_id uuid,added text[],removed text[])
returns public.ncg_progress language plpgsql security definer set search_path='' as $$
declare result public.ncg_progress; digest text; previous_hash text;
begin
 if not public.ncg_active(auth.uid()) then raise exception 'not_authorized';end if;
 if operation_id is null or added is null or removed is null or cardinality(added)>5000 or cardinality(removed)>5000
  or exists(select 1 from unnest(added||removed) item where item is null or item !~ '^[A-Za-z0-9:_-]{1,120}$')
  or added && removed then raise exception 'invalid_progress';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 digest:=md5(jsonb_build_array(added,removed)::text);
 select op.payload_hash into previous_hash from public.ncg_progress_operations op where op.user_id=auth.uid() and op.operation_id=ncg_update_progress.operation_id;
 if previous_hash is not null and previous_hash<>digest then raise exception 'operation_conflict';end if;
 insert into public.ncg_progress(user_id) values(auth.uid()) on conflict do nothing;
 if previous_hash is null then
  if (select count(*) from public.ncg_progress_operations where user_id=auth.uid() and created_at>now()-interval '1 hour')>=300 then raise exception 'rate_limited';end if;
  update public.ncg_progress set completed=array(select distinct item from unnest(completed||added) item where not item=any(removed) order by item),revision=revision+1,updated_at=now() where user_id=auth.uid();
  insert into public.ncg_progress_operations(user_id,operation_id,payload_hash) values(auth.uid(),operation_id,digest);
 end if;
 select * into result from public.ncg_progress where user_id=auth.uid();
 return result;
end;$$;
revoke all on function public.ncg_update_progress(uuid,text[],text[]) from public,anon;
grant execute on function public.ncg_update_progress(uuid,text[],text[]) to authenticated;
-- Older union-only clients must update rather than silently re-add removed milestones.
revoke execute on function public.ncg_save_progress(text[],text[]) from authenticated;
