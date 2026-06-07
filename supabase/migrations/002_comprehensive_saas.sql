-- Comprehensive SaaS extensions: profiles, orgs, activity audit, uploads, sessions

-- ─── ENUMS ───────────────────────────────────────────────────────────────────

create type account_status as enum ('active', 'suspended', 'deactivated');
create type org_status as enum ('active', 'inactive', 'archived', 'pending_verification');
create type theme_preference as enum ('light', 'dark', 'system');
create type upload_entity_type as enum ('profile', 'organization', 'organization_banner', 'member', 'document');

-- ─── PROFILES (extended) ─────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists job_title text,
  add column if not exists department text,
  add column if not exists bio text,
  add column if not exists timezone text default 'UTC',
  add column if not exists locale text default 'en-US',
  add column if not exists theme theme_preference not null default 'system',
  add column if not exists account_status account_status not null default 'active',
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_push boolean not null default true,
  add column if not exists notify_sms boolean not null default false,
  add column if not exists notify_marketing boolean not null default false,
  add column if not exists two_factor_enabled boolean not null default false,
  add column if not exists last_login_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- ─── ORGANIZATIONS (extended) ────────────────────────────────────────────────

alter table public.organizations
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists website text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists logo_url text,
  add column if not exists banner_url text,
  add column if not exists status org_status not null default 'active',
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state_region text,
  add column if not exists postal_code text,
  add column if not exists country text default 'US',
  add column if not exists timezone text default 'UTC',
  add column if not exists locale text default 'en-US',
  add column if not exists currency text default 'USD',
  add column if not exists tags text[] default '{}',
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now(),
  -- School-specific
  add column if not exists school_grade_levels text,
  add column if not exists school_accreditation text,
  add column if not exists school_student_count integer,
  -- Nonprofit-specific
  add column if not exists nonprofit_tax_status text,
  add column if not exists nonprofit_mission text,
  add column if not exists nonprofit_founded_year integer,
  -- Business-specific
  add column if not exists business_industry text,
  add column if not exists business_company_size text,
  add column if not exists business_tax_id text,
  add column if not exists business_duns_number text;

create unique index if not exists organizations_slug_unique on public.organizations (slug) where slug is not null;

-- ─── ORGANIZATION MEMBERS (extended) ─────────────────────────────────────────

alter table public.organization_members
  add column if not exists title text,
  add column if not exists department text,
  add column if not exists phone text,
  add column if not exists invite_message text,
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists last_active_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create policy "Org admins can update members"
  on public.organization_members for update
  using (
    exists (
      select 1 from public.organizations
      where public.organizations.id = organization_members.organization_id
        and public.organizations.created_by = auth.uid()
    )
  );

-- ─── ACTIVITY LOGS (audit trail) ─────────────────────────────────────────────

create table if not exists public.activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_user_id_idx on public.activity_logs (user_id, created_at desc);
create index if not exists activity_logs_org_id_idx on public.activity_logs (organization_id, created_at desc);
create index if not exists activity_logs_action_idx on public.activity_logs (action);

alter table public.activity_logs enable row level security;

create policy "Users can view their own activity logs"
  on public.activity_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own activity logs"
  on public.activity_logs for insert
  with check (auth.uid() = user_id);

create policy "Org owners can view org activity logs"
  on public.activity_logs for select
  using (
    organization_id is not null and exists (
      select 1 from public.organizations
      where public.organizations.id = activity_logs.organization_id
        and public.organizations.created_by = auth.uid()
    )
  );

-- ─── UPLOADED FILES ──────────────────────────────────────────────────────────

create table if not exists public.uploaded_files (
  id uuid primary key default uuid_generate_v4(),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  entity_type upload_entity_type not null,
  entity_id text not null,
  original_filename text not null,
  stored_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_path text not null,
  public_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists uploaded_files_entity_idx on public.uploaded_files (entity_type, entity_id);
create index if not exists uploaded_files_user_idx on public.uploaded_files (uploaded_by);

alter table public.uploaded_files enable row level security;

create policy "Users can view their uploads"
  on public.uploaded_files for select
  using (auth.uid() = uploaded_by);

create policy "Users can insert their uploads"
  on public.uploaded_files for insert
  with check (auth.uid() = uploaded_by);

create policy "Org owners can view org uploads"
  on public.uploaded_files for select
  using (
    organization_id is not null and exists (
      select 1 from public.organizations
      where public.organizations.id = uploaded_files.organization_id
        and public.organizations.created_by = auth.uid()
    )
  );

-- ─── USER SESSIONS ───────────────────────────────────────────────────────────

create table if not exists public.user_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text,
  ip_address text,
  user_agent text,
  is_current boolean not null default false,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists user_sessions_user_idx on public.user_sessions (user_id, created_at desc);

alter table public.user_sessions enable row level security;

create policy "Users can view their sessions"
  on public.user_sessions for select
  using (auth.uid() = user_id);

create policy "Users can update their sessions"
  on public.user_sessions for update
  using (auth.uid() = user_id);

create policy "Users can insert their sessions"
  on public.user_sessions for insert
  with check (auth.uid() = user_id);
