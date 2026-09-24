-- Daily QT needs only a date and canonical reading coordinates. Legacy editorial copies are retained.
create or replace function public.ncg_valid_qt_copy(value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare item record;begin
 if value is null or jsonb_typeof(value)<>'object' then return false;end if;
 for item in select * from jsonb_each(value) loop
  if item.key !~ '^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$' or jsonb_typeof(item.value)<>'object' then return false;end if;
  if coalesce(length(trim(item.value->>'title')),0) not between 1 and 160 or coalesce(length(trim(item.value->>'guide')),0) not between 1 and 5000 or coalesce(length(trim(item.value->>'question')),0) not between 1 and 1000 then return false;end if;
 end loop;return true;
end;$$;
alter table public.ncg_qt_readings add column passages text[] not null default '{}';
update public.ncg_qt_readings set passages=array[passage];

create function public.ncg_valid_qt_passages(value text[],first_passage text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare current_parts text[];previous_parts text[];piece text;maximum int;begin
 if value is null or cardinality(value) not between 1 and 10 or value[1] is distinct from first_passage then return false;end if;
 foreach piece in array value loop
  if not public.ncg_valid_passage(piece) then return false;end if;
  current_parts=regexp_match(piece,'^([A-Z0-9]{3})\.([0-9]+)\.([0-9]+)(?:-([0-9]+))?$');
  if previous_parts is not null then
   select chapters[previous_parts[2]::int] into maximum from public.ncg_reference_bounds where book=previous_parts[1];
   if current_parts[1]<>previous_parts[1] or current_parts[2]::int<>previous_parts[2]::int+1 or current_parts[3]::int<>1 or coalesce(previous_parts[4],previous_parts[3])::int<>maximum then return false;end if;
  end if;
  previous_parts=current_parts;
 end loop;return true;
end;$$;
revoke all on function public.ncg_valid_qt_passages(text[],text) from public;
grant execute on function public.ncg_valid_qt_passages(text[],text) to anon,authenticated;
alter table public.ncg_qt_readings add constraint ncg_qt_contiguous_passages check(public.ncg_valid_qt_passages(passages,passage));
grant select(passages) on public.ncg_qt_readings to anon,authenticated;

create or replace function public.ncg_guard_published_qt() returns trigger language plpgsql set search_path='' as $$begin
 if old.published_at is not null and (new.date<>old.date or new.passage<>old.passage or new.passages is distinct from old.passages or new.section<>old.section or new.part<>old.part or new.parts<>old.parts or new.published_at is distinct from old.published_at) then raise exception 'published_range_locked';end if;
 return new;
end;$$;
create or replace function public.ncg_save_qt_reading(document jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;new_status text;existing public.ncg_qt_readings;new_passages text[];first_passage text;begin
 if not public.ncg_is_admin() or not public.ncg_active(auth.uid()) then raise exception 'not_authorized';end if;
 if document is null or jsonb_typeof(document)<>'object' then raise exception 'invalid_qt';end if;
 new_status=coalesce(document->>'status','draft');
 select * into existing from public.ncg_qt_readings where date=(document->>'date')::date for update;
 first_passage=document->>'passage';
 new_passages=case when document ? 'passages' then array(select jsonb_array_elements_text(document->'passages')) else array[first_passage] end;
 if not public.ncg_valid_qt_passages(new_passages,first_passage) then raise exception 'invalid_qt_passages';end if;
 if existing.published_at is not null and (existing.passage is distinct from first_passage or existing.passages is distinct from new_passages) then raise exception 'published_range_locked';end if;
 insert into public.ncg_qt_readings(date,passage,passages,section,part,parts,translations,status,published_at,updated_by)
 values((document->>'date')::date,first_passage,new_passages,coalesce(document->>'section',case when existing.published_at is not null then existing.section else first_passage end),coalesce((document->>'part')::smallint,existing.part,1),coalesce((document->>'parts')::smallint,existing.parts,1),coalesce(document->'translations',existing.translations,'{}'::jsonb),new_status,case when new_status='published' then coalesce(existing.published_at,now()) else existing.published_at end,auth.uid())
 on conflict(date) do update set passage=excluded.passage,passages=excluded.passages,section=excluded.section,part=excluded.part,parts=excluded.parts,translations=excluded.translations,status=excluded.status,published_at=excluded.published_at,updated_at=now(),updated_by=auth.uid()
 returning id into result;
 insert into public.ncg_moderation_log(actor,action,target_id) values(auth.uid(),'qt_'||new_status,result);
 return result;
end;$$;
