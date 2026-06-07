import { getSupabaseClient } from "./supabase";
import { isSupabaseConfigured } from "./env";

/** Returns the active access token for API calls (Supabase session or legacy file-db token). */
export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
  return localStorage.getItem("auth_token");
}

export async function getAuthHeaders(json = true): Promise<HeadersInit> {
  const token = await getAccessToken();
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function friendlyApiError(message: string): string {
  const m = message.trim();
  if (/RLS|row-level security|violat/i.test(m)) return "You don't have permission to do that.";
  if (/supabase is not configured/i.test(m)) return "Sign-in is temporarily unavailable. Please try again later.";
  if (/^unauthorized$|^forbidden:/i.test(m)) return "You don't have permission to do that.";
  if (/conflict:/i.test(m)) return m.replace(/^conflict:\s*/i, "");
  return m;
}

export async function parseError(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  const raw = (data as { error?: string }).error || fallback;
  throw new Error(friendlyApiError(raw));
}

export async function uploadWithAuth(url: string, fieldName: string, file: File) {
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(url, {
    method: "POST",
    headers: await getAuthHeaders(false),
    body: form,
  });
  if (!res.ok) await parseError(res, "Upload failed");
  return res.json();
}

export function useSupabaseBackend(): boolean {
  return isSupabaseConfigured();
}
