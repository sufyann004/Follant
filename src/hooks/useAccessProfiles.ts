import { useQuery } from "@tanstack/react-query";
import type { AccessProfile } from "../types";
import { getAuthHeaders, parseError, useSupabaseBackend } from "../lib/api";
import { fetchAccessProfiles } from "../lib/supabase-data";

export function useAccessProfiles(scope?: "platform" | "organization") {
  const supabase = useSupabaseBackend();
  return useQuery<AccessProfile[]>({
    queryKey: ["access-profiles", scope],
    queryFn: async () => {
      if (supabase) {
        const profiles = await fetchAccessProfiles();
        return scope ? profiles.filter((p) => p.scope === scope) : profiles;
      }
      const qs = scope ? `?scope=${scope}` : "";
      const res = await fetch(`/api/access-profiles${qs}`, { headers: await getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to load access profiles");
      return res.json();
    },
    staleTime: 60_000,
  });
}
