import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Organization, type OrganizationMember } from "../types";
import { getAuthHeaders, parseError, uploadWithAuth } from "../lib/api";
import type { z } from "zod";
import type { createOrgSchema, updateOrgSchema, inviteMemberSchema, updateMemberSchema } from "../types";

type CreateOrgInput = z.infer<typeof createOrgSchema>;
type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export function useOrganizations() {
  return useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations", { headers: getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to fetch organizations");
      return res.json();
    },
  });
}

export function useOrganization(id: string | undefined) {
  return useQuery<Organization>({
    queryKey: ["organization", id],
    queryFn: async () => {
      if (!id) throw new Error("Organization ID is required");
      const res = await fetch(`/api/organizations/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to fetch organization");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useOrganizationMembers(id: string | undefined) {
  return useQuery<OrganizationMember[]>({
    queryKey: ["organization-members", id],
    queryFn: async () => {
      if (!id) throw new Error("Organization ID is required");
      const res = await fetch(`/api/organizations/${id}/members`, { headers: getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to fetch members");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation<Organization, Error, CreateOrgInput>({
    mutationFn: async (newOrgData) => {
      const res = await fetch("/api/functions/create-organization", {
        method: "POST",
        headers: getAuthHeaders(),
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
  return useMutation<Organization, Error, UpdateOrgInput>({
    mutationFn: async (body) => {
      if (!orgId) throw new Error("Organization ID missing");
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
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
  return useMutation<OrganizationMember, Error, InviteMemberInput>({
    mutationFn: async (payload) => {
      if (!orgId) throw new Error("Organization ID missing");
      const res = await fetch("/api/functions/invite-member", {
        method: "POST",
        headers: getAuthHeaders(),
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
  return useMutation<OrganizationMember, Error, { memberId: string; data: UpdateMemberInput }>({
    mutationFn: async ({ memberId, data }) => {
      if (!orgId) throw new Error("Organization ID missing");
      const res = await fetch(`/api/organizations/${orgId}/members/${memberId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
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
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: async (memberId) => {
      if (!orgId) throw new Error("Organization ID missing");
      const res = await fetch(`/api/organizations/${orgId}/members/${memberId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
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
  return useMutation<{ organization: Organization; url: string }, Error, File>({
    mutationFn: (file) => {
      if (!orgId) throw new Error("Organization ID missing");
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
  return useMutation<{ organization: Organization; url: string }, Error, File>({
    mutationFn: (file) => {
      if (!orgId) throw new Error("Organization ID missing");
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
