import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={compact ? "h-8 w-8" : "h-9 w-20"} aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  const toggle = () => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={
        compact
          ? "p-2 rounded-lg app-muted hover:bg-[var(--app-hover)] hover:opacity-100 transition-colors cursor-pointer"
          : "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--app-border-strong)] bg-[var(--app-card)] text-[var(--app-fg)] hover:bg-[var(--app-hover)] transition-colors cursor-pointer"
      }
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && <span>{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
}
