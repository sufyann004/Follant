import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Organization, type OrganizationMember, type InviteMemberResult } from "../types";
import { getAuthHeaders, parseError, readJsonResponse, useSupabaseBackend } from "../lib/api";
import {
  fetchOrganizations,
  fetchOrganization,
  fetchOrganizationMembers,
  invokeCreateOrganization,
  invokeInviteMember,
  updateOrganization as supabaseUpdateOrganization,
  updateMember as supabaseUpdateMember,
  removeMember as supabaseRemoveMember,
  deleteOrganization as supabaseDeleteOrganization,
} from "../lib/supabase-data";
import type { updateMemberSchema, CreateOrgPayload, UpdateOrgPayload, InviteMemberPayload } from "../types";
import type { z } from "zod";

type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

function buildOptimisticMember(orgId: string, payload: InviteMemberPayload): OrganizationMember {
  const now = new Date().toISOString();
  return {
    id: `pending-${crypto.randomUUID()}`,
    organizationId: orgId,
    email: payload.email,
    userId: null,
    status: "invited",
    role: payload.role ?? "member",
    title: payload.title?.trim() || null,
    department: payload.department?.trim() || null,
    phone: payload.phone?.trim() || null,
    inviteMessage: payload.inviteMessage?.trim() || null,
    invitedBy: null,
    permissions: {},
    accessProfileId: payload.accessProfileId?.trim() || null,
    invitedAt: now,
    joinedAt: null,
    updatedAt: now,
  };
}

