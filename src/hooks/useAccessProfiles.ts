import { useQuery } from "@tanstack/react-query";
import type { AccessProfile } from "../types";
import { getAuthHeaders, parseError } from "../lib/api";

export function useAccessProfiles(scope?: "platform" | "organization") {
  return useQuery<AccessProfile[]>({
    queryKey: ["access-profiles", scope],
    queryFn: async () => {
      const qs = scope ? `?scope=${scope}` : "";
      const res = await fetch(`/api/access-profiles${qs}`, { headers: getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to load access profiles");
      return res.json();
    },
    staleTime: 60_000,
  });
}
