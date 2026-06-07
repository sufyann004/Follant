import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 Minute caches
      refetchOnWindowFocus: false, // Prevents aggressive background refetches
      retry: 1, // Minimize retry spamming on dev errors
    },
  },
});
