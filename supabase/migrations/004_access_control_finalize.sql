-- 004_access_control_finalize.sql
-- Final UI alignment: platform profile link, permission resolver, member access view, catalog RLS.
-- Depends on: 003_rbac_audit_access.sql

-- NFR: RLS on every table (including catalog)
alter table public.activity_action_catalog enable row level security;

drop policy if exists "Authenticated users read action catalog" on public.activity_action_catalog;
create policy "Authenticated users read action catalog"
  on public.activity_action_catalog for select
  to authenticated
  using (true);

-- Platform access profile on user profile (mirrors profiles.is_admin in UI)
alter table public.profiles
  add column if not exists access_profile_id uuid references public.access_profiles(id) on delete set null;

create index if not exists profiles_access_profile_idx on public.profiles (access_profile_id);

create or replace function public.sync_profile_platform_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is true then
    new.access_profile_id := coalesce(
      new.access_profile_id,
      (select id from public.access_profiles where slug = 'platform_admin' limit 1)
    );
  elsif tg_op = 'UPDATE' and old.is_admin is true and new.is_admin is false then
    new.access_profile_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_platform_access on public.profiles;
create trigger profiles_sync_platform_access
  before insert or update of is_admin, access_profile_id on public.profiles
  for each row execute function public.sync_profile_platform_access();

-- Backfill platform admins
update public.profiles p
set access_profile_id = ap.id
from public.access_profiles ap
where p.is_admin is true
  and ap.slug = 'platform_admin'
  and p.access_profile_id is null;

-- Resolve effective permissions for UI / Edge Functions (FRS: access control)
create or replace function public.get_effective_permissions(
  p_user_id uuid default auth.uid(),
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_member public.organization_members%rowtype;
  v_perms jsonb := '{}'::jsonb;
begin
  if p_user_id is null then
    return v_perms;
  end if;

  select * into v_profile from public.profiles where id = p_user_id;

  if not found then
    return v_perms;
  end if;

  if v_profile.is_admin then
    select permissions into v_perms
    from public.access_profiles
    where slug = 'platform_admin';
    return coalesce(v_perms, '{}'::jsonb);
  end if;

  if p_organization_id is null then
    return v_perms;
  end if;

  if public.is_org_owner(p_organization_id) then
    select permissions into v_perms
    from public.access_profiles
    where slug = 'org_owner';
    return coalesce(v_perms, '{}'::jsonb);
  end if;

  select * into v_member
  from public.organization_members
  where organization_id = p_organization_id
    and user_id = p_user_id
    and status = 'active'
  limit 1;

  if v_member.id is null then
    return v_perms;
  end if;

  if v_member.access_profile_id is not null then
    select permissions into v_perms
    from public.access_profiles
    where id = v_member.access_profile_id;
  else
    select permissions into v_perms
    from public.access_profiles
    where slug = case v_member.role
      when 'admin' then 'org_admin'
      when 'viewer' then 'org_viewer'
      else 'org_member'
    end;
  end if;

  return coalesce(v_perms, '{}'::jsonb);
end;
$$;

comment on function public.get_effective_permissions is
  'Returns JSONB permission flags for the current user in an org context. Used by UI and Edge Functions.';

revoke all on function public.get_effective_permissions(uuid, uuid) from public;
grant execute on function public.get_effective_permissions(uuid, uuid) to authenticated;

-- Member + access profile view for org admin UI (simple terms)
create or replace view public.organization_members_access_view
with (security_invoker = true)
as
select
  om.id,
  om.organization_id,
  o.name as organization_name,
  om.email,
  om.user_id,
  om.status,
  om.role,
  om.title,
  om.department,
  om.access_profile_id,
  coalesce(ap.name, case om.role
    when 'admin' then 'Organization Admin'
    when 'viewer' then 'Viewer'
    else 'Member'
  end) as access_profile_name,
  coalesce(ap.description, 'Default permissions for this role') as access_profile_description,
  coalesce(ap.permissions, '{}'::jsonb) as access_permissions,
  om.invited_at,
  om.joined_at,
  om.updated_at
from public.organization_members om
inner join public.organizations o on o.id = om.organization_id
left join public.access_profiles ap on ap.id = om.access_profile_id;

comment on view public.organization_members_access_view is
  'Members with human-readable access type labels for the org admin UI.';

grant select on public.organization_members_access_view to authenticated;
