-- Personal practice totals; these client-reported scores are not public rankings.
create table public.ncg_quiz_progress (
 user_id uuid primary key references auth.users(id) on delete cascade,
 answered integer not null default 0 check(answered between 0 and 1000000000),
 correct integer not null default 0 check(correct between 0 and answered),
 rounds integer not null default 0 check(rounds between 0 and 1000000000),
 best_score integer not null default 0 check(best_score between 0 and 600),
 best_streak integer not null default 0 check(best_streak between 0 and 30),
 revision bigint not null default 0,
 updated_at timestamptz not null default now()
);
create table public.ncg_quiz_operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,
 payload_hash text not null,
 created_at timestamptz not null default now(),
 primary key(user_id,operation_id)
);
alter table public.ncg_quiz_progress enable row level security;
alter table public.ncg_quiz_operations enable row level security;
revoke all on public.ncg_quiz_progress,public.ncg_quiz_operations from public,anon,authenticated;
grant select on public.ncg_quiz_progress to authenticated;
create policy quiz_progress_read on public.ncg_quiz_progress for select to authenticated using(user_id=auth.uid());
create index ncg_quiz_operations_time on public.ncg_quiz_operations(user_id,created_at desc);

create function public.ncg_update_quiz_progress(operation_id uuid,delta jsonb)
returns public.ncg_quiz_progress language plpgsql security definer set search_path='' as $$
declare result public.ncg_quiz_progress; digest text; previous_hash text;
 answered_delta integer;correct_delta integer;rounds_delta integer;score integer;streak integer;
begin
 if not public.ncg_active(auth.uid()) then raise exception 'not_authorized';end if;
 if operation_id is null or delta is null or jsonb_typeof(delta)<>'object' then raise exception 'invalid_quiz';end if;
 if (select count(*) from jsonb_object_keys(delta))<>5
  or not (delta ?& array['answered','correct','rounds','bestScore','bestStreak'])
  or exists(select 1 from jsonb_each(delta) e where jsonb_typeof(e.value)<>'number' or e.value::text !~ '^[0-9]{1,7}$') then raise exception 'invalid_quiz';end if;
 answered_delta:=(delta->>'answered')::integer;correct_delta:=(delta->>'correct')::integer;rounds_delta:=(delta->>'rounds')::integer;score:=(delta->>'bestScore')::integer;streak:=(delta->>'bestStreak')::integer;
 if answered_delta>1000000 or correct_delta>answered_delta or rounds_delta>1000000 or score>600 or streak>30 then raise exception 'invalid_quiz';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 digest:=md5(delta::text);
 select op.payload_hash into previous_hash from public.ncg_quiz_operations op where op.user_id=auth.uid() and op.operation_id=ncg_update_quiz_progress.operation_id;
 if previous_hash is not null and previous_hash<>digest then raise exception 'operation_conflict';end if;
 insert into public.ncg_quiz_progress(user_id) values(auth.uid()) on conflict do nothing;
 if previous_hash is null then
  if (select count(*) from public.ncg_quiz_operations where user_id=auth.uid() and created_at>now()-interval '1 hour')>=300 then raise exception 'rate_limited';end if;
  select * into result from public.ncg_quiz_progress where user_id=auth.uid();
  if result.answered::bigint+answered_delta>1000000000 or result.rounds::bigint+rounds_delta>1000000000 then raise exception 'quiz_limit';end if;
  update public.ncg_quiz_progress set answered=answered+answered_delta,correct=correct+correct_delta,rounds=rounds+rounds_delta,best_score=greatest(best_score,score),best_streak=greatest(best_streak,streak),revision=revision+1,updated_at=now() where user_id=auth.uid();
  insert into public.ncg_quiz_operations(user_id,operation_id,payload_hash) values(auth.uid(),operation_id,digest);
 end if;
 select * into result from public.ncg_quiz_progress where user_id=auth.uid();return result;
end;$$;
revoke all on function public.ncg_update_quiz_progress(uuid,jsonb) from public,anon;
grant execute on function public.ncg_update_quiz_progress(uuid,jsonb) to authenticated;
