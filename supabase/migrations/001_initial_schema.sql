-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES (Linked directly to auth.users UID)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- ORGANIZATION TYPE ENUM
create type org_type as enum ('school', 'nonprofit', 'business');

-- ORGANIZATIONS
create table public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type org_type not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  -- Downstream / Conditional validation fields based on organization type
  school_district text,
  nonprofit_ein text,
  business_reg_number text,
  created_at timestamptz not null default now(),
  
  -- Validation constraints
  constraint name_checked check (char_length(name) >= 2),
  constraint school_district_conditional check (
    (type = 'school' and school_district is not null and char_length(school_district) > 0) or
    (type != 'school' and school_district is null)
  ),
  constraint nonprofit_ein_conditional check (
    (type = 'nonprofit' and nonprofit_ein is not null and nonprofit_ein ~ '^\d{2}-\d{7}$') or
    (type != 'nonprofit' and nonprofit_ein is null)
  ),
  constraint business_reg_number_conditional check (
    (type = 'business' and business_reg_number is not null and char_length(business_reg_number) > 0) or
    (type != 'business' and business_reg_number is null)
  )
);

-- MEMBER STATUS AND ROLE ENUMS
create type member_status as enum ('invited', 'active');
create type member_role as enum ('admin', 'member');

-- ORGANIZATION MEMBERS
create table public.organization_members (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  status member_status not null default 'invited',
  role member_role not null default 'member',
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  
  -- Uniqueness constraint: Prevent duplicate invitations to the same email within the same organization
  unique(organization_id, email)
);

-- TRIGGERS: Auto-create Profile profile on Auth SignUp
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Admin User'),
    true -- Restricting initial users created here to admin privileges
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ROW LEVEL SECURITY (RLS) POLICIES --

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- Profiles Policies
create policy "Users can read their own profiles" 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Users can update their own profiles" 
  on public.profiles for update 
  using (auth.uid() = id);

-- Organizations Policies
create policy "Admins can view organizations they created" 
  on public.organizations for select 
  using (auth.uid() = created_by);

create policy "Admins can insert organizations they created" 
  on public.organizations for insert 
  with check (auth.uid() = created_by);

create policy "Admins can update organizations they created" 
  on public.organizations for update 
  using (auth.uid() = created_by);

create policy "Admins can delete organizations they created" 
  on public.organizations for delete 
  using (auth.uid() = created_by);

-- Organization Members Policies
create policy "Admins can view members of organizations they created" 
  on public.organization_members for select 
  using (
    exists (
      select 1 from public.organizations 
      where public.organizations.id = organization_members.organization_id 
        and public.organizations.created_by = auth.uid()
    )
  );

create policy "Admins can invite/insert members to organizations they created" 
  on public.organization_members for insert 
  with check (
    exists (
      select 1 from public.organizations 
      where public.organizations.id = organization_members.organization_id 
        and public.organizations.created_by = auth.uid()
    )
  );

create policy "Admins can delete/remove members from organizations they created" 
  on public.organization_members for delete 
  using (
    exists (
      select 1 from public.organizations 
      where public.organizations.id = organization_members.organization_id 
        and public.organizations.created_by = auth.uid()
    )
  );
