# ImpactOp — change log & implementation notes

This file records incremental changes made to the project. Use it as source material when updating the main `README.md` or onboarding docs.

---

## 2026-06-07 — Dark mode, query states, Supabase environments

### 1. Dark mode (`next-themes`)

**Goal:** System-aware light/dark theme with persistence via user preferences.

**Dependencies added**

- `next-themes`

**New files**

| File | Purpose |
|---|---|
| `src/components/ThemeProvider.tsx` | Wraps app with `ThemeProvider` (`attribute="class"`, `defaultTheme="system"`) |
| `src/components/ThemeSync.tsx` | Applies signed-in user's `profile.theme` to next-themes on load |
| `src/components/ThemeToggle.tsx` | Cycles light → dark → system; compact mode for sidebar |

**Modified files**

| File | Change |
|---|---|
| `src/App.tsx` | Wrapped tree in `ThemeProvider`; mounted `ThemeSync` inside `AuthProvider` |
| `src/index.css` | Added `@custom-variant dark` for class-based dark mode; semantic classes: `.app-page`, `.app-card`, `.app-heading`, `.app-muted`, `.app-input`, `.app-shell-main` |
| `src/components/AppShell.tsx` | Theme toggle in desktop sidebar footer and mobile menu |
| `src/pages/AccountSettingsPage.tsx` | On "Save preferences", calls `setTheme()` alongside API update |
| `src/pages/SignInPage.tsx`, `SignUpPage.tsx` | Use `.app-page` / `.app-card` for dark-safe auth layout |
| `src/pages/OrgDirectoryPage.tsx` | Dark variants on badges and cards |
| `src/pages/ActivityLogPage.tsx` | Dark variants on table and severity chips |

**How it works**

1. `next-themes` toggles `class="dark"` on `<html>`.
2. Tailwind v4 uses `@custom-variant dark (&:where(.dark, .dark *))`.
3. User preference (`light` | `dark` | `system`) is stored in `profiles.theme` (file DB today) and synced on login via `ThemeSync`.
4. Sidebar **ThemeToggle** and **Account → Preferences → Theme** both update the active theme.

---

### 2. Loading / empty / error state pattern

**Goal:** One consistent pattern for React Query–backed pages.

**New file:** `src/components/QueryState.tsx`

| Export | Use |
|---|---|
| `LoadingState` | Variants: `page`, `inline`, `skeleton` |
| `ErrorState` | Title, message, optional retry + custom action |
| `EmptyState` | Icon, title, description, optional CTA |
| `QueryState<T>` | Wrapper: loading → error → empty → `children(data)` |

**Pages updated**

| Page | Pattern |
|---|---|
| `ProtectedLayout.tsx` | `LoadingState` while auth token validates |
| `OrgDirectoryPage.tsx` | Full `QueryState` + `EmptyState` for filtered list |
| `OrgDetailPage.tsx` | `LoadingState` (skeleton) + `ErrorState` with retry |
| `ActivityLogPage.tsx` | `QueryState` + inline `EmptyState` for zero/filtered rows |

**Convention for new pages**

```tsx
const { data, isLoading, isError, error, refetch } = useMyQuery();

return (
  <QueryState
    isLoading={isLoading}
    isError={isError}
    error={error}
    data={data}
    loadingVariant="skeleton"
    onRetry={() => refetch()}
  >
    {(items) => items.length === 0 ? (
      <EmptyState title="…" description="…" />
    ) : (
      /* render items */
    )}
  </QueryState>
);
```

Prefer semantic surface classes (`.app-card`, `.app-muted`) so dark mode stays consistent.

---

### 3. Supabase development vs production

**Goal:** Clear separation of dev and prod Supabase credentials without breaking the current file-DB demo mode.

**Dependencies added**

- `@supabase/supabase-js`

**New files**

| File | Purpose |
|---|---|
| `src/lib/env.ts` | Resolves Supabase URL/anon key/schema by `import.meta.env.MODE` |
| `src/lib/supabase.ts` | Lazy `createClient()`; returns `null` if env not configured |
| `supabase/environments.md` | Two-project vs schema-separation guide |
| `.env.development.example` | Dev-only Supabase vars |
| `.env.production.example` | Prod-only Supabase vars |

**Modified files**

| File | Change |
|---|---|
| `.env.example` | Documented `*_DEV` / `*_PROD` client vars and server-only service role keys |

**Environment variable reference**

| Variable | Scope | When used |
|---|---|---|
| `VITE_SUPABASE_URL_DEV` | Browser | `import.meta.env.MODE === "development"` |
| `VITE_SUPABASE_ANON_KEY_DEV` | Browser | Dev mode |
| `VITE_SUPABASE_URL_PROD` | Browser | Production builds |
| `VITE_SUPABASE_ANON_KEY_PROD` | Browser | Production builds |
| `VITE_SUPABASE_SCHEMA_DEV` / `_PROD` | Browser | Optional schema override (single-project setup) |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Browser | Fallback if mode-specific vars omitted |
| `SUPABASE_SERVICE_ROLE_KEY_*` | Server / CLI only | Never `VITE_` prefix |

