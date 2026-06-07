-- 005_security_hardening.sql
-- Tightens RLS helpers, invite permissions (RBAC), org-owner bootstrap, and permission RPC safety.
-- Depends on: 001–004

-- ─── Normalize member emails (duplicate prevention) ───────────────────────────

create or replace function public.normalize_member_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists organization_members_normalize_email on public.organization_members;
create trigger organization_members_normalize_email
  before insert or update of email on public.organization_members
  for each row execute function public.normalize_member_email();

-- ─── Secure permission resolver (no cross-user enumeration) ───────────────────

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
  v_user_id uuid;
  v_profile public.profiles%rowtype;
  v_member public.organization_members%rowtype;
  v_perms jsonb := '{}'::jsonb;
begin
  v_user_id := coalesce(p_user_id, auth.uid());
  if v_user_id is null then
    return v_perms;
  end if;

  if v_user_id is distinct from auth.uid() and not public.is_platform_admin() then
    v_user_id := auth.uid();
  end if;

  if v_user_id is null then
    return v_perms;
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
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

  if public.is_org_owner(p_organization_id) and v_user_id = auth.uid() then
    select permissions into v_perms
    from public.access_profiles
    where slug = 'org_owner';
    return coalesce(v_perms, '{}'::jsonb);
  end if;

  select * into v_member
  from public.organization_members
  where organization_id = p_organization_id
    and user_id = v_user_id
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

revoke all on function public.get_effective_permissions(uuid, uuid) from public;
grant execute on function public.get_effective_permissions(uuid, uuid) to authenticated;

-- ─── RBAC helpers for RLS + Edge Functions ───────────────────────────────────

create or replace function public.has_org_permission(
  p_org_id uuid,
  p_section text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_perms jsonb;
begin
  if p_org_id is null or p_section is null or p_action is null then
    return false;
  end if;

  v_perms := public.get_effective_permissions(auth.uid(), p_org_id);
  return coalesce((v_perms -> p_section ->> p_action)::boolean, false);
end;
$$;

revoke all on function public.has_org_permission(uuid, text, text) from public;
grant execute on function public.has_org_permission(uuid, text, text) to authenticated;

create or replace function public.can_invite_members(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_permission(p_org_id, 'members', 'invite');
$$;

revoke all on function public.can_invite_members(uuid) from public;
grant execute on function public.can_invite_members(uuid) to authenticated;

-- ─── Bootstrap org owner membership on create ─────────────────────────────────

create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_profile_id uuid;
  v_creator_email text;
begin
  select id into v_owner_profile_id
  from public.access_profiles
  where slug = 'org_owner'
  limit 1;

  select email into v_creator_email
  from public.profiles
  where id = new.created_by;

  if v_creator_email is null then
    select email into v_creator_email from auth.users where id = new.created_by;
  end if;

  insert into public.organization_members (
    organization_id,
    email,
    user_id,
    status,
    role,
    access_profile_id,
    invited_by,
    invited_at,
    joined_at
  )
  values (
    new.id,
    coalesce(v_creator_email, new.created_by::text || '@local.invalid'),
    new.created_by,
    'active',
    'admin',
    v_owner_profile_id,
    new.created_by,
    now(),
    now()
  )
  on conflict (organization_id, email) do update
  set
    user_id = excluded.user_id,
    status = 'active',
    role = 'admin',
    access_profile_id = excluded.access_profile_id,
    joined_at = coalesce(public.organization_members.joined_at, now());

  return new;
end;
$$;

drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- ─── Tighten member invite RLS (members.invite, not broad manage) ─────────────

drop policy if exists "Invite members when allowed" on public.organization_members;
create policy "Invite members when allowed"
  on public.organization_members for insert
  to authenticated
  with check (public.can_invite_members(organization_id));

-- ─── Restrict direct org INSERT to authenticated self as creator ────────────

drop policy if exists "Create organizations as self" on public.organizations;
create policy "Create organizations as self"
  on public.organizations for insert
  to authenticated
  with check (auth.uid() = created_by);

-- ─── Harden SECURITY DEFINER functions (search_path already set above) ──────

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

revoke all on function public.is_org_owner(uuid) from public;
grant execute on function public.is_org_owner(uuid) to authenticated;

revoke all on function public.is_org_admin_member(uuid) from public;
grant execute on function public.is_org_admin_member(uuid) to authenticated;

revoke all on function public.can_manage_organization(uuid) from public;
grant execute on function public.can_manage_organization(uuid) to authenticated;

revoke all on function public.can_view_organization(uuid) from public;
grant execute on function public.can_view_organization(uuid) to authenticated;

revoke all on function public.can_view_org_activity(uuid) from public;
grant execute on function public.can_view_org_activity(uuid) to authenticated;

-- log_activity: only authenticated may call; inserts as definer
revoke all on function public.log_activity(
  text, text, uuid, text, text, jsonb, text, text
) from public;
grant execute on function public.log_activity(
  text, text, uuid, text, text, jsonb, text, text
) to authenticated;
