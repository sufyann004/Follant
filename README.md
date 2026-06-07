# Follant


An admin dashboard for creating and managing organizations and their members.

Built with React 18, Vite, TypeScript, Supabase, shadcn/ui, and TanStack Query.

---

## What it does

- **Auth** — Sign up / sign in with email and password. All admin routes are protected.
- **Organizations** — Create organizations of three types (School, Nonprofit, Business), each with a type-specific required field.
- **Invitations** — Invite members to any organization by email. Duplicate invites are blocked. Invited members appear in the member list with their status.
- **Directory** — View all your organizations in one place with member counts and type badges. Click into any org to see its members.

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
cp .env.example .env
```

Fill in your Supabase project values:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Database

Run the migration SQL against your Supabase project. In the Supabase dashboard, go to **SQL Editor** and paste the contents of `supabase/migrations/001_initial_schema.sql`.

### 4. Edge Functions

```bash
npx supabase login
npx supabase link --project-ref your-project-id
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
npx supabase functions deploy
```

### 5. Run locally

```bash
npm run dev
```

---

## Deployment (Vercel)

1. Connect the GitHub repo to a Vercel project.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel's environment variable settings.
3. Set the production branch to `main` and the preview branch to `development`.

Both URLs are live and functional independently.

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

## Shortcuts and tradeoffs

- **Email delivery is stubbed.** The `invite-member` Edge Function logs where the send step would go. Plugging in Resend or SendGrid is a one-function change.
- **No invitation acceptance flow.** Invited members appear with status `invited`. Linking an accepted invite to an auth user (the stretch goal) is not implemented.
- **No per-org role management UI.** The schema supports `admin` and `member` roles, but the UI only assigns `member` on invite.

---

## What I'd do with another day

- Implement the invitation acceptance flow (magic link → sign up → member row linked to user)
- Add search and type filtering to the organization directory
- Write a Playwright end-to-end test covering sign-in → create org → invite member
- Set up a separate Supabase project for the development environment