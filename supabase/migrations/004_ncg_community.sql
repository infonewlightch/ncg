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