**Runtime behavior**

- If Supabase env vars are missing → app keeps using Express + `db.json` (no breaking change).
- If configured → `getSupabaseClient()` returns a typed client; wire hooks when migrating off file DB.

---

### 4. Package.json changes

```json
"dependencies": {
  "next-themes": "^…",
  "@supabase/supabase-js": "^…"
}
```

---

### 5. Follow-up (not done in this pass)

- [ ] Migrate React Query hooks from `/api/*` to Supabase client + RLS
- [ ] Add `src/lib/database.types.ts` from `supabase gen types`
- [ ] Extend dark mode to every form field in `CreateOrgPage` / `OrgDetailPage` (use `.app-input`)
- [ ] Deploy Edge Functions for `create-organization` and `invite-member`
- [ ] Add Playwright tests for theme toggle and query-state error retry
- [ ] Consolidate README with this file (stack description still mentions Supabase-only path)

---

## 2026-06-07 (b) — Dark mode fix: pure black / white + reliable toggle

### Problems fixed

1. **Theme not switching** — `ThemeSync` was calling `setTheme(user.theme)` on every login and overwriting the sidebar toggle (especially when profile had `theme: "system"`).
2. **Incomplete dark styling** — Many pages used hardcoded `bg-white` / `text-slate-900` without dark variants.
3. **Wrong dark palette** — Used `slate-950` instead of true black/white contrast.

### Solution

**CSS variables** in `src/index.css` (not Tailwind `dark:` alone):

| Token | Light | Dark |
|---|---|---|
| `--app-bg` | `#ffffff` | `#000000` |
| `--app-fg` | `#0f172a` | `#ffffff` |
| `--app-card` | `#ffffff` | `#0a0a0a` |
| `--app-muted` | `#64748b` | `#a3a3a3` |

Applied to `html`, `body`, `#root`, and semantic classes (`.app-page`, `.app-card`, `.app-input`, `.app-btn-primary`, etc.).

**Blocking script** in `index.html` — sets `html.dark` before React paints (prevents flash + ensures class is present).

**Theme toggle** — Simple light ↔ dark (no system cycle in UI). Writes to `localStorage.theme` immediately.

**ThemeSync** — Runs once per user session. Skips profile sync if `localStorage.theme` is already `light` or `dark`.

**Pages updated** for variable-based surfaces: `OrgDetailPage`, `CreateOrgPage`, `ActivityLogPage`, `QueryState`, auth pages, `AccountSettingsPage`.

### How to verify

1. `npm run dev` → sign in
2. Click moon/sun icon in sidebar → background should flip **white ↔ pure black**, text **dark ↔ white**
3. Refresh page → choice should persist
4. Account → Preferences → Theme → Save should also persist


```bash
npm install
npm run dev
# Sign in: admin@example.com / Password123!
# Toggle theme via sidebar or Account → Preferences
# Visit /orgs — skeleton while loading; empty state if filtered to zero
```

```bash
npm run lint   # tsc --noEmit
```

## 2026-06-07 (c) — Monochrome theme (no blue/indigo in dark mode)

### Goal

Remove blue/indigo tints from dark mode (and unify light mode) so both themes use a **black/white/gray** palette with semantic tokens only.

### CSS (`src/index.css`)

- Expanded semantic utilities: `.text-app-heading`, `.app-card-hover`, `.app-tabs-bar`, `.app-nav-settings-active`, `.app-textarea`, `.app-media-border`, severity pills (`.app-severity-*`), type selectors (`.app-type-option*`), `.app-info-panel`
- Dark mode severity/notice badges use neutral grays instead of blue
- `--app-accent` is black (light) / white (dark) — no indigo focus rings

### Components & pages updated

| Area | Changes |
|---|---|
| `AppShell.tsx` | Neutral sidebar, white active nav pill, monochrome avatar |
| `ThemeToggle.tsx` | Compact mode uses CSS variables instead of `slate-*` |
| `SignInPage`, `SignUpPage` | `app-input`, `app-btn-primary`, `app-callout`, `app-icon-brand` |
| `OrgDirectoryPage` | Neutral type badges, no indigo card hovers |
| `OrgDetailPage` | Monochrome tabs, invite panel, member status pills, activity severity |
| `CreateOrgPage` | `app-type-option` radios, semantic form fields |
| `AccountSettingsPage` | Monochrome nav tabs, avatar fallback, session cards |
| `ActivityLogPage` | Admin banner and severity chips without blue |

### Verify

1. Toggle dark mode — background `#000`, text white, **no blue/indigo** on nav, buttons, badges, or focus states
2. Light mode — white background, dark text, same monochrome accents
3. Check `/sign-in`, `/orgs`, `/orgs/:id`, `/orgs/new`, `/account`, `/activity` in both themes

