-- 003_rbac_audit_access.sql
-- Aligns Supabase with UI: access profiles, expanded member roles/statuses,
-- platform-admin audit visibility, human-readable activity labels, and RLS helpers.
-- Depends on: 001_initial_schema.sql, 002_comprehensive_saas.sql

-- ─── ENUM EXTENSIONS (match src/types.ts) ────────────────────────────────────

alter type public.member_status add value if not exists 'suspended';
alter type public.member_status add value if not exists 'removed';

alter type public.member_role add value if not exists 'viewer';

create type public.activity_severity as enum ('info', 'notice', 'warning', 'critical');
create type public.access_scope as enum ('platform', 'organization');

-- ─── PROFILES: email sync + platform admin flag ──────────────────────────────

alter table public.profiles
  add column if not exists email text;

comment on column public.profiles.is_admin is
  'Platform administrator — can view all audit logs and manage cross-org access.';

create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    email = new.email,
    full_name = coalesce(new.raw_user_meta_data->>'full_name', full_name),
    updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    is_admin,
    phone,
    job_title,
    timezone
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Admin User'),
    new.email,
    coalesce((new.raw_user_meta_data->>'is_admin')::boolean, true),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'job_title',
    coalesce(new.raw_user_meta_data->>'timezone', 'UTC')
  );
  return new;
end;
$$;

-- ─── ACCESS PROFILES (role templates for UI + permissions) ───────────────────

create table if not exists public.access_profiles (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  name text not null,
  description text not null,
  scope access_scope not null default 'organization',
  -- Canonical permission keys consumed by UI and Edge Functions
  permissions jsonb not null default '{}'::jsonb,
  is_system boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.access_profiles is
  'Predefined access types (Platform Admin, Org Owner, Member, Viewer, etc.) shown in the UI.';

insert into public.access_profiles (slug, name, description, scope, permissions, sort_order)
values
  (
    'platform_admin',
    'Platform Administrator',
    'Full platform access. Can view all organizations and every audit log entry.',
    'platform',
    '{
      "platform": { "read": true, "manage_users": true, "view_all_logs": true },
      "organizations": { "create": true, "read": true, "update": true, "delete": true },
      "members": { "invite": true, "update": true, "remove": true, "assign_roles": true },
      "activity_logs": { "read": true, "read_all": true },
      "files": { "upload": true, "delete": true },
      "settings": { "read": true, "write": true }
    }'::jsonb,
    10
  ),
  (
    'org_owner',
    'Organization Owner',
    'Created the organization. Full control over members, settings, and org audit logs.',
    'organization',
    '{
      "organizations": { "read": true, "update": true, "delete": true },
      "members": { "invite": true, "update": true, "remove": true, "assign_roles": true },
      "activity_logs": { "read": true, "read_all": false },
      "files": { "upload": true, "delete": true },
      "settings": { "read": true, "write": true }
    }'::jsonb,
    20
  ),
  (
    'org_admin',
    'Organization Admin',
    'Can manage members, update organization details, and view organization activity.',
    'organization',
    '{
      "organizations": { "read": true, "update": true, "delete": false },
      "members": { "invite": true, "update": true, "remove": true, "assign_roles": true },
      "activity_logs": { "read": true, "read_all": false },
      "files": { "upload": true, "delete": true },
      "settings": { "read": true, "write": true }
    }'::jsonb,
    30
  ),
  (
    'org_member',
    'Member',
    'Standard member. Can view organization details and their own activity.',
    'organization',
    '{
      "organizations": { "read": true, "update": false, "delete": false },
      "members": { "invite": false, "update": false, "remove": false, "assign_roles": false },
      "activity_logs": { "read": false, "read_all": false },
      "files": { "upload": true, "delete": false },
      "settings": { "read": true, "write": false }
    }'::jsonb,
    40
  ),
  (
    'org_viewer',
    'Viewer',
    'Read-only access to organization information. Cannot invite or change settings.',
    'organization',
    '{
      "organizations": { "read": true, "update": false, "delete": false },
      "members": { "invite": false, "update": false, "remove": false, "assign_roles": false },
      "activity_logs": { "read": false, "read_all": false },
      "files": { "upload": false, "delete": false },
      "settings": { "read": true, "write": false }
    }'::jsonb,
    50
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  permissions = excluded.permissions,
  updated_at = now();

alter table public.organization_members
  add column if not exists access_profile_id uuid references public.access_profiles(id) on delete set null;

