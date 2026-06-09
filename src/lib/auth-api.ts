import type { InvitePreview, Profile } from "../types";
import { isSupabaseConfigured } from "./env";
import { fetchInvitePreviewSupabase } from "./supabase-data";

export interface AuthMeResponse {
  user: Profile;
}

export interface AuthSignInResponse {
  user: Profile;
  token: string;
}

export interface AuthAcceptInviteResponse {
  user: Profile;
  token: string;
  orgId: string;
}

export interface AuthErrorResponse {
  error: string;
}

export async function fetchAuthMe(token: string): Promise<Profile | null> {
  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as AuthMeResponse;
  return data.user;
}

export async function signInWithApi(email: string, password: string): Promise<AuthSignInResponse> {
  const res = await fetch("/api/auth/sign-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as AuthSignInResponse | AuthErrorResponse;
  if (!res.ok) throw new Error("error" in data ? data.error : "Invalid username or password");
  return data as AuthSignInResponse;
}

export async function fetchInvitePreview(orgId: string, email: string): Promise<InvitePreview> {
  if (isSupabaseConfigured()) {
    const preview = await fetchInvitePreviewSupabase(orgId, email);
    if (!preview) throw new Error("This invitation link is invalid or has expired");
    return preview;
  }

  const params = new URLSearchParams({ orgId, email });
  const res = await fetch(`/api/invites/preview?${params.toString()}`);
  const data = (await res.json()) as InvitePreview | AuthErrorResponse;
  if (!res.ok) throw new Error("error" in data ? data.error : "Could not load invitation");
  return data as InvitePreview;
}

export async function acceptInviteWithApi(payload: {
  orgId: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  jobTitle?: string;
  timezone?: string;
}): Promise<AuthAcceptInviteResponse> {
  const res = await fetch("/api/auth/accept-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as AuthAcceptInviteResponse | AuthErrorResponse;
  if (!res.ok) throw new Error("error" in data ? data.error : "Could not accept invitation");
  return data as AuthAcceptInviteResponse;
}
