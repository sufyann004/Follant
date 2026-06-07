-- 006_directory_indexes.sql
-- Performance indexes for organization directory (created_by filter + member counts).

create index if not exists organizations_created_by_created_at_idx
  on public.organizations (created_by, created_at desc);

create index if not exists organization_members_org_status_idx
  on public.organization_members (organization_id, status);

comment on index public.organizations_created_by_created_at_idx is
  'Supports directory query: list orgs created by signed-in admin, newest first.';
