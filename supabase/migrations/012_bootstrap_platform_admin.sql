-- Allow service role / postgres to promote platform admins (bootstrap + maintenance).
-- Without this, guard_profile_sensitive_columns reverts is_admin for all non-admins,
-- including service-role REST patches — the first admin can never be created.

create or replace function public.guard_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jwt_role text := coalesce(auth.jwt()->>'role', '');
begin
  if v_jwt_role = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.is_admin is distinct from old.is_admin and not public.is_platform_admin() then
      new.is_admin := old.is_admin;
    end if;

    if new.access_profile_id is distinct from old.access_profile_id and not public.is_platform_admin() then
      new.access_profile_id := old.access_profile_id;
    end if;

    if new.account_status is distinct from old.account_status and not public.is_platform_admin() then
      new.account_status := old.account_status;
    end if;
  end if;

  return new;
end;
$$;

-- Bootstrap: promote default admin (safe to re-run)
update public.profiles p
set
  is_admin = true,
  access_profile_id = coalesce(
    p.access_profile_id,
    (select id from public.access_profiles where slug = 'platform_admin' limit 1)
  ),
  account_status = 'active',
  updated_at = now()
from auth.users u
where p.id = u.id
  and lower(trim(u.email)) = lower('admin@example.com');
