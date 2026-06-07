import { getSupabaseClient } from "./supabase";
import { mapMemberRow, mapOrganizationRow, mapProfileRow } from "./supabase-mappers";
import type { CreateOrgInput, Organization, OrganizationMember, Profile, UpdateOrgInput, DashboardStats, OrgType } from "../types";

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapProfileRow(data as Record<string, unknown>);
}

/** Directory list: organizations created by the signed-in admin (FR #4). */
export async function fetchOrganizations(): Promise<Organization[]> {
  const supabase = requireClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const orgs = (data ?? []) as Record<string, unknown>[];
  if (orgs.length === 0) return [];

  const orgIds = orgs.map((o) => String(o.id));
  const { data: memberRows, error: memberError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .in("organization_id", orgIds)
    .neq("status", "removed");

  if (memberError) throw new Error(memberError.message);

  const countByOrg = new Map<string, number>();
  for (const row of memberRows ?? []) {
    const orgId = String((row as { organization_id: string }).organization_id);
    countByOrg.set(orgId, (countByOrg.get(orgId) ?? 0) + 1);
  }

  return orgs.map((org) => mapOrganizationRow(org, countByOrg.get(String(org.id)) ?? 0));
}

export async function fetchOrganization(id: string): Promise<Organization> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("organizations").select("*").eq("id", id).single();
  if (error) throw new Error(error.message === "JSON object requested, multiple (or no) rows returned"
    ? "Organization not found"
    : error.message);

  const { count } = await supabase
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", id)
    .neq("status", "removed");

  return mapOrganizationRow(data as Record<string, unknown>, count ?? 0);
}

export async function fetchOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", orgId)
    .neq("status", "removed")
    .order("invited_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapMemberRow);
}

export async function invokeCreateOrganization(payload: CreateOrgInput): Promise<Organization> {
  const supabase = requireClient();
  const { data, error } = await supabase.functions.invoke("create-organization", { body: payload });
  if (error) throw new Error(error.message);
  const body = data as { error?: string } & Record<string, unknown>;
  if (body?.error) throw new Error(body.error);
  return mapOrganizationRow(body);
}

export async function invokeInviteMember(
  orgId: string,
  payload: Record<string, unknown>,
): Promise<OrganizationMember> {
  const supabase = requireClient();
  const { data, error } = await supabase.functions.invoke("invite-member", {
    body: { orgId, ...payload },
  });
  if (error) throw new Error(error.message);
  const body = data as { error?: string } & Record<string, unknown>;
  if (body?.error) throw new Error(body.error);
  return mapMemberRow(body);
}

export async function updateOrganization(orgId: string, payload: UpdateOrgInput): Promise<Organization> {
  const supabase = requireClient();
  const { organizationToDbUpdate } = await import("./supabase-mappers");
  const { data, error } = await supabase
    .from("organizations")
    .update(organizationToDbUpdate(payload as Record<string, unknown>))
    .eq("id", orgId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapOrganizationRow(data as Record<string, unknown>);
}

export async function updateMember(
  orgId: string,
  memberId: string,
  payload: Record<string, unknown>,
): Promise<OrganizationMember> {
  const supabase = requireClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.role !== undefined) update.role = payload.role;
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.title !== undefined) update.title = payload.title || null;
  if (payload.department !== undefined) update.department = payload.department || null;
  if (payload.phone !== undefined) update.phone = payload.phone || null;
  if (payload.accessProfileId !== undefined) {
    update.access_profile_id = payload.accessProfileId || null;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .update(update)
    .eq("id", memberId)
    .eq("organization_id", orgId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapMemberRow(data as Record<string, unknown>);
}

export async function removeMember(orgId: string, memberId: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from("organization_members")
    .update({ status: "removed", updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("organization_id", orgId);

  if (error) throw new Error(error.message);
}

export async function updateProfile(userId: string, payload: Record<string, unknown>): Promise<Profile> {
  const supabase = requireClient();
  const { profileToDbUpdate } = await import("./supabase-mappers");
  const { data, error } = await supabase
    .from("profiles")
    .update(profileToDbUpdate(payload))
    .eq("id", userId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapProfileRow(data as Record<string, unknown>);
}

export async function fetchActivityLogs(options?: { orgId?: string; limit?: number }) {
  const supabase = requireClient();
  let query = supabase
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.orgId) {
    query = query.eq("organization_id", options.orgId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAccessProfiles() {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("access_profiles")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description,
    scope: row.scope,
    permissions: row.permissions,
    sortOrder: row.sort_order,
  }));
}

export async function fetchActivityActionCatalog() {
  const supabase = requireClient();
  const { data, error } = await supabase.from("activity_action_catalog").select("*").order("action");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const supabase = requireClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data: orgs, error: orgError } = await supabase
    .from("organizations")
    .select("id, type, created_at")
    .eq("created_by", user.id);

  if (orgError) throw new Error(orgError.message);

  const orgList = orgs ?? [];
  const orgIds = orgList.map((o) => String(o.id));

  let members: { status: string }[] = [];
  if (orgIds.length > 0) {
    const { data: memberRows, error: memberError } = await supabase
      .from("organization_members")
      .select("status")
      .in("organization_id", orgIds)
      .neq("status", "removed");
    if (memberError) throw new Error(memberError.message);
    members = memberRows ?? [];
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: activityCount, error: activityError } = await supabase
    .from("activity_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", sevenDaysAgo);

  if (activityError) throw new Error(activityError.message);

  const organizationsByType = { school: 0, nonprofit: 0, business: 0 } as Record<OrgType, number>;
  for (const org of orgList) {
    const type = org.type as OrgType;
    if (type in organizationsByType) organizationsByType[type] += 1;
  }

  return {
    totalOrganizations: orgList.length,
    totalMembers: members.length,
    activeMembers: members.filter((m) => m.status === "active").length,
    pendingInvites: members.filter((m) => m.status === "invited").length,
    organizationsByType,
    activityLast7Days: activityCount ?? 0,
    organizationsCreatedThisMonth: orgList.filter(
      (o) => new Date(String(o.created_at)).getTime() >= monthStart.getTime(),
    ).length,
  };
}
