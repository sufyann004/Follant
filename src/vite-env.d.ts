/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_URL_DEV?: string;
  readonly VITE_SUPABASE_ANON_KEY_DEV?: string;
  readonly VITE_SUPABASE_URL_PROD?: string;
  readonly VITE_SUPABASE_ANON_KEY_PROD?: string;
  readonly VITE_SUPABASE_SCHEMA?: string;
  readonly VITE_SUPABASE_SCHEMA_DEV?: string;
  readonly VITE_SUPABASE_SCHEMA_PROD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
