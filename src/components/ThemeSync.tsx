import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "../contexts/AuthContext";
import type { ThemePreference } from "../types";

const STORAGE_KEY = "theme";

/**
 * Applies profile theme once after sign-in.
 * Does not override an explicit localStorage choice (light/dark) from the theme toggle.
 */
export function ThemeSync() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const syncedForUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      syncedForUserId.current = null;
      return;
    }

    if (syncedForUserId.current === user.id) return;
    syncedForUserId.current = user.id;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      setTheme(stored as ThemePreference);
      return;
    }

    if (user.theme) {
      setTheme(user.theme as ThemePreference);
    }
  }, [user, setTheme]);

  return null;
}
