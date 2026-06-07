import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Organization, type OrganizationMember } from "../types";
import { getAuthHeaders, parseError, uploadWithAuth, useSupabaseBackend } from "../lib/api";
import type { z } from "zod";
import type { updateMemberSchema, CreateOrgPayload, UpdateOrgPayload, InviteMemberPayload } from "../types";
import {
  fetchOrganizations,
  fetchOrganization,
  fetchOrganizationMembers,
  invokeCreateOrganization,
  invokeInviteMember,
  updateOrganization as supabaseUpdateOrganization,
  updateMember as supabaseUpdateMember,
  removeMember as supabaseRemoveMember,
} from "../lib/supabase-data";

type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export function useOrganizations() {
  const supabase = useSupabaseBackend();
  return useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: async () => {
      if (supabase) return fetchOrganizations();
      const res = await fetch("/api/organizations", { headers: await getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to fetch organizations");
      return res.json();
    },
  });
}

export function useOrganization(id: string | undefined) {
  const supabase = useSupabaseBackend();
  return useQuery<Organization>({
    queryKey: ["organization", id],
    queryFn: async () => {
      if (!id) throw new Error("Organisation not found");
      if (supabase) return fetchOrganization(id);
      const res = await fetch(`/api/organizations/${id}`, { headers: await getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to fetch organization");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useOrganizationMembers(id: string | undefined) {
  const supabase = useSupabaseBackend();
  return useQuery<OrganizationMember[]>({
    queryKey: ["organization-members", id],
    queryFn: async () => {
      if (!id) throw new Error("Organisation not found");
      if (supabase) return fetchOrganizationMembers(id);
      const res = await fetch(`/api/organizations/${id}/members`, { headers: await getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to fetch members");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseBackend();
  return useMutation<Organization, Error, CreateOrgPayload>({
    mutationFn: async (newOrgData) => {
      if (supabase) return invokeCreateOrganization(newOrgData);
      const res = await fetch("/api/functions/create-organization", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(newOrgData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create organization");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useUpdateOrganization(orgId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = useSupabaseBackend();
  return useMutation<Organization, Error, UpdateOrgPayload>({
    mutationFn: async (body) => {
      if (!orgId) throw new Error("Organisation not found");
      if (supabase) return supabaseUpdateOrganization(orgId, body);
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: await getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      return data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
        queryClient.invalidateQueries({ queryKey: ["organizations"] });
        queryClient.invalidateQueries({ queryKey: ["activity", "org", orgId] });
        queryClient.invalidateQueries({ queryKey: ["activity"] });
      }
    },
  });
}

export function useInviteMember(orgId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = useSupabaseBackend();
  return useMutation<OrganizationMember, Error, InviteMemberPayload>({
    mutationFn: async (payload) => {
      if (!orgId) throw new Error("Organisation not found");
      if (supabase) return invokeInviteMember(orgId, payload);
      const res = await fetch("/api/functions/invite-member", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ orgId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invite failed");
      return data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ["organization-members", orgId] });
        queryClient.invalidateQueries({ queryKey: ["activity", "org", orgId] });
        queryClient.invalidateQueries({ queryKey: ["activity"] });
      }
    },
  });
}

export function useUpdateMember(orgId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = useSupabaseBackend();
  return useMutation<OrganizationMember, Error, { memberId: string; data: UpdateMemberInput }>({
    mutationFn: async ({ memberId, data }) => {
      if (!orgId) throw new Error("Organisation not found");
      if (supabase) return supabaseUpdateMember(orgId, memberId, data);
      const res = await fetch(`/api/organizations/${orgId}/members/${memberId}`, {
        method: "PATCH",
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Member update failed");
      return json;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ["organization-members", orgId] });
        queryClient.invalidateQueries({ queryKey: ["activity", "org", orgId] });
      }
    },
  });
}

export function useRemoveMember(orgId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = useSupabaseBackend();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: async (memberId) => {
      if (!orgId) throw new Error("Organisation not found");
      if (supabase) {
        await supabaseRemoveMember(orgId, memberId);
        return { ok: true };
      }
      const res = await fetch(`/api/organizations/${orgId}/members/${memberId}`, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Remove failed");
      return json;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ["organization-members", orgId] });
        queryClient.invalidateQueries({ queryKey: ["activity", "org", orgId] });
      }
    },
  });
}

export function useUploadOrgLogo(orgId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = useSupabaseBackend();
  return useMutation<{ organization: Organization; url: string }, Error, File>({
    mutationFn: async (file) => {
      if (!orgId) throw new Error("Organisation not found");
      if (supabase) {
        const { uploadOrgLogo } = await import("../lib/supabase-storage");
        return uploadOrgLogo(orgId, file);
      }
      return uploadWithAuth(`/api/organizations/${orgId}/logo`, "file", file);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
        queryClient.invalidateQueries({ queryKey: ["activity", "org", orgId] });
      }
    },
  });
}

export function useUploadOrgBanner(orgId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = useSupabaseBackend();
  return useMutation<{ organization: Organization; url: string }, Error, File>({
    mutationFn: async (file) => {
      if (!orgId) throw new Error("Organisation not found");
      if (supabase) {
        const { uploadOrgBanner } = await import("../lib/supabase-storage");
        return uploadOrgBanner(orgId, file);
      }
      return uploadWithAuth(`/api/organizations/${orgId}/banner`, "file", file);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
        queryClient.invalidateQueries({ queryKey: ["activity", "org", orgId] });
      }
    },
  });
}
