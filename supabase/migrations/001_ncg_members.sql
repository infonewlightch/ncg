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
