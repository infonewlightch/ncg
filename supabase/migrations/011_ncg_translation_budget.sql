-- Reserve translation requests transactionally. No text, tokens or IP addresses are stored.
create table public.ncg_translation_budget (
 kind text not null check(kind in ('bible','community')),
 day date not null,
 subject text not null,
 used integer not null default 0 check(used>=0 and used<=60),
 primary key(kind,day,subject)
);
alter table public.ncg_translation_budget enable row level security;
revoke all on public.ncg_translation_budget from public,anon,authenticated;
create function public.ncg_claim_translation_budget(kind text,legacy_floor integer default 0)
returns boolean language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'UTC')::date;total integer;personal integer;actor text;
begin
 if kind is null or kind not in ('bible','community') or legacy_floor is null or legacy_floor<0 or legacy_floor>60 or (kind='community' and legacy_floor<>0) then raise exception 'invalid_budget';end if;
 if kind='community' and auth.uid() is not null and not public.ncg_active(auth.uid()) then raise exception 'not_authorized';end if;
 -- Everyone locks the global row first. A failed member reservation never increments it.
 insert into public.ncg_translation_budget(kind,day,subject) values(kind,today,'global') on conflict do nothing;
 select b.used into total from public.ncg_translation_budget b where b.kind=ncg_claim_translation_budget.kind and b.day=today and b.subject='global' for update;
 total:=greatest(total,legacy_floor);
 update public.ncg_translation_budget b set used=total where b.kind=ncg_claim_translation_budget.kind and b.day=today and b.subject='global' and b.used<total;
 if total>=60 then return false;end if;
 if kind='community' then
  actor:=coalesce(auth.uid()::text,'guest');
  insert into public.ncg_translation_budget(kind,day,subject) values(kind,today,actor) on conflict do nothing;
  select b.used into personal from public.ncg_translation_budget b where b.kind=ncg_claim_translation_budget.kind and b.day=today and b.subject=actor for update;
  if personal>=20 then return false;end if;
  update public.ncg_translation_budget b set used=b.used+1 where b.kind=ncg_claim_translation_budget.kind and b.day=today and b.subject=actor;
 end if;
 update public.ncg_translation_budget b set used=total+1 where b.kind=ncg_claim_translation_budget.kind and b.day=today and b.subject='global';
 delete from public.ncg_translation_budget b where b.day<today-14;
 return true;
end;$$;
revoke all on function public.ncg_claim_translation_budget(text,integer) from public;
grant execute on function public.ncg_claim_translation_budget(text,integer) to anon,authenticated;
