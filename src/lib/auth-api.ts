import type { Profile } from "../types";

export interface AuthMeResponse {
  user: Profile;
}

export interface AuthSignInResponse {
  user: Profile;
  token: string;
}

export interface AuthSignUpResponse {
  user: Profile;
  token: string;
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

export async function signUpWithApi(payload: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  jobTitle?: string;
  timezone?: string;
}): Promise<AuthSignUpResponse> {
  const res = await fetch("/api/auth/sign-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as AuthSignUpResponse | AuthErrorResponse;
  if (!res.ok) throw new Error("error" in data ? data.error : "Registration failed");
  return data as AuthSignUpResponse;
}
