import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  useCallback,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Profile } from "../types";
import { getSupabaseClient, clearSupabaseSession } from "../lib/supabase";
import { isSupabaseConfigured } from "../lib/env";
import { fetchProfile, acceptOrganizationInvite, activatePendingInvites } from "../lib/supabase-data";
import {
  fetchAuthMe,
  signInWithApi,
  acceptInviteWithApi,
  type AuthErrorResponse,
} from "../lib/auth-api";

interface LegacySession {
  user: Profile;
  token: string;
}

interface AuthContextType {
  user: Profile | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  acceptInvite: (
    orgId: string,
    email: string,
    password: string,
    fullName: string,
    extras?: { phone?: string; jobTitle?: string; timezone?: string },
  ) => Promise<string>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  completePasswordReset: (password: string, token?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LEGACY_SESSION_KEY = ["auth", "legacy-session"] as const;

async function loadLegacySession(): Promise<LegacySession | null> {
  const storedToken = localStorage.getItem("auth_token");
  if (!storedToken) return null;
  const profile = await fetchAuthMe(storedToken);
  if (!profile) {
    localStorage.removeItem("auth_token");
    return null;
  }
  return { user: profile, token: storedToken };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const supabaseMode = isSupabaseConfigured();

  const [supabaseUser, setSupabaseUser] = useState<Profile | null>(null);
  const [supabaseToken, setSupabaseToken] = useState<string | null>(null);
  const [supabaseLoading, setSupabaseLoading] = useState(supabaseMode);

  const legacySessionQuery = useQuery({
    queryKey: LEGACY_SESSION_KEY,
    queryFn: loadLegacySession,
    enabled: !supabaseMode,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loadSupabaseProfile = useCallback(async (userId: string, accessToken: string | undefined) => {
    const profile = await fetchProfile(userId);
    if (!profile) {
      throw new Error("Your account profile is missing. Contact an administrator.");
    }
    setSupabaseUser(profile);
    setSupabaseToken(accessToken ?? null);
    return profile;
  }, []);

  useEffect(() => {
    if (!supabaseMode) return;
    localStorage.removeItem("auth_token");

    const supabase = getSupabaseClient();
    if (!supabase) {
      setSupabaseLoading(false);
      return;
    }

    let cancelled = false;

    const applySession = async (userId: string, accessToken: string | undefined) => {
      try {
        await loadSupabaseProfile(userId, accessToken);
      } catch (err) {
        console.error("Profile load failed", err);
        clearSupabaseSession();
        setSupabaseUser(null);
        setSupabaseToken(null);
      }
    };

    const clearSession = () => {
      setSupabaseUser(null);
      setSupabaseToken(null);
    };

    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          await applySession(session.user.id, session.access_token);
        } else {
          clearSession();
        }
      } catch (err) {
        console.error("Auth session init failed", err);
        clearSupabaseSession();
        clearSession();
      } finally {
        if (!cancelled) setSupabaseLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION is handled by getSession() above.
      if (event === "INITIAL_SESSION") return;

      void (async () => {
        if (session?.user) {
          await applySession(session.user.id, session.access_token);
        } else {
          clearSession();
        }
      })();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabaseMode, loadSupabaseProfile]);

  const user = supabaseMode ? supabaseUser : (legacySessionQuery.data?.user ?? null);
  const token = supabaseMode ? supabaseToken : (legacySessionQuery.data?.token ?? null);
  const isLoading = supabaseMode ? supabaseLoading : legacySessionQuery.isPending;

  const signIn = async (email: string, password: string) => {
    if (supabaseMode) {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Sign-in is temporarily unavailable. Please try again later.");
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error(
          error.message === "Invalid login credentials"
            ? "Invalid username or password"
            : error.message,
        );
      }
      if (data.user && data.session) {
        const profile = await loadSupabaseProfile(data.user.id, data.session.access_token);
        if (!profile.isAdmin) {
          clearSupabaseSession();
          setSupabaseUser(null);
          setSupabaseToken(null);
          throw new Error("Admin access required. Ask a platform administrator to grant access.");
        }
        await activatePendingInvites();
      }
      return;
    }

    const data = await signInWithApi(email, password);
    localStorage.setItem("auth_token", data.token);
    await queryClient.invalidateQueries({ queryKey: LEGACY_SESSION_KEY });
  };

  const acceptInvite = async (
    orgId: string,
    email: string,
    password: string,
    fullName: string,
    extras?: { phone?: string; jobTitle?: string; timezone?: string },
  ): Promise<string> => {
    if (supabaseMode) {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Sign-in is temporarily unavailable. Please try again later.");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: extras?.phone,
            job_title: extras?.jobTitle,
            timezone: extras?.timezone,
            org_id: orgId,
          },
          emailRedirectTo: `${window.location.origin}/orgs/${orgId}`,
        },
      });
      if (error) throw new Error(error.message || "Could not accept invitation");
      if (data.user && data.session) {
        await loadSupabaseProfile(data.user.id, data.session.access_token);
        await acceptOrganizationInvite(orgId);
        return orgId;
      }
      throw new Error("Check your email to confirm your account, then sign in.");
    }

    const data = await acceptInviteWithApi({
      orgId,
      email,
      password,
      fullName,
      phone: extras?.phone,
      jobTitle: extras?.jobTitle,
      timezone: extras?.timezone,
    });
    localStorage.setItem("auth_token", data.token);
    await queryClient.invalidateQueries({ queryKey: LEGACY_SESSION_KEY });
    return data.orgId;
  };

  const refreshUser = async () => {
    if (supabaseMode) {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await loadSupabaseProfile(session.user.id, session.access_token);
      }
      return;
    }

    await queryClient.invalidateQueries({ queryKey: LEGACY_SESSION_KEY });
  };

  const signOut = useCallback(() => {
    if (supabaseMode) {
      clearSupabaseSession();
      setSupabaseUser(null);
      setSupabaseToken(null);
      return;
    }

    const storedToken = localStorage.getItem("auth_token");
    if (storedToken) {
      fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { Authorization: `Bearer ${storedToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem("auth_token");
    queryClient.setQueryData<LegacySession | null>(LEGACY_SESSION_KEY, null);
  }, [supabaseMode, queryClient]);

  const requestPasswordReset = async (email: string) => {
    if (supabaseMode) {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Sign-in is temporarily unavailable. Please try again later.");
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw new Error(error.message);
      return;
    }

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json()) as AuthErrorResponse;
    if (!res.ok) throw new Error(data.error || "Request failed");
  };

  const completePasswordReset = async (password: string, resetToken?: string) => {
    if (supabaseMode) {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Sign-in is temporarily unavailable. Please try again later.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      clearSupabaseSession();
      setSupabaseUser(null);
      setSupabaseToken(null);
      return;
    }

    if (!resetToken) throw new Error("Invalid or expired reset link");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: resetToken, password }),
    });
    const data = (await res.json()) as AuthErrorResponse;
    if (!res.ok) throw new Error(data.error || "Reset failed");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        signIn,
        acceptInvite,
        signOut,
        refreshUser,
        requestPasswordReset,
        completePasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
