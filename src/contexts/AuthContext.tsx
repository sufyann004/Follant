import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { type Profile } from "../types";

interface AuthContextType {
  user: Profile | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync token and verify on mount
  useEffect(() => {
    async function verifyToken() {
      const storedToken = localStorage.getItem("auth_token");
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setToken(storedToken);
        } else {
          // Token expired or invalid, purge
          localStorage.removeItem("auth_token");
        }
      } catch (err) {
        console.error("Auth validation failed", err);
      } finally {
        setIsLoading(false);
      }
    }

    verifyToken();
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await fetch("/api/auth/sign-in", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Invalid username or password");
    }

    localStorage.setItem("auth_token", data.token);
    setUser(data.user);
    setToken(data.token);
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const res = await fetch("/api/auth/sign-up", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, fullName }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Registration failed");
    }

    localStorage.setItem("auth_token", data.token);
    setUser(data.user);
    setToken(data.token);
  };

  const refreshUser = async () => {
    const storedToken = localStorage.getItem("auth_token");
    if (!storedToken) return;
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${storedToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
    }
  };

  const signOut = () => {
    const storedToken = localStorage.getItem("auth_token");
    if (storedToken) {
      fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { Authorization: `Bearer ${storedToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem("auth_token");
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signUp, signOut, refreshUser }}>
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
