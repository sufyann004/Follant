import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "../types";
import { getAuthHeaders, parseError, readJsonResponse, useSupabaseBackend } from "../lib/api";
import { fetchDashboardStats } from "../lib/supabase-data";

export function useStatistics() {
  const supabase = useSupabaseBackend();
  return useQuery<DashboardStats>({
    queryKey: ["statistics"],
    queryFn: async () => {
      if (supabase) return fetchDashboardStats();
      const res = await fetch("/api/statistics", { headers: await getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to load statistics");
      return readJsonResponse<DashboardStats>(res, "Failed to load statistics");
    },
  });
}
