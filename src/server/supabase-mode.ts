/** True when Vite Supabase env vars are set — local file-db API routes are disabled. */
export function isSupabaseOnlyMode(): boolean {
  const isProd = process.env.NODE_ENV === "production";
  const url =
    (isProd ? process.env.VITE_SUPABASE_URL_PROD : process.env.VITE_SUPABASE_URL_DEV)?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim();
  const anonKey =
    (isProd ? process.env.VITE_SUPABASE_ANON_KEY_PROD : process.env.VITE_SUPABASE_ANON_KEY_DEV)?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && anonKey);
}