export function useOrganizations() {
  const supabase = useSupabaseBackend();
  return useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: async () => {
      if (supabase) return fetchOrganizations();
      const res = await fetch("/api/organizations", { headers: await getAuthHeaders() });
      if (!res.ok) await parseError(res, "Failed to load organizations");
      return readJsonResponse<Organization[]>(res, "Failed to load organizations");
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
      if (!res.ok) await parseError(res, "Failed to load organization");
      return readJsonResponse<Organization>(res, "Failed to load organization");
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
      if (!res.ok) await parseError(res, "Failed to load members");
      return readJsonResponse<OrganizationMember[]>(res, "Failed to load members");
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
      if (!res.ok) await parseError(res, "Failed to create organization");
      return readJsonResponse<Organization>(res, "Failed to create organization");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["statistics"] });
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
      if (!res.ok) await parseError(res, "Failed to update organization");
      return readJsonResponse<Organization>(res, "Failed to update organization");
    },
    onSuccess: (updated) => {
      if (orgId) {
        queryClient.setQueryData(["organization", orgId], updated);
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
  return useMutation<
    InviteMemberResult,
    Error,
    InviteMemberPayload,
    { optimisticId: string; previous?: OrganizationMember[] }
  >({
    mutationFn: async (payload) => {
      if (!orgId) throw new Error("Organisation not found");
      if (supabase) return invokeInviteMember(orgId, payload);
      const res = await fetch("/api/functions/invite-member", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ ...payload, orgId }),
      });
      if (!res.ok) await parseError(res, "Could not save invitation");
      return readJsonResponse<InviteMemberResult>(res, "Could not save invitation");
    },
    onMutate: async (payload) => {
      if (!orgId) return { optimisticId: "" };
      await queryClient.cancelQueries({ queryKey: ["organization-members", orgId] });
      const previous = queryClient.getQueryData<OrganizationMember[]>(["organization-members", orgId]);
      const normalizedEmail = payload.email.toLowerCase().trim();
      const existingIdx = (previous ?? []).findIndex(
        (m) => m.email.toLowerCase() === normalizedEmail && m.status !== "removed"
      );
      if (existingIdx >= 0) {
        const existing = previous![existingIdx];
        const refreshed: OrganizationMember = {
          ...existing,
          status: "invited",
          role: payload.role ?? existing.role,
          title: payload.title?.trim() || existing.title,
          department: payload.department?.trim() || existing.department,
          phone: payload.phone?.trim() || existing.phone,
          inviteMessage: payload.inviteMessage?.trim() || existing.inviteMessage,
          accessProfileId: payload.accessProfileId?.trim() || existing.accessProfileId,
          invitedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<OrganizationMember[]>(["organization-members", orgId], (current) => {
          const list = [...(current ?? [])];
          const idx = list.findIndex((m) => m.id === existing.id);
          if (idx >= 0) list[idx] = refreshed;
          return list;
        });
        return { optimisticId: existing.id, previous };
      }
      const optimistic = buildOptimisticMember(orgId, payload);
      queryClient.setQueryData<OrganizationMember[]>(["organization-members", orgId], (current) => [
        optimistic,
        ...(current ?? []),
      ]);
      return { optimisticId: optimistic.id, previous };
    },
    onSuccess: () => {
      if (!orgId) return;
      queryClient.invalidateQueries({ queryKey: ["organization-members", orgId] });
      queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["statistics"] });
      queryClient.invalidateQueries({ queryKey: ["activity", "org", orgId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: (_err, _payload, context) => {
      if (!orgId) return;
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["organization-members", orgId], context.previous);
        return;
      }
      if (context?.optimisticId) {
        queryClient.setQueryData<OrganizationMember[]>(["organization-members", orgId], (current) =>
          (current ?? []).filter((m) => m.id !== context.optimisticId),
        );
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
      if (!res.ok) await parseError(res, "Failed to update member");
      return readJsonResponse<OrganizationMember>(res, "Failed to update member");
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

export function useRemoveMember(orgId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = useSupabaseBackend();
  return useMutation<void, Error, string>({
    mutationFn: async (memberId) => {
      if (!orgId) throw new Error("Organisation not found");
      if (supabase) return supabaseRemoveMember(orgId, memberId);
      const res = await fetch(`/api/organizations/${orgId}/members/${memberId}`, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });
      if (!res.ok) await parseError(res, "Failed to remove member");
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ["organization-members", orgId] });
        queryClient.invalidateQueries({ queryKey: ["statistics"] });
        queryClient.invalidateQueries({ queryKey: ["activity", "org", orgId] });
        queryClient.invalidateQueries({ queryKey: ["activity"] });
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
      const { uploadWithAuth } = await import("../lib/api");
      return uploadWithAuth(`/api/organizations/${orgId}/logo`, "file", file);
    },
    onSuccess: ({ organization }) => {
      if (orgId) {
        queryClient.setQueryData(["organization", orgId], organization);
        queryClient.invalidateQueries({ queryKey: ["organizations"] });
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
      const { uploadWithAuth } = await import("../lib/api");
      return uploadWithAuth(`/api/organizations/${orgId}/banner`, "file", file);
    },
    onSuccess: ({ organization }) => {
      if (orgId) {
        queryClient.setQueryData(["organization", orgId], organization);
        queryClient.invalidateQueries({ queryKey: ["organizations"] });
      }
    },
  });
}

function useDeleteOrgImage(orgId: string | undefined, kind: "logo" | "banner") {
  const queryClient = useQueryClient();
  const supabase = useSupabaseBackend();
  return useMutation<{ organization: Organization }, Error, void>({
    mutationFn: async () => {
      if (!orgId) throw new Error("Organisation not found");
      if (supabase) {
        const { deleteOrgLogo, deleteOrgBanner } = await import("../lib/supabase-storage");
        return kind === "logo" ? deleteOrgLogo(orgId) : deleteOrgBanner(orgId);
      }
      const res = await fetch(`/api/organizations/${orgId}/${kind}`, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });
      if (!res.ok) await parseError(res, `Could not remove ${kind}`);
      return readJsonResponse<{ organization: Organization }>(res, `Could not remove ${kind}`);
    },
    onSuccess: ({ organization }) => {
      if (orgId) {
        queryClient.setQueryData(["organization", orgId], organization);
        queryClient.invalidateQueries({ queryKey: ["organizations"] });
        queryClient.invalidateQueries({ queryKey: ["activity", "org", orgId] });
        queryClient.invalidateQueries({ queryKey: ["activity"] });
      }
    },
  });
}

export function useDeleteOrgLogo(orgId: string | undefined) {
  return useDeleteOrgImage(orgId, "logo");
}

export function useDeleteOrgBanner(orgId: string | undefined) {
  return useDeleteOrgImage(orgId, "banner");
}

export function useDeleteOrganization(orgId: string | undefined) {
  const queryClient = useQueryClient();
  const supabase = useSupabaseBackend();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!orgId) throw new Error("Organisation not found");
      if (supabase) return supabaseDeleteOrganization(orgId);
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });
      if (!res.ok) await parseError(res, "Failed to delete organisation");
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.removeQueries({ queryKey: ["organization", orgId] });
        queryClient.removeQueries({ queryKey: ["organization-members", orgId] });
        queryClient.removeQueries({ queryKey: ["activity", "org", orgId] });
      }
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["statistics"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}