create index if not exists organization_members_access_profile_idx
  on public.organization_members (access_profile_id);

-- Default access profile from member role
create or replace function public.set_member_access_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.access_profile_id is null then
    new.access_profile_id := (
      select id from public.access_profiles
      where slug = case new.role
        when 'admin' then 'org_admin'
        when 'viewer' then 'org_viewer'
        else 'org_member'
      end
      limit 1
    );
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists organization_members_set_access_profile on public.organization_members;
create trigger organization_members_set_access_profile
  before insert or update of role, access_profile_id on public.organization_members
  for each row execute function public.set_member_access_profile();

-- ─── ACTIVITY ACTION CATALOG (human-readable labels for admin UI) ───────────

create table if not exists public.activity_action_catalog (
  action text primary key,
  label text not null,
  category text not null default 'general',
  severity activity_severity not null default 'info',
  description text not null default ''
);

comment on table public.activity_action_catalog is
  'Maps technical action codes to plain-language labels shown in the Activity Log UI.';

insert into public.activity_action_catalog (action, label, category, severity, description)
values
  ('auth.sign_up', 'Account created', 'Authentication', 'notice', 'A new user registered on the platform.'),
  ('auth.sign_in', 'Signed in', 'Authentication', 'info', 'User signed in successfully.'),
  ('auth.sign_out', 'Signed out', 'Authentication', 'info', 'User signed out of the dashboard.'),
  ('auth.password_change', 'Password changed', 'Security', 'warning', 'User changed their account password.'),
  ('profile.update', 'Profile updated', 'Account', 'info', 'User updated profile information.'),
  ('profile.avatar_upload', 'Avatar uploaded', 'Account', 'info', 'User uploaded a new profile photo.'),
  ('profile.preferences_update', 'Preferences updated', 'Account', 'info', 'User changed notification or theme preferences.'),
  ('account.session_revoke', 'Session revoked', 'Security', 'warning', 'User revoked an active login session.'),
  ('account.deactivate', 'Account deactivated', 'Security', 'critical', 'User deactivated their account.'),
  ('org.create', 'Organization created', 'Organizations', 'notice', 'A new organization was created.'),
  ('org.update', 'Organization updated', 'Organizations', 'info', 'Organization details were changed.'),
  ('org.view', 'Organization viewed', 'Organizations', 'info', 'User opened an organization page.'),
  ('org.status_change', 'Organization status changed', 'Organizations', 'warning', 'Organization status was updated.'),
  ('org.logo_upload', 'Logo uploaded', 'Organizations', 'info', 'Organization logo image was uploaded.'),
  ('org.banner_upload', 'Banner uploaded', 'Organizations', 'info', 'Organization banner image was uploaded.'),
  ('member.invite', 'Member invited', 'Members', 'notice', 'A new member invitation was sent.'),
  ('member.update', 'Member updated', 'Members', 'info', 'Member role or status was changed.'),
  ('member.remove', 'Member removed', 'Members', 'warning', 'A member was removed from the organization.'),
  ('file.upload', 'File uploaded', 'Files', 'info', 'A file or image was uploaded.'),
  ('file.delete', 'File deleted', 'Files', 'warning', 'An uploaded file was deleted.')
on conflict (action) do update set
  label = excluded.label,
  category = excluded.category,
  severity = excluded.severity,
  description = excluded.description;

-- Extend activity_logs for admin-friendly display
alter table public.activity_logs
  add column if not exists action_label text,
  add column if not exists category text default 'general',
  add column if not exists severity activity_severity not null default 'info',
  add column if not exists actor_name text,
  add column if not exists actor_email text,
  add column if not exists organization_name text;

create index if not exists activity_logs_severity_idx on public.activity_logs (severity);
create index if not exists activity_logs_category_idx on public.activity_logs (category);
create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);

-- ─── RLS HELPER FUNCTIONS ────────────────────────────────────────────────────

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_org_owner(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organizations
    where id = p_org_id and created_by = auth.uid()
  );
$$;

create or replace function public.is_org_admin_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('admin')
  );
$$;

