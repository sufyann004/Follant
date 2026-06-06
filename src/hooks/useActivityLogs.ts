import { useQuery } from "@tanstack/react-query";
import type { ActivityLog } from "../types";
import { getAuthHeaders, parseError } from "../lib/api";

export function useActivityLogs(filters?: { organizationId?: string; action?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.organizationId) params.set("organizationId", filters.organizationId);
  if (filters?.action) params.set("action", filters.action);
  if (filters?.limit) params.set("limit", String(filters.limit));

  return useQuery<ActivityLog[]>({
    queryKey: ["activity", filters],
    queryFn: async () => {
      const qs = params.toString();
      const res = await fetch(`/api/activity${qs ? `?${qs}` : ""}`, { headers: getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to load activity");
      return res.json();
    },
  });
}

export function useOrgActivityLogs(orgId: string | undefined) {
  return useQuery<ActivityLog[]>({
    queryKey: ["activity", "org", orgId],
    queryFn: async () => {
      if (!orgId) throw new Error("Organization ID required");
      const res = await fetch(`/api/organizations/${orgId}/activity`, { headers: getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to load organization activity");
      return res.json();
    },
    enabled: !!orgId,
  });
}

export function useActivityActions() {
  return useQuery<string[]>({
    queryKey: ["activity", "actions"],
    queryFn: async () => {
      const res = await fetch("/api/activity/actions", { headers: getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to load actions");
      return res.json();
    },
    staleTime: 60_000,
  });
}
