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
