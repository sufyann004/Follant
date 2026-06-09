import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Profile, UserSession } from "../types";
import { getAuthHeaders, parseError, uploadWithAuth, useSupabaseBackend } from "../lib/api";
import { getSupabaseClient, clearSupabaseSession } from "../lib/supabase";
import { updateProfile as supabaseUpdateProfile } from "../lib/supabase-data";
import type { UpdateProfilePayload, updatePreferencesSchema, changePasswordSchema } from "../types";
import type { z } from "zod";

type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export function useSessions() {
  const supabase = useSupabaseBackend();
  return useQuery<UserSession[]>({
    queryKey: ["account", "sessions"],
    queryFn: async () => {
      if (supabase) return [];
      const res = await fetch("/api/account/sessions", { headers: await getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to load sessions");
      return res.json();
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseBackend();
  return useMutation<{ user: Profile }, Error, UpdateProfilePayload>({
    mutationFn: async (body) => {
      if (supabase) {
        const client = getSupabaseClient();
        const userId = (await client?.auth.getUser())?.data.user?.id;
        if (!userId) throw new Error("Not authenticated");
        const user = await supabaseUpdateProfile(userId, body);
        return { user };
      }
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: await getAuthHeaders(),
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
  const supabase = useSupabaseBackend();
  return useMutation<{ user: Profile }, Error, UpdatePreferencesInput>({
    mutationFn: async (body) => {
      if (supabase) {
        const client = getSupabaseClient();
        const userId = (await client?.auth.getUser())?.data.user?.id;
        if (!userId) throw new Error("Not authenticated");
        const user = await supabaseUpdateProfile(userId, body);
        return { user };
      }
      const res = await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: await getAuthHeaders(),
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
  const supabase = useSupabaseBackend();
  return useMutation<{ ok: boolean }, Error, ChangePasswordInput>({
    mutationFn: async (body) => {
      if (supabase) {
        const client = getSupabaseClient();
        if (!client) throw new Error("Sign-in is temporarily unavailable. Please try again later.");
        const {
          data: { user },
          error: userError,
        } = await client.auth.getUser();
        if (userError || !user?.email) throw new Error("Not authenticated");

        const { error: verifyError } = await client.auth.signInWithPassword({
          email: user.email,
          password: body.currentPassword,
        });
        if (verifyError) throw new Error("Current password is incorrect");

        const { error } = await client.auth.updateUser({ password: body.newPassword });
        if (error) throw new Error(error.message);
        return { ok: true };
      }
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) await parseError(res, "Password change failed");
      return res.json();
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseBackend();
  return useMutation<{ user: Profile; url: string }, Error, File>({
    mutationFn: async (file) => {
      if (supabase) {
        const { uploadAvatar } = await import("../lib/supabase-storage");
        return uploadAvatar(file);
      }
      return uploadWithAuth("/api/account/avatar", "file", file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useDeleteAvatar() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseBackend();
  return useMutation<{ user: Profile }, Error, void>({
    mutationFn: async () => {
      if (supabase) {
        const { deleteAvatar } = await import("../lib/supabase-storage");
        return deleteAvatar();
      }
      const res = await fetch("/api/account/avatar", {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });
      if (!res.ok) await parseError(res, "Could not remove avatar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "legacy-session"] });
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
        headers: await getAuthHeaders(),
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
  const supabase = useSupabaseBackend();
  return useMutation<{ ok: boolean }, Error, void>({
    mutationFn: async () => {
      if (supabase) {
        const client = getSupabaseClient();
        const userId = (await client?.auth.getUser())?.data.user?.id;
        if (!userId || !client) throw new Error("Not authenticated");
        const { error } = await client
          .from("profiles")
          .update({ account_status: "deactivated", updated_at: new Date().toISOString() })
          .eq("id", userId);
        if (error) throw new Error(error.message);
        clearSupabaseSession();
        return { ok: true };
      }
      const res = await fetch("/api/account/deactivate", {
        method: "POST",
        headers: await getAuthHeaders(),
      });
      if (!res.ok) await parseError(res, "Deactivation failed");
      return res.json();
    },
  });
}
