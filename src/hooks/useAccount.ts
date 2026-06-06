import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Profile, UserSession } from "../types";
import { getAuthHeaders, parseError, uploadWithAuth } from "../lib/api";
import type { z } from "zod";
import type { updateProfileSchema, updatePreferencesSchema, changePasswordSchema } from "../types";

type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export function useSessions() {
  return useQuery<UserSession[]>({
    queryKey: ["account", "sessions"],
    queryFn: async () => {
      const res = await fetch("/api/account/sessions", { headers: getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to load sessions");
      return res.json();
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation<{ user: Profile }, Error, UpdateProfileInput>({
    mutationFn: async (body) => {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) await parseError(res, "Profile update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation<{ user: Profile }, Error, UpdatePreferencesInput>({
    mutationFn: async (body) => {
      const res = await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) await parseError(res, "Preferences update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export function useChangePassword() {
  return useMutation<{ ok: boolean }, Error, ChangePasswordInput>({
    mutationFn: async (body) => {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) await parseError(res, "Password change failed");
      return res.json();
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation<{ user: Profile; url: string }, Error, File>({
    mutationFn: (file) => uploadWithAuth("/api/account/avatar", "file", file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: async (sessionId) => {
      const res = await fetch(`/api/account/sessions/${sessionId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) await parseError(res, "Failed to revoke session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account", "sessions"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useDeactivateAccount() {
  return useMutation<{ ok: boolean }, Error, void>({
    mutationFn: async () => {
      const res = await fetch("/api/account/deactivate", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) await parseError(res, "Deactivation failed");
      return res.json();
    },
  });
}
