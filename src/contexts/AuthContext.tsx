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
import { getSupabaseClient } from "../lib/supabase";
import { isSupabaseConfigured } from "../lib/env";
import { fetchProfile } from "../lib/supabase-data";
import {
  fetchAuthMe,
  signInWithApi,
  signUpWithApi,
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
  signUp: (
    email: string,
    password: string,
    fullName: string,
    extras?: { phone?: string; jobTitle?: string; timezone?: string },
  ) => Promise<void>;
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
    if (profile) {
      setSupabaseUser(profile);
      setSupabaseToken(accessToken ?? null);
    }
  }, []);

  useEffect(() => {
    if (!supabaseMode) return;

    const supabase = getSupabaseClient();
    if (!supabase) {
      setSupabaseLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        try {
          await loadSupabaseProfile(session.user.id, session.access_token);
        } catch (err) {
          console.error("Profile load failed", err);
          setSupabaseUser(null);
          setSupabaseToken(null);
        }
      } else {
        setSupabaseUser(null);
        setSupabaseToken(null);
      }
      setSupabaseLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setSupabaseLoading(false);
    });

    return () => subscription.unsubscribe();
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
        await loadSupabaseProfile(data.user.id, data.session.access_token);
      }
      return;
    }

    const data = await signInWithApi(email, password);
    localStorage.setItem("auth_token", data.token);
    await queryClient.invalidateQueries({ queryKey: LEGACY_SESSION_KEY });
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    extras?: { phone?: string; jobTitle?: string; timezone?: string },
  ) => {
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
          },
        },
      });
      if (error) throw new Error(error.message || "Registration failed");
      if (data.user && data.session) {
        await loadSupabaseProfile(data.user.id, data.session.access_token);
      } else if (data.user) {
        throw new Error("Check your email to confirm your account, then sign in.");
      }
      return;
    }

    const data = await signUpWithApi({
      email,
      password,
      fullName,
      phone: extras?.phone,
      jobTitle: extras?.jobTitle,
      timezone: extras?.timezone,
    });
    localStorage.setItem("auth_token", data.token);
    await queryClient.invalidateQueries({ queryKey: LEGACY_SESSION_KEY });
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

  const signOut = () => {
    if (supabaseMode) {
      const supabase = getSupabaseClient();
      supabase?.auth.signOut().catch(() => {});
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
  };

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
      await supabase.auth.signOut();
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
        signUp,
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
