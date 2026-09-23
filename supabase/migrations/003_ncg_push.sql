-- Device subscriptions are private capability URLs. Never expose them in logs or public APIs.
create table public.ncg_push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(length(endpoint)<=2048),p256dh text not null,auth_key text not null,
 local_time time not null default '07:00',time_zone text not null,language text not null,
 enabled boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.ncg_push_deliveries(
 id uuid primary key default gen_random_uuid(),subscription_id uuid not null references public.ncg_push_subscriptions(id) on delete cascade,
 reading_id uuid not null references public.ncg_qt_readings(id),local_date date not null,
 status text not null check(status in('leased','sent','retry','expired','failed','uncertain')),
 lease uuid not null default gen_random_uuid(),leased_at timestamptz not null,attempts int not null default 1,
 next_attempt_at timestamptz,finished_at timestamptz,
 unique(subscription_id,local_date),unique(subscription_id,reading_id)
);
alter table public.ncg_push_subscriptions enable row level security;
alter table public.ncg_push_deliveries enable row level security;
revoke all on public.ncg_push_subscriptions,public.ncg_push_deliveries from anon,authenticated;
grant select(id,endpoint,local_time,time_zone,language,enabled,updated_at) on public.ncg_push_subscriptions to authenticated;
create policy own_push_read on public.ncg_push_subscriptions for select to authenticated using(user_id=auth.uid());

create function public.ncg_register_push(subscription jsonb,preferred_time time,preferred_zone text,preferred_language text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;owner uuid;begin
 if not public.ncg_active(auth.uid()) then raise exception 'not_authorized';end if;
 if coalesce(length(subscription->>'endpoint'),0) not between 20 and 2048 or coalesce(subscription->>'endpoint','') !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/[^[:space:]?#]+$' or coalesce(subscription->'keys'->>'p256dh','') !~ '^[A-Za-z0-9_-]{86,90}={0,2}$' or coalesce(subscription->'keys'->>'auth','') !~ '^[A-Za-z0-9_-]{22,24}={0,2}$' then raise exception 'invalid_subscription';end if;
 if preferred_time is null or preferred_zone is null or not exists(select 1 from pg_timezone_names where name=preferred_zone) or coalesce(preferred_language,'') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' then raise exception 'invalid_preferences';end if;
 -- Serialize the per-account device cap and prevent another account taking over this endpoint.
 perform 1 from auth.users where id=auth.uid() for update;
 select user_id into owner from public.ncg_push_subscriptions where endpoint=subscription->>'endpoint' for update;
 if owner is not null and owner<>auth.uid() then raise exception 'subscription_owned_by_another_account';end if;
 if owner is null and (select count(*) from public.ncg_push_subscriptions where user_id=auth.uid() and enabled)>=20 then raise exception 'device_limit';end if;
 insert into public.ncg_push_subscriptions(user_id,endpoint,p256dh,auth_key,local_time,time_zone,language)
 values(auth.uid(),subscription->>'endpoint',subscription->'keys'->>'p256dh',subscription->'keys'->>'auth',preferred_time,preferred_zone,preferred_language)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth_key=excluded.auth_key,local_time=excluded.local_time,time_zone=excluded.time_zone,language=excluded.language,enabled=true,updated_at=now()
 where ncg_push_subscriptions.user_id=auth.uid() returning id into result;
 if result is null then raise exception 'subscription_owned_by_another_account';end if;return result;
end;$$;
create function public.ncg_disable_push(subscription_id uuid) returns void language plpgsql security definer set search_path='' as $$begin
 update public.ncg_push_subscriptions set enabled=false,updated_at=now() where id=subscription_id and user_id=auth.uid();
 if not found then raise exception 'not_authorized';end if;
end;$$;

-- Only the trusted worker can claim due deliveries. A per-device/day AND per-device/reading key prevents duplicates.
create function public.ncg_claim_qt_push(batch_size int default 50,as_of timestamptz default now()) returns table(delivery_id uuid,lease_id uuid,subscription jsonb,language text,reading_date date,passage text,translations jsonb) language plpgsql security definer set search_path='' as $$
declare sub public.ncg_push_subscriptions;reading public.ncg_qt_readings;delivery public.ncg_push_deliveries;local_day date;local_now timestamp;counted int=0;begin
 select * into reading from public.ncg_qt_readings where date=(as_of at time zone 'Asia/Seoul')::date and status='published' and published_at<=as_of;
 if not found then return;end if;
 for sub in select s.* from public.ncg_push_subscriptions s where s.enabled and public.ncg_active(s.user_id)
  and (as_of at time zone s.time_zone)::time>=s.local_time
  and (as_of at time zone s.time_zone)<((as_of at time zone s.time_zone)::date+s.local_time+interval '3 hours')
  order by s.id for update of s skip locked
 loop
  local_now=as_of at time zone sub.time_zone;local_day=local_now::date;
  insert into public.ncg_push_deliveries(subscription_id,reading_id,local_date,status,leased_at)
   values(sub.id,reading.id,local_day,'leased',as_of) on conflict do nothing returning * into delivery;
  if not found then
   update public.ncg_push_deliveries set status='leased',lease=gen_random_uuid(),leased_at=as_of,attempts=attempts+1
   where subscription_id=sub.id and local_date=local_day and reading_id=reading.id and status='retry' and attempts<3 and next_attempt_at<=as_of returning * into delivery;
   if not found then continue;end if;
  end if;
  delivery_id=delivery.id;lease_id=delivery.lease;subscription=jsonb_build_object('endpoint',sub.endpoint,'keys',jsonb_build_object('p256dh',sub.p256dh,'auth',sub.auth_key));language=sub.language;reading_date=reading.date;passage=reading.passage;translations=reading.translations;
  return next;counted=counted+1;if counted>=greatest(1,least(batch_size,100)) then exit;end if;
 end loop;
end;$$;
create function public.ncg_finish_qt_push(delivery_id uuid,lease_id uuid,outcome text) returns void language plpgsql security definer set search_path='' as $$
declare done public.ncg_push_deliveries;begin
 if outcome not in('sent','retry','expired','failed','uncertain') then raise exception 'invalid_outcome';end if;
 update public.ncg_push_deliveries set status=case when outcome='retry' and attempts>=3 then 'failed' else outcome end,finished_at=now(),next_attempt_at=case when outcome='retry' then now()+interval '5 minutes' else null end
 where id=delivery_id and lease=lease_id and status='leased' returning * into done;
 if not found then raise exception 'stale_lease';end if;
 if outcome='expired' then update public.ncg_push_subscriptions set enabled=false,updated_at=now() where id=done.subscription_id;end if;
end;$$;
revoke all on function public.ncg_register_push(jsonb,time,text,text),public.ncg_disable_push(uuid),public.ncg_claim_qt_push(int,timestamptz),public.ncg_finish_qt_push(uuid,uuid,text) from public;
grant execute on function public.ncg_register_push(jsonb,time,text,text),public.ncg_disable_push(uuid) to authenticated;
grant execute on function public.ncg_claim_qt_push(int,timestamptz),public.ncg_finish_qt_push(uuid,uuid,text) to service_role;
