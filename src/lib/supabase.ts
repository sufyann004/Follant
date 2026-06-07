import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./env";

let client: SupabaseClient | null = null;

/**
 * Lazy Supabase browser client. Returns null when env vars are not set
 * (file-db / Express mode continues to work without Supabase).
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;

  const config = getSupabaseConfig();
  if (!config) return null;

  const options =
    config.schema === "public"
      ? { auth: { persistSession: true, autoRefreshToken: true } }
      : {
          auth: { persistSession: true, autoRefreshToken: true },
          db: { schema: config.schema },
        };

  client = createClient(config.url, config.anonKey, options) as SupabaseClient;

  return client;
}

export function resetSupabaseClient(): void {
  client = null;
}
