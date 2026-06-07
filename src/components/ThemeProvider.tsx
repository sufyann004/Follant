import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode, FC, PropsWithChildren } from "react";

const ThemesProvider = NextThemesProvider as FC<
  PropsWithChildren<{
    attribute?: "class" | "data-theme" | "data-mode";
    defaultTheme?: string;
    enableSystem?: boolean;
    disableTransitionOnChange?: boolean;
    storageKey?: string;
  }>
>;

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      storageKey="theme"
      disableTransitionOnChange
    >
      {children}
    </ThemesProvider>
  );
}
