# Supabase schema — AdminDB / ImpactOp

Run migrations in order against a fresh Supabase project:

```bash
supabase db push
# or apply manually in SQL editor:
# 001_initial_schema.sql
# 002_comprehensive_saas.sql
# 003_rbac_audit_access.sql
# 004_access_control_finalize.sql
```

## Functional requirements (FRS) mapping

| Requirement | Tables / functions | UI surface |
|---|---|---|
| Auth (sign up / sign in) | `auth.users`, `profiles`, trigger `handle_new_user` | Sign-in / Sign-up |
| Admin-only dashboard | `profiles.is_admin` | `ProtectedLayout` |
| Create org (3 types + conditional fields) | `organizations`, check constraints | Create org page |
| Invite members by email | `organization_members`, Edge Function | Org detail → Members |
| Org directory + detail | `organizations`, `organization_members` | Directory / detail pages |
| Account management | extended `profiles`, `user_sessions` | Account settings |
| Image uploads | `uploaded_files`, Storage (optional) | Avatar, logo, banner |
| Activity audit trail | `activity_logs`, `activity_action_catalog`, `log_activity()` | Activity log page |
| Access control / roles | `access_profiles`, `organization_members.role`, `access_profile_id`, `get_effective_permissions()` | Member invite/edit |
| Platform admin sees all logs | RLS + `activity_logs_admin_view`, `is_platform_admin()` | Activity log (admin banner) |
| Member list with access labels | `organization_members_access_view` | Org detail → Members |

## Access profiles (role templates)

| Slug | Name | Scope | Typical assignment |
|---|---|---|---|
| `platform_admin` | Platform Administrator | platform | `profiles.is_admin = true` |
| `org_owner` | Organization Owner | organization | `organizations.created_by` |
| `org_admin` | Organization Admin | organization | member `role = admin` |
| `org_member` | Member | organization | member `role = member` |
| `org_viewer` | Viewer | organization | member `role = viewer` |

Permissions are stored as JSONB on `access_profiles.permissions` and mirrored in the app (`src/types.ts`).

## Activity log (plain language)

Technical actions (e.g. `member.invite`) are mapped in `activity_action_catalog` to:

- **label** — shown in UI (“Member invited”)
- **category** — Authentication, Security, Organizations, Members, Files
- **severity** — info, notice, warning, critical

Use **`log_activity()`** from Edge Functions or RPC — do not insert into `activity_logs` directly from the client (audit integrity NFR).

Platform admins (`profiles.is_admin`) can **SELECT all rows** in `activity_logs` via RLS.

Org owners/admins see org-scoped logs via `can_view_org_activity()`.

## Non-functional requirements (NFR)

| NFR | Implementation |
|---|---|
| Security — RLS on every table | All public tables have RLS; helpers `is_platform_admin`, `can_manage_organization`, etc. |
| Audit integrity | Central `log_activity()` security definer; no client INSERT policy on `activity_logs` |
| Least privilege | Role + access profile; viewer cannot invite or upload; `get_effective_permissions()` for checks |
| Performance | Indexes on `activity_logs(user_id, created_at)`, `organization_id`, `action`, `severity` |
| Data retention | App caps at 5000 rows in file DB; Postgres: add scheduled job as needed |
| Type safety | Regenerate `database.types.ts` after migrations |

```bash
npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
```

## Environment

Client:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Edge Functions only:

```
SUPABASE_SERVICE_ROLE_KEY=
```

Never expose the service role key in the browser bundle.
