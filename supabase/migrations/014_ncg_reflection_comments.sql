-- Comments share the reflection review, translation, reporting and blocking controls.
alter table public.ncg_posts add column parent_post_id uuid references public.ncg_posts(id);
create index ncg_post_comments on public.ncg_posts(parent_post_id,created_at,id) where parent_post_id is not null;
alter table public.ncg_posts add constraint ncg_comment_not_self check(parent_post_id is distinct from id);

create or replace function public.ncg_can_read_post(post uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ncg_posts p where p.id=post and (
  (public.ncg_is_admin() and (p.status='pending' or exists(select 1 from public.ncg_reports r where r.post_id=p.id)))
  or ((p.author_id=auth.uid() or (p.status='published' and public.ncg_active(p.author_id) and not public.ncg_blocked(p.author_id,auth.uid())))
   and (p.parent_post_id is null or exists(select 1 from public.ncg_posts parent where parent.id=p.parent_post_id and parent.parent_post_id is null and parent.status='published' and public.ncg_active(parent.author_id) and not public.ncg_blocked(parent.author_id,auth.uid()))))
  ));
$$;

create function public.ncg_create_comment(parent uuid,content text,source_language text,display_name text,country text) returns uuid language plpgsql security definer set search_path='' as $$
declare parent_row public.ncg_posts;result uuid;begin
 if not public.ncg_active(auth.uid()) then raise exception 'not_authorized';end if;
 select * into parent_row from public.ncg_posts where id=parent for share;
 if not found or parent_row.parent_post_id is not null or parent_row.status<>'published' or not public.ncg_active(parent_row.author_id) or not public.ncg_can_read_post(parent) then raise exception 'parent_unavailable';end if;
 result=public.ncg_create_post(content,source_language,'story',display_name,country,parent_row.topic_id);
 update public.ncg_posts set parent_post_id=parent where id=result;
 return result;
end;$$;

create or replace function public.ncg_feed(scope text default 'community',qt_id uuid default null,kind text default null,before_time timestamptz default null,before_id uuid default null)
 returns table(id uuid,body text,language text,author text,nationality text,category text,"createdAt" timestamptz,topic text,"authorId" uuid,status text,"prayerCount" bigint,"hasPrayed" boolean)
 language plpgsql stable security definer set search_path='' as $$begin
 if scope not in('community','qt','mine') or(scope='mine' and auth.uid() is null) then raise exception 'not_authorized';end if;
 return query select p.id,p.body,p.language,p.author,p.nationality,p.category,p.created_at,case when p.topic_id is not null then 'qt:'||p.topic_id::text end,p.author_id,p.status,
  (select count(*) from public.ncg_post_prayers pr where pr.post_id=p.id),exists(select 1 from public.ncg_post_prayers pr where pr.post_id=p.id and pr.user_id=auth.uid())
 from public.ncg_posts p where p.parent_post_id is null and public.ncg_can_read_post(p.id) and p.status<>'withdrawn'
  and ((scope='community' and p.topic_id is null) or(scope='qt' and p.topic_id=qt_id) or(scope='mine' and p.author_id=auth.uid()))
  and (p.status='published' or p.author_id=auth.uid()) and (kind is null or p.category=kind)
  and (before_time is null or (p.created_at,p.id)<(before_time,coalesce(before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
 order by p.created_at desc,p.id desc limit 30;
end;$$;

create function public.ncg_comments(parent uuid,before_time timestamptz default null,before_id uuid default null)
 returns table(id uuid,body text,language text,author text,nationality text,category text,"createdAt" timestamptz,topic text,"authorId" uuid,status text,"prayerCount" bigint,"hasPrayed" boolean)
 language plpgsql stable security definer set search_path='' as $$begin
 if not public.ncg_can_read_post(parent) or not exists(select 1 from public.ncg_posts p where p.id=parent and p.status='published' and p.parent_post_id is null and public.ncg_active(p.author_id)) then return;end if;
 return query select p.id,p.body,p.language,p.author,p.nationality,p.category,p.created_at,case when p.topic_id is not null then 'qt:'||p.topic_id::text end,p.author_id,p.status,
  (select count(*) from public.ncg_post_prayers pr where pr.post_id=p.id),exists(select 1 from public.ncg_post_prayers pr where pr.post_id=p.id and pr.user_id=auth.uid())
 from public.ncg_posts p where p.parent_post_id=parent and public.ncg_can_read_post(p.id) and p.status<>'withdrawn' and (p.status='published' or p.author_id=auth.uid())
  and (before_time is null or (p.created_at,p.id)<(before_time,coalesce(before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
 order by p.created_at desc,p.id desc limit 30;
end;$$;
revoke all on function public.ncg_create_comment(uuid,text,text,text,text),public.ncg_comments(uuid,timestamptz,uuid) from public;
grant execute on function public.ncg_create_comment(uuid,text,text,text,text) to authenticated;
grant execute on function public.ncg_comments(uuid,timestamptz,uuid) to anon,authenticated;
