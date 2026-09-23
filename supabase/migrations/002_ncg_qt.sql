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
