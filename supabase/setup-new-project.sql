-- Generated NCG setup for a NEW, empty NCG project only.
-- No user is granted administrator access. No content is published.
-- One transaction: an error rolls back the entire setup.
begin;
do $$begin if exists(select 1 from pg_tables where schemaname='public' and tablename like 'ncg_%') then raise exception 'NCG tables already exist. Apply reviewed incremental migrations instead.';end if;end;$$;

-- 001_ncg_members.sql
-- NCG-only project. Apply after review in the new Supabase SQL editor.
-- No admin role can be granted by browser metadata or an email comparison in UI.
create table public.ncg_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check (length(display_name)<=80),
 nationality text not null default '' check (length(nationality)<=80),
 language text not null default 'ko' check (language ~ '^[A-Za-z0-9-]{2,40}$'),
 friend_code text not null unique default substr(replace(gen_random_uuid()::text,'-',''),1,12),
 created_at timestamptz not null default now()
);
create table public.ncg_admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.ncg_suspensions (user_id uuid primary key references auth.users(id) on delete cascade,reason text not null default '',created_at timestamptz not null default now());
create table public.ncg_friends (
 id uuid primary key default gen_random_uuid(),sender uuid not null references public.ncg_profiles(id),recipient uuid not null references public.ncg_profiles(id),
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),check(sender<>recipient)
);
create unique index ncg_friend_pair on public.ncg_friends(least(sender,recipient),greatest(sender,recipient));
create table public.ncg_blocks (blocker uuid not null references public.ncg_profiles(id),blocked uuid not null references public.ncg_profiles(id),created_at timestamptz not null default now(),primary key(blocker,blocked),check(blocker<>blocked));
create table public.ncg_messages (
 id uuid primary key default gen_random_uuid(),sender uuid not null references public.ncg_profiles(id),recipient uuid not null references public.ncg_profiles(id),
 body text not null check(length(trim(body)) between 1 and 1500),language text not null check(language ~ '^[A-Za-z0-9-]{2,40}$'),
 status text not null default 'pending' check(status in ('published','pending','rejected')),created_at timestamptz not null default now(),check(sender<>recipient)
);
create index ncg_messages_pair on public.ncg_messages(sender,recipient,created_at desc);
create table public.ncg_reports (
 id uuid primary key default gen_random_uuid(),reporter uuid not null references auth.users(id),target_user uuid not null references auth.users(id),
 message_id uuid references public.ncg_messages(id),reason text not null check(length(reason) between 1 and 500),
 status text not null default 'open' check(status in ('open','resolved')),created_at timestamptz not null default now()
);
create table public.ncg_progress (user_id uuid primary key references auth.users(id) on delete cascade,completed text[] not null default '{}',bookmarks text[] not null default '{}',updated_at timestamptz not null default now());
create table public.ncg_moderation_log (id uuid primary key default gen_random_uuid(),actor uuid not null references auth.users(id),action text not null,target_id uuid not null,created_at timestamptz not null default now());

alter table public.ncg_profiles enable row level security;
alter table public.ncg_admins enable row level security;
alter table public.ncg_suspensions enable row level security;
alter table public.ncg_friends enable row level security;
alter table public.ncg_blocks enable row level security;
alter table public.ncg_messages enable row level security;
alter table public.ncg_reports enable row level security;
alter table public.ncg_progress enable row level security;
alter table public.ncg_moderation_log enable row level security;

