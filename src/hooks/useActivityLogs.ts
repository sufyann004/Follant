import { useQuery } from "@tanstack/react-query";
import type { ActivityLog } from "../types";
import { getAuthHeaders, parseError, useSupabaseBackend } from "../lib/api";
import { fetchActivityLogs, fetchActivityActionCatalog } from "../lib/supabase-data";

export function useActivityLogs(filters?: { organizationId?: string; action?: string; limit?: number }) {
  const supabase = useSupabaseBackend();
  return useQuery<ActivityLog[]>({
    queryKey: ["activity", filters],
    queryFn: async () => {
      if (supabase) {
        return fetchActivityLogs({
          orgId: filters?.organizationId,
          action: filters?.action,
          limit: filters?.limit,
        });
      }
      const params = new URLSearchParams();
      if (filters?.organizationId) params.set("organizationId", filters.organizationId);
      if (filters?.action) params.set("action", filters.action);
      if (filters?.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      const res = await fetch(`/api/activity${qs ? `?${qs}` : ""}`, { headers: await getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to load activity");
      return res.json();
    },
  });
}

export function useOrgActivityLogs(orgId: string | undefined) {
  const supabase = useSupabaseBackend();
  return useQuery<ActivityLog[]>({
    queryKey: ["activity", "org", orgId],
    queryFn: async () => {
      if (!orgId) throw new Error("Organization ID required");
      if (supabase) return fetchActivityLogs({ orgId });
      const res = await fetch(`/api/organizations/${orgId}/activity`, { headers: await getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to load organization activity");
      return res.json();
    },
    enabled: !!orgId,
  });
}

export function useActivityActions() {
  const supabase = useSupabaseBackend();
  return useQuery<string[]>({
    queryKey: ["activity", "actions"],
    queryFn: async () => {
      if (supabase) {
        const catalog = await fetchActivityActionCatalog();
        return catalog.map((row) => String(row.action));
      }
      const res = await fetch("/api/activity/actions", { headers: await getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to load actions");
      return res.json();
    },
    staleTime: 60_000,
  });
}
