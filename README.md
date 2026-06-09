# Follant


An admin dashboard for creating and managing organizations and their members.

Built with React 18, Vite, TypeScript, Supabase, shadcn/ui, and TanStack Query.

---

## What it does

- **Auth** — Sign up / sign in with email and password. All admin routes are protected.
- **Organizations** — Create organizations of three types (School, Nonprofit, Business), each with a type-specific required field.
- **Invitations** — Invite members to any organization by email. Duplicate invites are blocked. Invited members appear in the member list with their status.
- **Directory** — Lists every organization you created: name, type badge, member count, and created date. Click a row to open the detail page (members list + invite form). Search and type filters included.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript (strict) + Vite (SWC) |
| Routing | React Router v6 |
| Styling | Tailwind CSS + shadcn/ui |
| Server state | TanStack React Query |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Dark mode | next-themes |
| Backend | Supabase (Postgres + Auth) |
| Server logic | Supabase Edge Functions (Deno) |
| Deployment | Vercel |

---

## Setup

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier is fine)

### 1. Clone and install

```bash
git clone https://github.com/your-username/follant.git
cd follant
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.development
```

**With Supabase** (production path): set `VITE_SUPABASE_URL_DEV` and `VITE_SUPABASE_ANON_KEY_DEV` from your project dashboard.

**Without Supabase** (local demo): omit those vars — the app uses Express + `db.json` with seeded credentials below.

### 3. Database

Apply migrations in order (`001` through `006`):

```bash
npm run supabase:db:push
```

Or paste each file from `supabase/migrations/` into the Supabase SQL Editor.

### 4. Edge Functions

```bash
npx supabase login
npx supabase link --project-ref your-project-id
npm run supabase:functions:deploy
```

### 5. Run locally

```bash
npm run dev
```

---

## Deployment (Vercel)

The app is **Supabase-only** on Vercel: static Vite SPA + Supabase Auth, Postgres, Storage, and Edge Functions. No Express server is required.

### 1. Connect repo

Import the GitHub repo in [Vercel](https://vercel.com). `vercel.json` sets:

- **Build:** `npm run build:web` (`vite build`)
- **Output:** `dist/`
- **SPA rewrites** for React Router

### 2. Vercel environment variables (Production)

Copy values from your local `.env` (same Supabase project = same behaviour as dev):

| Variable | Example |
|---|---|
| `VITE_SUPABASE_URL_PROD` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY_PROD` | anon key from Supabase → Settings → API |
| `VITE_SUPABASE_STORAGE_BUCKET_PROD` | `Pics` |

Do **not** put the service role key in Vercel (browser bundle). It belongs only in Supabase Edge Function secrets.

Redeploy after changing any `VITE_*` variable.

### 3. Supabase Auth URLs

In **Supabase Dashboard → Authentication → URL Configuration**:

| Setting | Value |
|---|---|
| **Site URL** | `https://your-app.vercel.app` |
| **Redirect URLs** | `http://localhost:3000/**`, `https://your-app.vercel.app/**`, `https://*.vercel.app/**` (preview) |

### 4. Edge Function secrets

In **Supabase Dashboard → Edge Functions → Secrets** (or `supabase secrets set`):

```bash
APP_URL=https://your-app.vercel.app
ALLOWED_ORIGINS=http://localhost:3000,https://your-app.vercel.app,https://your-project.vercel.app
```

Then redeploy functions:

```bash
npm run supabase:functions:deploy
```

`APP_URL` is used for invite and password-reset links. `ALLOWED_ORIGINS` lets Edge Functions accept requests from both local dev and Vercel.

### 5. Platform admin

Promote your user once in the SQL Editor (see [supabase/README.md](supabase/README.md)).

### Local vs Vercel

| | Local (`npm run dev`) | Vercel (production build) |
|---|---|---|
| Vite mode | `development` | `production` |
| Supabase env keys | `VITE_*_DEV` | `VITE_*_PROD` (falls back to `_DEV` if unset) |
| Auth / data / storage | Supabase | Same Supabase project |
| Org create / invite | Edge Functions | Same Edge Functions |

Both URLs are live and functional independently when env + Supabase URLs are configured as above.

---

## Test credentials

```
Email:    admin@example.com
Password: Password123!
```

---

## Branching strategy

```
main          → production Vercel URL
development   → preview Vercel URL (default working branch)
feature/*     → short-lived branches off development, merged via PR
```

Feature work branches off `development`. `main` only receives merges from `development` once a milestone is stable.

---

## Data model (minimum)

| Table | Key columns |
|---|---|
| `profiles` | `id` (FK → `auth.users`), `full_name`, `email`, `is_admin` |
| `organizations` | `id`, `name`, `type`, `created_by` (FK → `auth.users`), `created_at`, type-specific fields (`school_district`, `nonprofit_ein`, `business_reg_number`, …) |
| `organization_members` | `id`, `organization_id`, `user_id` (nullable until accepted), `email`, `status`, `role`, `invited_at`, `joined_at` |

RLS, RBAC access profiles, audit logging, and directory indexes are in migrations `003`–`006`. See [supabase/README.md](supabase/README.md).

---

## Production readiness

| Area | Status |
|---|---|
| Auth (Supabase or file-db fallback) | Protected routes, admin-only (`is_admin`), deactivated/suspended blocked |
| Org create / invite | Edge Functions + Zod + DB CHECK constraints + RBAC |
| Directory | Filtered by `created_by`, batched member counts, indexed |
| Security | RLS on all tables, invite via `can_invite_members`, audit via `log_activity()` only |
| Deploy | Vite build + Supabase migrations/functions; see setup above |

Remaining optional work: real email delivery, invitation acceptance flow, Playwright E2E, separate dev Supabase project.

---

## Shortcuts and tradeoffs

- **Email delivery is stubbed.** The `invite-member` Edge Function logs where the send step would go. Plugging in Resend or SendGrid is a one-function change.
- **No invitation acceptance flow.** Invited members appear with status `invited`. Linking an accepted invite to an auth user is not implemented.
- **File uploads** (avatar, logo, banner) use Express local storage when not on Supabase Storage.