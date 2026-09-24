-- Run only in the NCG project yndtcpsajhmnyeqeozju after owner approval.
-- Verified in Supabase Auth on 2026-09-24; only this confirmed identity qualifies.
begin;

do $$
begin
  if not exists (
    select 1 from auth.users
    where id = '088029d7-79ef-4c53-ad78-83f63f9a059a'::uuid
      and lower(email) = 'infonewlightch@gmail.com'
      and email_confirmed_at is not null
      and deleted_at is null
  ) then
    raise exception 'Verified NCG owner identity does not match';
  end if;
end;
$$;

insert into public.ncg_admins (user_id)
values ('088029d7-79ef-4c53-ad78-83f63f9a059a'::uuid)
on conflict (user_id) do nothing;

select u.id, u.email, u.email_confirmed_at, true as is_ncg_admin
from public.ncg_admins a
join auth.users u on u.id = a.user_id
where u.id = '088029d7-79ef-4c53-ad78-83f63f9a059a'::uuid;

commit;