create function public.ncg_is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.ncg_admins where user_id=auth.uid());$$;
create function public.ncg_active(person uuid) returns boolean language sql stable security definer set search_path='' as $$select person is not null and not exists(select 1 from public.ncg_suspensions where user_id=person);$$;
create function public.ncg_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.ncg_blocks where (blocker=a and blocked=b) or (blocker=b and blocked=a));$$;
create function public.ncg_can_chat(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$select public.ncg_active(a) and public.ncg_active(b) and not public.ncg_blocked(a,b) and exists(select 1 from public.ncg_friends where status='accepted' and ((sender=a and recipient=b) or(sender=b and recipient=a)));$$;

create policy profile_read on public.ncg_profiles for select to authenticated using(id=auth.uid() or public.ncg_is_admin() or (not public.ncg_blocked(id,auth.uid()) and exists(select 1 from public.ncg_friends f where (f.sender=auth.uid() and f.recipient=id) or(f.recipient=auth.uid() and f.sender=id))));
create policy own_profile_update on public.ncg_profiles for update to authenticated using(id=auth.uid() and public.ncg_active(auth.uid())) with check(id=auth.uid());
create policy friend_read on public.ncg_friends for select to authenticated using(auth.uid() in(sender,recipient));
create policy block_read on public.ncg_blocks for select to authenticated using(blocker=auth.uid());
create policy unblock on public.ncg_blocks for delete to authenticated using(blocker=auth.uid());
create policy message_read on public.ncg_messages for select to authenticated using((sender=auth.uid()) or (recipient=auth.uid() and status='published' and not public.ncg_blocked(sender,recipient)) or(public.ncg_is_admin() and(status='pending' or exists(select 1 from public.ncg_reports r where r.message_id=ncg_messages.id and r.status='open'))));
create policy report_read on public.ncg_reports for select to authenticated using(reporter=auth.uid() or public.ncg_is_admin());
create policy progress_read on public.ncg_progress for select to authenticated using(user_id=auth.uid());
create policy log_read on public.ncg_moderation_log for select to authenticated using(public.ncg_is_admin());

-- Explicit grants: direct writes to messages, friends, reports, roles are forbidden.
revoke all on public.ncg_profiles,public.ncg_admins,public.ncg_suspensions,public.ncg_friends,public.ncg_blocks,public.ncg_messages,public.ncg_reports,public.ncg_progress,public.ncg_moderation_log from anon,authenticated;
grant select on public.ncg_profiles,public.ncg_friends,public.ncg_blocks,public.ncg_messages,public.ncg_reports,public.ncg_progress,public.ncg_moderation_log to authenticated;
grant update(display_name,nationality,language) on public.ncg_profiles to authenticated;
grant delete on public.ncg_blocks to authenticated;

create function public.ncg_new_member() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.ncg_profiles(id) values(new.id);return new;end;$$;
create trigger ncg_after_signup after insert on auth.users for each row execute function public.ncg_new_member();
insert into public.ncg_profiles(id) select id from auth.users on conflict(id) do nothing;

create function public.ncg_find_friend(code text) returns setof public.ncg_profiles language plpgsql security definer set search_path='' as $$begin
 if not public.ncg_active(auth.uid()) then raise exception 'not_authorized';end if;
 return query select p.* from public.ncg_profiles p where p.friend_code=lower(trim(code)) and p.id<>auth.uid() and public.ncg_active(p.id) and not public.ncg_blocked(p.id,auth.uid()) limit 1;
end;$$;
create function public.ncg_request_friend(target uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.ncg_active(auth.uid()) or not public.ncg_active(target) or target=auth.uid() or public.ncg_blocked(auth.uid(),target) then raise exception 'contact_not_allowed';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if(select count(*) from public.ncg_friends where sender=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'rate_limited';end if;
 if exists(select 1 from public.ncg_friends where ((sender=auth.uid() and recipient=target)or(sender=target and recipient=auth.uid())) and status in('pending','accepted')) then raise exception 'request_exists';end if;
 delete from public.ncg_friends where status='declined' and ((sender=auth.uid() and recipient=target)or(sender=target and recipient=auth.uid()));
 insert into public.ncg_friends(sender,recipient) values(auth.uid(),target);
end;$$;
create function public.ncg_answer_friend(request_id uuid,accept boolean) returns void language plpgsql security definer set search_path='' as $$declare f public.ncg_friends;begin
 select * into f from public.ncg_friends where id=request_id and recipient=auth.uid() and status='pending' for update;
 if not found or not public.ncg_active(auth.uid()) or public.ncg_blocked(f.sender,f.recipient) then raise exception 'not_authorized';end if;
 update public.ncg_friends set status=case when accept then 'accepted' else 'declined' end where id=f.id;
end;$$;
create function public.ncg_block_user(target uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or auth.uid()=target then raise exception 'not_authorized';end if;
 insert into public.ncg_blocks(blocker,blocked) values(auth.uid(),target) on conflict do nothing;
 update public.ncg_friends set status='declined' where (sender=auth.uid() and recipient=target)or(sender=target and recipient=auth.uid());
end;$$;

-- Baseline filter. Not a claim of comprehensive multilingual contextual moderation.
-- Links and repetitive content are held for human review; unambiguous profanity is refused.
create function public.ncg_content_status(content text) returns text language sql immutable set search_path='' as $$select case
 when content ~* '(씨발|시발|개새끼|좆|\m(fuck|fucking|motherfucker)\M)' then 'rejected'
 when content ~* '(https?://|www\.|(.)\2{9})' then 'pending'
 else 'published' end;$$;
create function public.ncg_send_message(target uuid,content text,source_language text) returns public.ncg_messages language plpgsql security definer set search_path='' as $$declare result public.ncg_messages;visibility text;begin
 if not public.ncg_can_chat(auth.uid(),target) then raise exception 'contact_not_allowed';end if;
 if length(trim(content)) not between 1 and 1500 or source_language !~ '^[A-Za-z0-9-]{2,40}$' then raise exception 'invalid_content';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if exists(select 1 from public.ncg_messages where sender=auth.uid() and created_at>now()-interval '2 seconds') or(select count(*) from public.ncg_messages where sender=auth.uid() and created_at>now()-interval '1 minute')>=20 then raise exception 'rate_limited';end if;
 if exists(select 1 from public.ncg_messages where sender=auth.uid() and recipient=target and body=trim(content) and created_at>now()-interval '5 minutes') then raise exception 'duplicate_message';end if;
 visibility:=public.ncg_content_status(content);if visibility='rejected' then raise exception 'content_rejected';end if;
 insert into public.ncg_messages(sender,recipient,body,language,status) values(auth.uid(),target,trim(content),source_language,visibility) returning * into result;
 return result;
end;$$;
create function public.ncg_report(target uuid,message uuid,details text) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.ncg_active(auth.uid()) or target=auth.uid() then raise exception 'not_authorized';end if;
 if length(trim(details)) not between 1 and 500 then raise exception 'invalid_report';end if;
 if message is not null and not exists(select 1 from public.ncg_messages where id=message and sender=target and recipient=auth.uid()) then raise exception 'not_authorized';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if(select count(*) from public.ncg_reports where reporter=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'rate_limited';end if;
 insert into public.ncg_reports(reporter,target_user,message_id,reason) values(auth.uid(),target,message,trim(details));
end;$$;
create function public.ncg_save_progress(lessons text[],saved text[]) returns public.ncg_progress language plpgsql security definer set search_path='' as $$declare result public.ncg_progress;begin
 if not public.ncg_active(auth.uid()) or cardinality(lessons)>5000 or cardinality(saved)>5000 then raise exception 'not_authorized';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 insert into public.ncg_progress(user_id) values(auth.uid()) on conflict do nothing;
 update public.ncg_progress set completed=array(select distinct x from unnest(completed||lessons) x where x is not null),bookmarks=array(select distinct x from unnest(bookmarks||saved) x where x is not null),updated_at=now() where user_id=auth.uid() returning * into result;
 return result;
end;$$;

create function public.ncg_review_message(message uuid,decision text) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.ncg_is_admin() or decision not in('published','rejected') then raise exception 'not_authorized';end if;
 update public.ncg_messages set status=decision where id=message;
 insert into public.ncg_moderation_log(actor,action,target_id) values(auth.uid(),'message:'||decision,message);
end;$$;
create function public.ncg_resolve_report(report uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.ncg_is_admin() then raise exception 'not_authorized';end if;
 update public.ncg_reports set status='resolved' where id=report;
 insert into public.ncg_moderation_log(actor,action,target_id) values(auth.uid(),'report:resolved',report);
end;$$;
create function public.ncg_suspend_user(target uuid,reason text,suspend boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.ncg_is_admin() or target=auth.uid() or exists(select 1 from public.ncg_admins where user_id=target) then raise exception 'not_authorized';end if;
 if suspend then insert into public.ncg_suspensions(user_id,reason) values(target,left(reason,500)) on conflict(user_id) do update set reason=excluded.reason;else delete from public.ncg_suspensions where user_id=target;end if;
 insert into public.ncg_moderation_log(actor,action,target_id) values(auth.uid(),case when suspend then 'user:suspended' else 'user:restored' end,target);
end;$$;

-- Remove PostgreSQL's default PUBLIC execute grant for every NCG function.
do $$declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ncg_%' loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);end loop;end;$$;
grant execute on function public.ncg_is_admin(),public.ncg_active(uuid),public.ncg_blocked(uuid,uuid),public.ncg_can_chat(uuid,uuid) to authenticated;
grant execute on function public.ncg_find_friend(text),public.ncg_request_friend(uuid),public.ncg_answer_friend(uuid,boolean),public.ncg_block_user(uuid),public.ncg_send_message(uuid,text,text),public.ncg_report(uuid,uuid,text),public.ncg_save_progress(text[],text[]),public.ncg_review_message(uuid,text),public.ncg_resolve_report(uuid),public.ncg_suspend_user(uuid,text,boolean) to authenticated;


-- 002_ncg_qt.sql
-- Shared QT publication. No Scripture text is stored here: only canonical ranges and editorial guides.
create function public.ncg_valid_passage(value text) returns boolean language plpgsql immutable set search_path='' as $$
declare p text[];begin
 p=regexp_match(value,'^([A-Z0-9]{3})\.([1-9][0-9]{0,2})\.([1-9][0-9]{0,2})(?:-([1-9][0-9]{0,2}))?$');
 return p is not null and p[1]=any(array['GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZK','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL','MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV']) and coalesce(p[4],p[3])::int>=p[3]::int;
end;$$;
create function public.ncg_valid_qt_copy(value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare item record;begin
 if value is null or jsonb_typeof(value)<>'object' or value='{}'::jsonb then return false;end if;
 for item in select * from jsonb_each(value) loop
  if item.key !~ '^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$' or jsonb_typeof(item.value)<>'object' then return false;end if;
  if coalesce(length(trim(item.value->>'title')),0) not between 1 and 160 or coalesce(length(trim(item.value->>'guide')),0) not between 1 and 5000 or coalesce(length(trim(item.value->>'question')),0) not between 1 and 1000 then return false;end if;
 end loop;return true;
end;$$;
create table public.ncg_qt_readings(
 id uuid primary key default gen_random_uuid(),date date not null unique,
 passage text not null check(public.ncg_valid_passage(passage)),section text not null check(public.ncg_valid_passage(section)),
 part smallint not null default 1,parts smallint not null default 1,check(part between 1 and parts and parts<=30),
 translations jsonb not null check(public.ncg_valid_qt_copy(translations)),
 status text not null default 'draft' check(status in('draft','published')),
 published_at timestamptz,updated_at timestamptz not null default now(),updated_by uuid not null references auth.users(id),
 check(status<>'published' or published_at is not null)
);
alter table public.ncg_qt_readings enable row level security;
revoke all on public.ncg_qt_readings from anon,authenticated;
grant select(id,date,passage,section,part,parts,translations,status,published_at,updated_at) on public.ncg_qt_readings to anon,authenticated;
create policy qt_public_read on public.ncg_qt_readings for select to anon,authenticated using((status='published' and published_at<=now()) or public.ncg_is_admin());

create function public.ncg_save_qt_reading(document jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;new_status text;existing public.ncg_qt_readings;begin
 if not public.ncg_is_admin() or not public.ncg_active(auth.uid()) then raise exception 'not_authorized';end if;
 new_status=coalesce(document->>'status','draft');
 select * into existing from public.ncg_qt_readings where date=(document->>'date')::date for update;
 -- Once shared, a day's canonical range stays stable; editing guides never splits the worldwide discussion.
 if existing.status='published' and (existing.passage<>document->>'passage' or existing.section<>document->>'section' or existing.part<>(document->>'part')::smallint or existing.parts<>(document->>'parts')::smallint) then raise exception 'published_range_locked';end if;
 insert into public.ncg_qt_readings(date,passage,section,part,parts,translations,status,published_at,updated_by)
 values((document->>'date')::date,document->>'passage',document->>'section',(document->>'part')::smallint,(document->>'parts')::smallint,document->'translations',new_status,case when new_status='published' then coalesce(existing.published_at,now()) else existing.published_at end,auth.uid())
 on conflict(date) do update set passage=excluded.passage,section=excluded.section,part=excluded.part,parts=excluded.parts,translations=excluded.translations,status=excluded.status,published_at=excluded.published_at,updated_at=now(),updated_by=auth.uid()
 returning id into result;
 insert into public.ncg_moderation_log(actor,action,target_id) values(auth.uid(),'qt_'||new_status,result);
 return result;
end;$$;
revoke all on function public.ncg_valid_passage(text),public.ncg_valid_qt_copy(jsonb),public.ncg_save_qt_reading(jsonb) from public;
grant execute on function public.ncg_valid_passage(text),public.ncg_valid_qt_copy(jsonb) to anon,authenticated;
grant execute on function public.ncg_save_qt_reading(jsonb) to authenticated;
-- ncg_is_admin returns only a Boolean for the current identity, including unauthenticated readers.
grant execute on function public.ncg_is_admin() to anon;

create function public.ncg_guard_published_qt() returns trigger language plpgsql set search_path='' as $$begin
 if old.published_at is not null and (new.date<>old.date or new.passage<>old.passage or new.section<>old.section or new.part<>old.part or new.parts<>old.parts or new.published_at is distinct from old.published_at) then raise exception 'published_range_locked';end if;
 return new;
end;$$;
create trigger ncg_qt_lock_shared_range before update on public.ncg_qt_readings for each row execute function public.ncg_guard_published_qt();
revoke all on function public.ncg_guard_published_qt() from public;


-- 003_ncg_push.sql
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


-- 004_ncg_community.sql
-- Global reflections. Every public submission starts in a human-review queue.
create table public.ncg_posts(
 id uuid primary key default gen_random_uuid(),author_id uuid not null references public.ncg_profiles(id),
 author text not null check(length(trim(author)) between 1 and 80),nationality text not null check(length(trim(nationality)) between 1 and 80),
 body text not null check(length(trim(body)) between 1 and 1500),language text not null check(language ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'),
 category text not null check(category in('prayer','story')),topic_id uuid references public.ncg_qt_readings(id),
 status text not null default 'pending' check(status in('pending','published','rejected','withdrawn')),created_at timestamptz not null default now()
);
create index ncg_posts_feed on public.ncg_posts(topic_id,created_at desc,id desc) where status='published';
create table public.ncg_post_prayers(post_id uuid not null references public.ncg_posts(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(post_id,user_id));
alter table public.ncg_reports add column post_id uuid references public.ncg_posts(id);
alter table public.ncg_reports add constraint ncg_report_one_item check(message_id is null or post_id is null);
alter table public.ncg_posts enable row level security;
alter table public.ncg_post_prayers enable row level security;
revoke all on public.ncg_posts,public.ncg_post_prayers from anon,authenticated;

create function public.ncg_can_read_post(post uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ncg_posts p where p.id=post and (p.author_id=auth.uid() or (p.status='published' and public.ncg_active(p.author_id) and not public.ncg_blocked(p.author_id,auth.uid())) or(public.ncg_is_admin() and(p.status='pending' or exists(select 1 from public.ncg_reports r where r.post_id=p.id)))));
$$;
create policy community_read on public.ncg_posts for select to anon,authenticated using(public.ncg_can_read_post(id));
grant select on public.ncg_posts to anon,authenticated;

create function public.ncg_create_post(content text,source_language text,kind text,display_name text,country text,qt_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin
 if not public.ncg_active(auth.uid()) then raise exception 'not_authorized';end if;
 if coalesce(length(trim(content)),0) not between 1 and 1500 or coalesce(length(trim(display_name)),0) not between 1 and 80 or coalesce(length(trim(country)),0) not between 1 and 80 or coalesce(source_language,'') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' or kind not in('prayer','story') then raise exception 'invalid_content';end if;
 if qt_id is not null and not exists(select 1 from public.ncg_qt_readings where id=qt_id and status='published' and published_at<=now()) then raise exception 'qt_not_published';end if;
 if public.ncg_content_status(content)='rejected' then raise exception 'content_rejected';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if (select count(*) from public.ncg_posts where author_id=auth.uid() and created_at>now()-interval '1 hour')>=10 or exists(select 1 from public.ncg_posts where author_id=auth.uid() and created_at>now()-interval '15 seconds') then raise exception 'rate_limited';end if;
 if exists(select 1 from public.ncg_posts where author_id=auth.uid() and body=trim(content) and created_at>now()-interval '1 day') then raise exception 'duplicate_post';end if;
 update public.ncg_profiles set display_name=trim(ncg_create_post.display_name),nationality=trim(country),language=source_language where id=auth.uid();
 insert into public.ncg_posts(author_id,author,nationality,body,language,category,topic_id,status) values(auth.uid(),trim(display_name),trim(country),trim(content),source_language,kind,qt_id,'pending') returning id into result;return result;
end;$$;
create function public.ncg_feed(scope text default 'community',qt_id uuid default null,kind text default null,before_time timestamptz default null,before_id uuid default null)
 returns table(id uuid,body text,language text,author text,nationality text,category text,"createdAt" timestamptz,topic text,"authorId" uuid,status text,"prayerCount" bigint,"hasPrayed" boolean)
 language plpgsql stable security definer set search_path='' as $$begin
 if scope not in('community','qt','mine') or(scope='mine' and auth.uid() is null) then raise exception 'not_authorized';end if;
 return query select p.id,p.body,p.language,p.author,p.nationality,p.category,p.created_at,case when p.topic_id is not null then 'qt:'||p.topic_id::text end,p.author_id,p.status,
  (select count(*) from public.ncg_post_prayers pr where pr.post_id=p.id),exists(select 1 from public.ncg_post_prayers pr where pr.post_id=p.id and pr.user_id=auth.uid())
 from public.ncg_posts p where public.ncg_can_read_post(p.id) and p.status<>'withdrawn'
  and ((scope='community' and p.topic_id is null) or(scope='qt' and p.topic_id=qt_id) or(scope='mine' and p.author_id=auth.uid()))
  and (p.status='published' or p.author_id=auth.uid()) and (kind is null or p.category=kind)
  and (before_time is null or (p.created_at,p.id)<(before_time,coalesce(before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
 order by p.created_at desc,p.id desc limit 30;
end;$$;
create function public.ncg_pray_for_post(post uuid,prayed boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.ncg_active(auth.uid()) or not public.ncg_can_read_post(post) or not exists(select 1 from public.ncg_posts where id=post and status='published') then raise exception 'not_authorized';end if;
 if prayed then insert into public.ncg_post_prayers(post_id,user_id) values(post,auth.uid()) on conflict do nothing;else delete from public.ncg_post_prayers where post_id=post and user_id=auth.uid();end if;
end;$$;
create function public.ncg_report_post(post uuid,details text) returns void language plpgsql security definer set search_path='' as $$declare item public.ncg_posts;begin
 if not public.ncg_active(auth.uid()) or not public.ncg_can_read_post(post) then raise exception 'not_authorized';end if;
 select * into item from public.ncg_posts where id=post;
 if not found or item.author_id=auth.uid() or coalesce(length(trim(details)),0) not between 1 and 500 then raise exception 'invalid_report';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if(select count(*) from public.ncg_reports where reporter=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'rate_limited';end if;
 if exists(select 1 from public.ncg_reports where reporter=auth.uid() and post_id=post and status='open') then return;end if;
 insert into public.ncg_reports(reporter,target_user,post_id,reason) values(auth.uid(),item.author_id,post,trim(details));
end;$$;
create function public.ncg_review_post(post uuid,decision text) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.ncg_is_admin() or not public.ncg_active(auth.uid()) or decision not in('published','rejected') then raise exception 'not_authorized';end if;
 update public.ncg_posts set status=decision where id=post and status<>'withdrawn';if not found then raise exception 'post_unavailable';end if;
 insert into public.ncg_moderation_log(actor,action,target_id) values(auth.uid(),'post:'||decision,post);
end;$$;
create function public.ncg_withdraw_post(post uuid) returns void language plpgsql security definer set search_path='' as $$begin
 update public.ncg_posts set status='withdrawn' where id=post and author_id=auth.uid();if not found then raise exception 'not_authorized';end if;
end;$$;
revoke all on function public.ncg_can_read_post(uuid),public.ncg_create_post(text,text,text,text,text,uuid),public.ncg_feed(text,uuid,text,timestamptz,uuid),public.ncg_pray_for_post(uuid,boolean),public.ncg_report_post(uuid,text),public.ncg_review_post(uuid,text),public.ncg_withdraw_post(uuid) from public;
grant execute on function public.ncg_can_read_post(uuid),public.ncg_feed(text,uuid,text,timestamptz,uuid) to anon,authenticated;
grant execute on function public.ncg_create_post(text,text,text,text,text,uuid),public.ncg_pray_for_post(uuid,boolean),public.ncg_report_post(uuid,text),public.ncg_review_post(uuid,text),public.ncg_withdraw_post(uuid) to authenticated;

-- Helpers exposed for RLS may only reveal the caller's own relationship, not arbitrary member pairs.
create or replace function public.ncg_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$select coalesce(auth.uid() in(a,b),false) and exists(select 1 from public.ncg_blocks where(blocker=a and blocked=b) or(blocker=b and blocked=a));$$;
create or replace function public.ncg_can_chat(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$select coalesce(auth.uid() in(a,b),false) and public.ncg_active(a) and public.ncg_active(b) and not public.ncg_blocked(a,b) and exists(select 1 from public.ncg_friends where status='accepted' and((sender=a and recipient=b) or(sender=b and recipient=a)));$$;


-- 005_ncg_progress.sql
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


-- 006_ncg_videos.sql
create table public.ncg_videos (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 1 and 160),
 description text not null default '' check(length(description)<=2000),
 url text not null check(length(url)<=2000),
 language text not null check(language ~ '^[A-Za-z0-9-]{2,40}$'),
 category text not null check(category in('sermon','worship')),
 speaker text not null default '' check(length(speaker)<=100),
 scripture text not null default '' check(length(scripture)<=200),
 recorded_on date,
 status text not null default 'draft' check(status in('draft','published')),
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(status='draft' or published_at is not null)
);
create index ncg_videos_public on public.ncg_videos(published_at desc,id desc) where status='published';
alter table public.ncg_videos enable row level security;
revoke all on public.ncg_videos from public,anon,authenticated;
grant select on public.ncg_videos to anon,authenticated;
create policy ncg_video_published on public.ncg_videos for select to anon,authenticated using(status='published');
create policy ncg_video_admin on public.ncg_videos for select to authenticated using(public.ncg_is_admin());

create function public.ncg_save_video(video_id uuid,content jsonb,publish boolean,reviewed boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; old public.ncg_videos; address text;
begin
 if not public.ncg_is_admin() then raise exception 'not_authorized';end if;
 if content is null or jsonb_typeof(content)<>'object' or publish is null or (publish and reviewed is not true) then raise exception 'review_required';end if;
 address:=content->>'url';
 -- Canonical YouTube links or HTTPS MP4/WebM files only; no credentials, ports, or scripts.
 if address is null or length(address)>2000 or not(
  address ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$'
  or address ~* '^https://[A-Za-z0-9.-]+/[^#[:space:]]+\.(mp4|webm)(\?[^#[:space:]]*)?$'
 ) then raise exception 'invalid_video_url';end if;
 if nullif(trim(content->>'title'),'') is null or nullif(content->>'language','') is null or (content->>'category') not in('sermon','worship') then raise exception 'invalid_video';end if;
 if video_id is not null then select * into old from public.ncg_videos where id=video_id for update;if not found then raise exception 'video_not_found';end if;end if;
 result:=coalesce(video_id,gen_random_uuid());
 insert into public.ncg_videos(id,title,description,url,language,category,speaker,scripture,recorded_on,status,published_at)
 values(result,trim(content->>'title'),coalesce(content->>'description',''),address,content->>'language',content->>'category',coalesce(content->>'speaker',''),coalesce(content->>'scripture',''),nullif(content->>'recorded_on','')::date,case when publish then 'published' else 'draft' end,case when publish then coalesce(old.published_at,now()) else old.published_at end)
 on conflict(id) do update set title=excluded.title,description=excluded.description,url=excluded.url,language=excluded.language,category=excluded.category,speaker=excluded.speaker,scripture=excluded.scripture,recorded_on=excluded.recorded_on,status=excluded.status,published_at=excluded.published_at,updated_at=now();
 insert into public.ncg_moderation_log(actor,action,target_id) values(auth.uid(),case when publish then 'video:published' else 'video:draft' end,result);
 return result;
end;$$;
revoke all on function public.ncg_save_video(uuid,jsonb,boolean,boolean) from public,anon;
grant execute on function public.ncg_save_video(uuid,jsonb,boolean,boolean) to authenticated;

create function public.ncg_video_feed(kind text default null,source_language text default null,query text default '',before_time timestamptz default null,before_id uuid default null,saved uuid[] default null)
returns setof public.ncg_videos language plpgsql stable security invoker set search_path='' as $$
begin
 if length(query)>120 or (saved is not null and cardinality(saved)>100) then raise exception 'invalid_filter';end if;
 return query select v.* from public.ncg_videos v
 where v.status='published' and (kind is null or v.category=kind) and (source_language is null or lower(v.language) in(lower(source_language),lower(split_part(source_language,'-',1))))
 and (query='' or position(lower(query) in lower(v.title||' '||v.description||' '||v.speaker||' '||v.scripture))>0)
 and (before_time is null or (v.published_at,v.id)<(before_time,before_id))
 and (saved is null or v.id=any(saved)) order by v.published_at desc,v.id desc limit 24;
end;$$;
revoke all on function public.ncg_video_feed(text,text,text,timestamptz,uuid,uuid[]) from public;
grant execute on function public.ncg_video_feed(text,text,text,timestamptz,uuid,uuid[]) to anon,authenticated;


-- 007_ncg_qt_bounds.sql
-- Generated by scripts/build-qt-bounds.mjs from the imported WEBP canonical reference index.
-- This validates NCG shared reading coordinates; it does not change publisher verse numbering.
create table public.ncg_reference_bounds(book text primary key,chapters smallint[] not null);
alter table public.ncg_reference_bounds enable row level security;
revoke all on public.ncg_reference_bounds from public,anon,authenticated;
insert into public.ncg_reference_bounds(book,chapters) values
('GEN',ARRAY[31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26]),
('EXO',ARRAY[22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38]),
('LEV',ARRAY[17,16,17,35,19,30,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34]),
('NUM',ARRAY[54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13]),
('DEU',ARRAY[46,37,29,49,33,25,26,20,29,22,32,32,18,29,23,22,20,22,21,20,23,30,25,22,19,19,26,68,29,20,30,52,29,12]),
('JOS',ARRAY[18,24,17,24,15,27,26,35,27,43,23,24,33,15,63,10,18,28,51,9,45,34,16,33]),
('JDG',ARRAY[36,23,31,24,31,40,25,35,57,18,40,15,25,20,20,31,13,31,30,48,25]),
('RUT',ARRAY[22,23,18,22]),
('1SA',ARRAY[28,36,21,22,12,21,17,22,27,27,15,25,23,52,35,23,58,30,24,42,15,23,29,22,44,25,12,25,11,31,13]),
('2SA',ARRAY[27,32,39,12,25,23,29,18,13,19,27,31,39,33,37,23,29,33,43,26,22,51,39,25]),
('1KI',ARRAY[53,46,28,34,18,38,51,66,28,29,43,33,34,31,34,34,24,46,21,43,29,53]),
('2KI',ARRAY[18,25,27,44,27,33,20,29,37,36,21,21,25,29,38,20,41,37,37,21,26,20,37,20,30]),
('1CH',ARRAY[54,55,24,43,26,81,40,40,44,14,47,40,14,17,29,43,27,17,19,8,30,19,32,31,31,32,34,21,30]),
('2CH',ARRAY[17,18,17,22,14,42,22,18,31,19,23,16,22,15,19,14,19,34,11,37,20,12,21,27,28,23,9,27,36,27,21,33,25,33,27,23]),
('EZR',ARRAY[11,70,13,24,17,22,28,36,15,44]),
('NEH',ARRAY[11,20,32,23,19,19,73,18,38,39,36,47,31]),
('EST',ARRAY[22,23,15,17,14,14,10,17,32,3]),
('JOB',ARRAY[22,13,26,21,27,30,21,22,35,22,20,25,28,22,35,22,16,21,29,29,34,30,17,25,6,14,23,28,25,31,40,22,33,37,16,33,24,41,30,24,34,17]),
('PSA',ARRAY[6,12,8,8,12,10,17,9,20,18,7,8,6,7,5,11,15,50,14,9,13,31,6,10,22,12,14,9,11,12,24,11,22,22,28,12,40,22,13,17,13,11,5,26,17,11,9,14,20,23,19,9,6,7,23,13,11,11,17,12,8,12,11,10,13,20,7,35,36,5,24,20,28,23,10,12,20,72,13,19,16,8,18,12,13,17,7,18,52,17,16,15,5,23,11,13,12,9,9,5,8,28,22,35,45,48,43,13,31,7,10,10,9,8,18,19,2,29,176,7,8,9,4,8,5,6,5,6,8,8,3,18,3,3,21,26,9,8,24,13,10,7,12,15,21,10,20,14,9,6]),
('PRO',ARRAY[33,22,35,27,23,35,27,36,18,32,31,28,25,35,33,33,28,24,29,30,31,29,35,34,28,28,27,28,27,33,31]),
('ECC',ARRAY[18,26,22,16,20,12,29,17,18,20,10,14]),
('SNG',ARRAY[17,17,11,16,16,13,13,14]),
('ISA',ARRAY[31,22,26,6,30,13,25,22,21,34,16,6,22,32,9,14,14,7,25,6,17,25,18,23,12,21,13,29,24,33,9,20,24,17,10,22,38,22,8,31,29,25,28,28,25,13,15,22,26,11,23,15,12,17,13,12,21,14,21,22,11,12,19,12,25,24]),
('JER',ARRAY[19,37,25,31,31,30,34,22,26,25,23,17,27,22,21,21,27,23,15,18,14,30,40,10,38,24,22,17,32,24,40,44,26,22,19,32,21,28,18,16,18,22,13,30,5,28,7,47,39,46,64,34]),
('LAM',ARRAY[22,22,66,22,22]),
('EZK',ARRAY[28,10,27,17,17,14,27,18,11,22,25,28,23,23,8,63,24,32,14,49,32,31,49,27,17,21,36,26,21,26,18,32,33,31,15,38,28,23,29,49,26,20,27,31,25,24,23,35]),
('DAN',ARRAY[21,49,30,37,31,28,28,27,27,21,45,13]),
('HOS',ARRAY[11,23,5,19,15,11,16,14,17,15,12,14,16,9]),
('JOL',ARRAY[20,32,21]),
('AMO',ARRAY[15,16,15,13,27,14,17,14,15]),
('OBA',ARRAY[21]),
('JON',ARRAY[17,10,10,11]),
('MIC',ARRAY[16,13,12,13,15,16,20]),
('NAM',ARRAY[15,13,19]),
('HAB',ARRAY[17,20,19]),
('ZEP',ARRAY[18,15,20]),
('HAG',ARRAY[15,23]),
('ZEC',ARRAY[21,13,10,14,11,15,14,23,17,12,17,14,9,21]),
('MAL',ARRAY[14,17,18,6]),
('MAT',ARRAY[25,23,17,25,48,34,29,34,38,42,30,50,58,36,39,28,27,35,30,34,46,46,39,51,46,75,66,20]),
('MRK',ARRAY[45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20]),
('LUK',ARRAY[80,52,38,44,39,49,50,56,62,42,54,59,35,35,32,31,37,43,48,47,38,71,56,53]),
('JHN',ARRAY[51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25]),
('ACT',ARRAY[26,47,26,37,42,15,60,40,43,48,30,25,52,28,41,40,34,28,41,38,40,30,35,27,27,32,44,31]),
('ROM',ARRAY[32,29,31,25,21,23,25,39,33,21,36,21,14,26,33,25]),
('1CO',ARRAY[31,16,23,21,13,20,40,13,27,33,34,31,13,40,58,24]),
('2CO',ARRAY[24,17,18,18,21,18,16,24,15,18,33,21,14]),
('GAL',ARRAY[24,21,29,31,26,18]),
('EPH',ARRAY[23,22,21,32,33,24]),
('PHP',ARRAY[30,30,21,23]),
('COL',ARRAY[29,23,25,18]),
('1TH',ARRAY[10,20,13,18,28]),
('2TH',ARRAY[12,17,18]),
('1TI',ARRAY[20,15,16,16,25,21]),
('2TI',ARRAY[18,26,17,22]),
('TIT',ARRAY[16,15,15]),
('PHM',ARRAY[25]),
('HEB',ARRAY[14,18,19,16,14,20,28,13,28,39,40,29,25]),
('JAS',ARRAY[27,26,18,17,20]),
('1PE',ARRAY[25,25,22,19,14]),
('2PE',ARRAY[21,22,18]),
('1JN',ARRAY[10,29,24,21,21]),
('2JN',ARRAY[13]),
('3JN',ARRAY[14]),
('JUD',ARRAY[25]),
('REV',ARRAY[20,29,22,11,14,17,17,13,21,11,19,17,18,20,8,21,18,24,21,15,27,21]);

create or replace function public.ncg_valid_passage(value text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare p text[];maximum int;begin
 p=regexp_match(value,'^([A-Z0-9]{3})\.([1-9][0-9]{0,2})\.([1-9][0-9]{0,2})(?:-([1-9][0-9]{0,2}))?$');
 if p is null then return false;end if;
 select chapters[p[2]::int] into maximum from public.ncg_reference_bounds where book=p[1];
 return coalesce(maximum is not null and p[3]::int<=maximum and coalesce(p[4],p[3])::int between p[3]::int and maximum,false);
end;$$;
create function public.ncg_passage_in_section(passage text,section text,part int,parts int) returns boolean language plpgsql stable set search_path='' as $$
declare p text[];s text[];begin
 if not public.ncg_valid_passage(passage) or not public.ncg_valid_passage(section) then return false;end if;
 p=regexp_match(passage,'^([A-Z0-9]{3})\.([0-9]+)\.([0-9]+)(?:-([0-9]+))?$');
 s=regexp_match(section,'^([A-Z0-9]{3})\.([0-9]+)\.([0-9]+)(?:-([0-9]+))?$');
 return p[1]=s[1] and p[2]=s[2] and p[3]::int>=s[3]::int and coalesce(p[4],p[3])::int<=coalesce(s[4],s[3])::int
 and (part<>1 or p[3]=s[3]) and (part<>parts or coalesce(p[4],p[3])=coalesce(s[4],s[3]));
end;$$;
revoke all on function public.ncg_passage_in_section(text,text,int,int) from public;
grant execute on function public.ncg_passage_in_section(text,text,int,int) to anon,authenticated;
alter table public.ncg_qt_readings add constraint ncg_qt_section_contains_passage check(public.ncg_passage_in_section(passage,section,part,parts));


-- 008_ncg_bible_bookmarks.sql
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


-- 009_ncg_quiz_progress.sql
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


-- 010_ncg_video_bookmarks.sql
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

create table public.ncg_schema_migrations(name text primary key,sha256 text not null,applied_at timestamptz not null default now());
alter table public.ncg_schema_migrations enable row level security;
revoke all on public.ncg_schema_migrations from public,anon,authenticated;
insert into public.ncg_schema_migrations(name,sha256) values
('001_ncg_members.sql','bfcad2c07e74d6b35d0e66c302b2ba96e822f3c9860292eab7211e229395c921'),
('002_ncg_qt.sql','ba7f6e8fbc38d12c75312d21dbd536e34eb06f18d8728c9f179f68a6304fbf7d'),
('003_ncg_push.sql','9686d19d12f52ddc5940051814fb614c27cb4078bbd85aa944ceaf49571ef397'),
('004_ncg_community.sql','45e24a867b53706bdca76734b81699fc276d3da85976535cb8a91390bf5702c4'),
('005_ncg_progress.sql','cb02bbfc3337e465504014ed1aedcce3da3dbae0d623dee0a30319b096d950eb'),
('006_ncg_videos.sql','7a51a659917ee92d001a106f29b9cb3135f0042306da3694760a49c4d0acf284'),
('007_ncg_qt_bounds.sql','c7ddfad977640f63a1b465f0200c0bcb45d2a64ef7cee1d4f0471eaee4be05ab'),
('008_ncg_bible_bookmarks.sql','1b215027bf7c84cf5d5df1242276251450d47dd8576bb03ca7b376ffb2835212'),
('009_ncg_quiz_progress.sql','4038eb4e21f406b4e3d9d0a92ddd6152df132bd56953f87e26ea7b82e69b2db0'),
('010_ncg_video_bookmarks.sql','75ac5935c3514dff950f0a8622d8cd46e1c5756c8feb5d9a9fecff4b3e57f9d5');
commit;
