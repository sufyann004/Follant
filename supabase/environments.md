# Supabase environments — development vs production

ImpactOp supports two isolation strategies. **Separate projects (recommended)** is the default documented in `.env.example`.

## Option A — Separate Supabase projects (recommended)

| | Development | Production |
|---|---|---|
| **Purpose** | Local dev, preview deploys, destructive tests | Live users and audit data |
| **Env file** | `.env.development` | `.env.production` |
| **Client URL key** | `VITE_SUPABASE_URL_DEV` | `VITE_SUPABASE_URL_PROD` |
| **Client anon key** | `VITE_SUPABASE_ANON_KEY_DEV` | `VITE_SUPABASE_ANON_KEY_PROD` |
| **Service role** | `SUPABASE_SERVICE_ROLE_KEY_DEV` | `SUPABASE_SERVICE_ROLE_KEY_PROD` |
| **Migrations** | Apply all files in `supabase/migrations/` | Same migrations, clean project |

### Setup

1. Create two projects in the [Supabase dashboard](https://supabase.com/dashboard).
2. Copy `.env.development.example` → `.env.development` and fill dev credentials.
3. Copy `.env.production.example` → `.env.production` and fill prod credentials.
4. Link CLI to dev for day-to-day work:

```bash
npx supabase link --project-ref YOUR-DEV-PROJECT-REF
npx supabase db push
```

5. For production, link prod ref once and push (or use CI):

```bash
npx supabase link --project-ref YOUR-PROD-PROJECT-REF
npx supabase db push
```

The app resolves credentials via `src/lib/env.ts` using Vite's `import.meta.env.MODE`.

## Option B — Single project, schema separation

Use when one Supabase project must host both environments (cost constraints, internal tooling).

1. Create schemas in SQL Editor:

```sql
create schema if not exists dev;
create schema if not exists prod;
-- Clone public tables into dev/prod or use search_path in clients
```

2. Set in env files:

```
VITE_SUPABASE_SCHEMA_DEV=dev
VITE_SUPABASE_SCHEMA_PROD=prod
```

3. Run migrations against each schema (adjust `search_path` or duplicate migration sets).

**Tradeoffs:** cheaper, but RLS/auth/storage are shared at the project level — easier to misconfigure. Prefer Option A for production SaaS.

## Client usage

```typescript
import { getSupabaseConfig, isSupabaseConfigured } from "@/src/lib/env";
import { getSupabaseClient } from "@/src/lib/supabase";

if (isSupabaseConfigured()) {
  const supabase = getSupabaseClient();
  // ...
}
```

When Supabase env vars are **not** set, the app continues to use the local Express + `db.json` backend (current default).

## Branching alignment

| Git branch | Vercel / deploy | Supabase project |
|---|---|---|
| `development` | Preview URL | Dev project |
| `main` | Production URL | Prod project |

Never point preview builds at the production database.

## Regenerating types

After migrations on the active project:

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
```
