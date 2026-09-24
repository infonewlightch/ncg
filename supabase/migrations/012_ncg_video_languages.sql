-- Track availability supplied by the church; audio selection remains in the YouTube player.
create function public.ncg_valid_video_languages(value text[]) returns boolean language sql immutable set search_path='' as $$
 select value is not null and cardinality(value)<=50 and not exists(select 1 from unnest(value) code where code is null or code !~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$') and cardinality(value)=(select count(distinct code) from unnest(value) code);
$$;
revoke all on function public.ncg_valid_video_languages(text[]) from public;
grant execute on function public.ncg_valid_video_languages(text[]) to anon,authenticated;
alter table public.ncg_videos add column audio_languages text[] not null default '{}' check(public.ncg_valid_video_languages(audio_languages)),add column caption_languages text[] not null default '{}' check(public.ncg_valid_video_languages(caption_languages));
-- The owner confirmed these nine audio/caption tracks for the currently published sermon.
update public.ncg_videos set audio_languages=array['ko','en','es','pt','zh','hi','ar','fa','th'],caption_languages=array['ko','en','es','pt','zh','hi','ar','fa','th'] where url='https://www.youtube.com/watch?v=4YFNv1Szab8' and status='published';

create or replace function public.ncg_save_video(video_id uuid,content jsonb,publish boolean,reviewed boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; old public.ncg_videos; address text; audio text[]; captions text[];
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
 audio:=case when content ? 'audio_languages' then array(select jsonb_array_elements_text(content->'audio_languages')) else coalesce(old.audio_languages,'{}') end;
 captions:=case when content ? 'caption_languages' then array(select jsonb_array_elements_text(content->'caption_languages')) else coalesce(old.caption_languages,'{}') end;
 if not public.ncg_valid_video_languages(audio) or not public.ncg_valid_video_languages(captions) then raise exception 'invalid_video_languages';end if;
 result:=coalesce(video_id,gen_random_uuid());
 insert into public.ncg_videos(id,title,description,url,language,category,speaker,scripture,recorded_on,status,published_at,audio_languages,caption_languages)
 values(result,trim(content->>'title'),coalesce(content->>'description',''),address,content->>'language',content->>'category',coalesce(content->>'speaker',''),coalesce(content->>'scripture',''),nullif(content->>'recorded_on','')::date,case when publish then 'published' else 'draft' end,case when publish then coalesce(old.published_at,now()) else old.published_at end,audio,captions)
 on conflict(id) do update set title=excluded.title,description=excluded.description,url=excluded.url,language=excluded.language,category=excluded.category,speaker=excluded.speaker,scripture=excluded.scripture,recorded_on=excluded.recorded_on,status=excluded.status,published_at=excluded.published_at,audio_languages=excluded.audio_languages,caption_languages=excluded.caption_languages,updated_at=now();
 insert into public.ncg_moderation_log(actor,action,target_id) values(auth.uid(),case when publish then 'video:published' else 'video:draft' end,result);
 return result;
end;$$;
revoke all on function public.ncg_save_video(uuid,jsonb,boolean,boolean) from public,anon;
grant execute on function public.ncg_save_video(uuid,jsonb,boolean,boolean) to authenticated;

create or replace function public.ncg_video_feed(kind text default null,source_language text default null,query text default '',before_time timestamptz default null,before_id uuid default null,saved uuid[] default null)
returns setof public.ncg_videos language plpgsql stable security invoker set search_path='' as $$
begin
 if length(query)>120 or (saved is not null and cardinality(saved)>100) then raise exception 'invalid_filter';end if;
 return query select v.* from public.ncg_videos v
 where v.status='published' and (kind is null or v.category=kind) and (source_language is null or exists(select 1 from unnest(array[v.language]||v.audio_languages||v.caption_languages) available where lower(split_part(available,'-',1))=lower(split_part(source_language,'-',1))))
 and (query='' or position(lower(query) in lower(v.title||' '||v.description||' '||v.speaker||' '||v.scripture))>0)
 and (before_time is null or (v.published_at,v.id)<(before_time,before_id))
 and (saved is null or v.id=any(saved)) order by v.published_at desc,v.id desc limit 24;
end;$$;
revoke all on function public.ncg_video_feed(text,text,text,timestamptz,uuid,uuid[]) from public;
grant execute on function public.ncg_video_feed(text,text,text,timestamptz,uuid,uuid[]) to anon,authenticated;
