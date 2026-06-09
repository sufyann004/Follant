-- Ensure UUID helpers exist on hosted Supabase (extension may be missing if migrations ran out of order).
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Prefer gen_random_uuid() (pgcrypto) over uuid-ossp for new defaults.
alter table if exists public.uploaded_files
  alter column id set default gen_random_uuid();

alter table if exists public.activity_logs
  alter column id set default gen_random_uuid();

-- log_activity must not depend on uuid-ossp at runtime.
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
  v_log_id uuid := gen_random_uuid();
  v_catalog public.activity_action_catalog%rowtype;
  v_profile public.profiles%rowtype;
  v_org_name text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_organization_id is not null
     and not public.is_platform_admin()
     and not public.can_view_organization(p_organization_id) then
    raise exception 'Forbidden: no access to organization';
  end if;

  if not exists (select 1 from public.activity_action_catalog where action = p_action) then
    raise exception 'Unknown activity action';
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

insert into public.activity_action_catalog (action, label, category, severity, description)
values
  ('org.delete', 'Organisation deleted', 'Organisations', 'critical', 'An organisation was permanently deleted.')
on conflict (action) do update set
  label = excluded.label,
  category = excluded.category,
  severity = excluded.severity,
  description = excluded.description;
