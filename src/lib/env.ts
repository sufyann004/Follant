/**
 * Environment-aware configuration.
 * Vite exposes `import.meta.env.MODE` as "development" | "production" | "test".
 *
 * Supabase: use separate projects (recommended) via .env.development / .env.production,
 * or a single project with schema separation (see supabase/environments.md).
 */

export type AppEnvironment = "development" | "production" | "test";

export function getAppEnvironment(): AppEnvironment {
  const mode = import.meta.env.MODE;
  if (mode === "production" || mode === "development" || mode === "test") {
    return mode;
  }
  return "development";
}

export function isProduction(): boolean {
  return getAppEnvironment() === "production";
}

export interface SupabaseEnvConfig {
  url: string;
  anonKey: string;
  /** Server / Edge Functions only — never expose in client bundle */
  serviceRoleKey?: string;
  schema: string;
  /** Supabase Storage bucket for avatars, logos, and banners */
  storageBucket: string;
  projectLabel: string;
}

function readEnv(key: string): string | undefined {
  const value = import.meta.env[key];
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  return undefined;
}

/**
 * Resolves Supabase credentials for the current Vite mode.
 *
 * Priority:
 * 1. Mode-specific: VITE_SUPABASE_URL_DEV / _PROD (+ matching anon keys)
 * 2. Generic fallback: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
 */
export function getSupabaseConfig(): SupabaseEnvConfig | null {
  const env = getAppEnvironment();
  const isProd = env === "production";

  const url =
    (isProd ? readEnv("VITE_SUPABASE_URL_PROD") : readEnv("VITE_SUPABASE_URL_DEV")) ??
    readEnv("VITE_SUPABASE_URL") ??
    readEnv("VITE_SUPABASE_URL_DEV") ??
    readEnv("VITE_SUPABASE_URL_PROD");

  const anonKey =
    (isProd ? readEnv("VITE_SUPABASE_ANON_KEY_PROD") : readEnv("VITE_SUPABASE_ANON_KEY_DEV")) ??
    readEnv("VITE_SUPABASE_ANON_KEY") ??
    readEnv("VITE_SUPABASE_ANON_KEY_DEV") ??
    readEnv("VITE_SUPABASE_ANON_KEY_PROD");

  if (!url || !anonKey) {
    return null;
  }

  const schema =
    (isProd ? readEnv("VITE_SUPABASE_SCHEMA_PROD") : readEnv("VITE_SUPABASE_SCHEMA_DEV")) ??
    readEnv("VITE_SUPABASE_SCHEMA") ??
    "public";

  const storageBucket =
    (isProd ? readEnv("VITE_SUPABASE_STORAGE_BUCKET_PROD") : readEnv("VITE_SUPABASE_STORAGE_BUCKET_DEV")) ??
    readEnv("VITE_SUPABASE_STORAGE_BUCKET") ??
    "Pics";

  return {
    url,
    anonKey,
    schema,
    storageBucket,
    projectLabel: isProd ? "production" : "development",
  };
}

/** True when Supabase env vars are present for the active mode. */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}
