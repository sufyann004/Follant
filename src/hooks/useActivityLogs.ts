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
        const rows = await fetchActivityLogs({
          orgId: filters?.organizationId,
          limit: filters?.limit,
        });
        return rows.map((row) => ({
          id: String(row.id),
          userId: String(row.user_id),
          organizationId: (row.organization_id as string | null) ?? null,
          action: row.action,
          entityType: (row.entity_type as string | null) ?? null,
          entityId: (row.entity_id as string | null) ?? null,
          description: row.description,
          metadata: (row.metadata as Record<string, unknown>) ?? {},
          ipAddress: (row.ip_address as string | null) ?? null,
          userAgent: (row.user_agent as string | null) ?? null,
          createdAt: String(row.created_at),
        })) as ActivityLog[];
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
      if (supabase) {
        const rows = await fetchActivityLogs({ orgId });
        return rows.map((row) => ({
          id: String(row.id),
          userId: String(row.user_id),
          organizationId: (row.organization_id as string | null) ?? null,
          action: row.action,
          entityType: (row.entity_type as string | null) ?? null,
          entityId: (row.entity_id as string | null) ?? null,
          description: row.description,
          metadata: (row.metadata as Record<string, unknown>) ?? {},
          createdAt: String(row.created_at),
        })) as ActivityLog[];
      }
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