create or replace function public.can_manage_organization(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or public.is_org_owner(p_org_id)
    or public.is_org_admin_member(p_org_id);
$$;

create or replace function public.can_view_organization(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_organization(p_org_id)
    or exists (
      select 1 from public.organization_members
      where organization_id = p_org_id
        and user_id = auth.uid()
        and status in ('active', 'invited')
    );
$$;

create or replace function public.can_view_org_activity(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or public.is_org_owner(p_org_id)
    or public.is_org_admin_member(p_org_id);
$$;

-- ─── AUDIT LOGGING FUNCTION (NFR: centralized, immutable trail) ──────────────

create or replace function public.log_activity(
  p_action text,
  p_description text,
  p_organization_id uuid default null,
  p_entity_type text default null,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_ip_address text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_log_id uuid := uuid_generate_v4();
  v_catalog public.activity_action_catalog%rowtype;
  v_profile public.profiles%rowtype;
  v_org_name text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_catalog from public.activity_action_catalog where action = p_action;
  select * into v_profile from public.profiles where id = v_user_id;

  if p_organization_id is not null then
    select name into v_org_name from public.organizations where id = p_organization_id;
  end if;

  insert into public.activity_logs (
    id,
    user_id,
    organization_id,
    action,
    action_label,
    category,
    severity,
    entity_type,
    entity_id,
    description,
    metadata,
    ip_address,
    user_agent,
    actor_name,
    actor_email,
    organization_name,
    created_at
  )
  values (
    v_log_id,
    v_user_id,
    p_organization_id,
    p_action,
    coalesce(v_catalog.label, p_action),
    coalesce(v_catalog.category, 'general'),
    coalesce(v_catalog.severity, 'info'::activity_severity),
    p_entity_type,
    p_entity_id,
    p_description,
    coalesce(p_metadata, '{}'::jsonb),
    p_ip_address,
    p_user_agent,
    v_profile.full_name,
    v_profile.email,
    v_org_name,
    now()
  );

  return v_log_id;
end;
$$;

comment on function public.log_activity is
  'Single entry point for audit events. Populates human-readable labels for the admin Activity Log UI.';

revoke all on function public.log_activity from public;
grant execute on function public.log_activity to authenticated;

-- Backfill labels on existing rows
update public.activity_logs al
set
  action_label = coalesce(al.action_label, c.label, al.action),
  category = coalesce(al.category, c.category, 'general'),
  severity = coalesce(al.severity, c.severity, 'info'::activity_severity)
from public.activity_action_catalog c
where c.action = al.action
  and (al.action_label is null or al.category is null);

update public.activity_logs al
set
  actor_name = p.full_name,
  actor_email = p.email
from public.profiles p
where p.id = al.user_id
  and (al.actor_name is null or al.actor_email is null);

update public.activity_logs al
set organization_name = o.name
from public.organizations o
where o.id = al.organization_id
  and al.organization_name is null;

-- ─── ADMIN ACTIVITY VIEW (simple terms for platform admins) ──────────────────

create or replace view public.activity_logs_admin_view
with (security_invoker = true)
as
select
  al.id,
  al.created_at,
  al.action,
  coalesce(al.action_label, c.label, al.action) as action_label,
  coalesce(al.category, c.category, 'general') as category,
  coalesce(al.severity, c.severity, 'info'::activity_severity) as severity,
  al.description,
  coalesce(al.actor_name, p.full_name) as actor_name,
  coalesce(al.actor_email, p.email) as actor_email,
  coalesce(al.organization_name, o.name) as organization_name,
  al.organization_id,
  al.entity_type,
  al.entity_id,
  al.ip_address,
  al.metadata
from public.activity_logs al
left join public.activity_action_catalog c on c.action = al.action
left join public.profiles p on p.id = al.user_id
left join public.organizations o on o.id = al.organization_id;

comment on view public.activity_logs_admin_view is
  'Human-readable audit feed for platform administrators.';

-- Org-scoped view for org owners/admins
create or replace view public.activity_logs_org_view
with (security_invoker = true)
as
select *
from public.activity_logs_admin_view
where organization_id is not null;

-- ─── REPLACE RLS POLICIES (access control aligned with UI) ───────────────────

alter table public.access_profiles enable row level security;

drop policy if exists "Authenticated users can read access profiles" on public.access_profiles;
create policy "Authenticated users can read access profiles"
  on public.access_profiles for select
  to authenticated
  using (true);

-- Profiles
drop policy if exists "Users can read their own profiles" on public.profiles;
drop policy if exists "Users can update their own profiles" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can view own profile or platform admin views all"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_platform_admin());

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Organizations
drop policy if exists "Admins can view organizations they created" on public.organizations;
drop policy if exists "Admins can insert organizations they created" on public.organizations;
drop policy if exists "Admins can update organizations they created" on public.organizations;
drop policy if exists "Admins can delete organizations they created" on public.organizations;
drop policy if exists "Admins can view their own orgs" on public.organizations;
drop policy if exists "Admins can insert orgs" on public.organizations;
drop policy if exists "Admins can update their own orgs" on public.organizations;
drop policy if exists "Admins can delete their own orgs" on public.organizations;

create policy "View organizations with access"
  on public.organizations for select
  to authenticated
  using (
    public.is_platform_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.organization_members om
      where om.organization_id = organizations.id
        and om.user_id = auth.uid()
        and om.status in ('active', 'invited')
    )
  );

create policy "Create organizations as self"
  on public.organizations for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Manage organizations with permission"
  on public.organizations for update
  to authenticated
  using (public.can_manage_organization(id))
  with check (public.can_manage_organization(id));

create policy "Delete organizations as owner or platform admin"
  on public.organizations for delete
  to authenticated
  using (public.is_platform_admin() or created_by = auth.uid());

-- Organization members
drop policy if exists "Admins can view members of organizations they created" on public.organization_members;
drop policy if exists "Admins can invite/insert members to organizations they created" on public.organization_members;
drop policy if exists "Admins can delete/remove members from organizations they created" on public.organization_members;
drop policy if exists "Org admins can view members" on public.organization_members;
drop policy if exists "Org admins can insert members" on public.organization_members;
drop policy if exists "Org admins can update members" on public.organization_members;

create policy "View members when org access granted"
  on public.organization_members for select
  to authenticated
  using (public.can_view_organization(organization_id));

create policy "Invite members when allowed"
  on public.organization_members for insert
  to authenticated
  with check (public.can_manage_organization(organization_id));

create policy "Update members when allowed"
  on public.organization_members for update
  to authenticated
  using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

create policy "Remove members when allowed"
  on public.organization_members for delete
  to authenticated
  using (public.can_manage_organization(organization_id));

-- Activity logs
drop policy if exists "Users can view their own activity logs" on public.activity_logs;
drop policy if exists "Users can insert their own activity logs" on public.activity_logs;
drop policy if exists "Org owners can view org activity logs" on public.activity_logs;

create policy "View own activity logs"
  on public.activity_logs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Platform admin views all activity logs"
  on public.activity_logs for select
  to authenticated
  using (public.is_platform_admin());

create policy "Org managers view org activity logs"
  on public.activity_logs for select
  to authenticated
  using (
    organization_id is not null
    and public.can_view_org_activity(organization_id)
  );

-- Inserts only via log_activity() security definer (no direct client insert policy)

-- Uploaded files
drop policy if exists "Users can view their uploads" on public.uploaded_files;
drop policy if exists "Users can insert their uploads" on public.uploaded_files;
drop policy if exists "Org owners can view org uploads" on public.uploaded_files;

create policy "View own uploads"
  on public.uploaded_files for select
  to authenticated
  using (auth.uid() = uploaded_by);

create policy "View org uploads with access"
  on public.uploaded_files for select
  to authenticated
  using (
    organization_id is not null
    and public.can_view_organization(organization_id)
  );

create policy "Upload when org access granted"
  on public.uploaded_files for insert
  to authenticated
  with check (
    auth.uid() = uploaded_by
    and (
      organization_id is null
      or public.can_manage_organization(organization_id)
    )
  );

-- User sessions (unchanged intent, explicit roles)
drop policy if exists "Users can view their sessions" on public.user_sessions;
drop policy if exists "Users can update their sessions" on public.user_sessions;
drop policy if exists "Users can insert their sessions" on public.user_sessions;

create policy "Users manage own sessions"
  on public.user_sessions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users update own sessions"
  on public.user_sessions for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own sessions"
  on public.user_sessions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ─── NFR: updated_at triggers ────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists organizations_touch_updated_at on public.organizations;
create trigger organizations_touch_updated_at
  before update on public.organizations
  for each row execute function public.touch_updated_at();

drop trigger if exists access_profiles_touch_updated_at on public.access_profiles;
create trigger access_profiles_touch_updated_at
  before update on public.access_profiles
  for each row execute function public.touch_updated_at();

-- ─── GRANTS ──────────────────────────────────────────────────────────────────

grant select on public.access_profiles to authenticated;
grant select on public.activity_action_catalog to authenticated;
grant select on public.activity_logs_admin_view to authenticated;
grant select on public.activity_logs_org_view to authenticated;
