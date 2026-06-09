import { getSupabaseClient } from "./supabase";
import { mapMemberRow, mapOrganizationRow, mapProfileRow, mapActivityLogRow } from "./supabase-mappers";
import type { CreateOrgInput, Organization, OrganizationMember, Profile, UpdateOrgInput, DashboardStats, OrgType, InviteMemberResult, InvitePreview, ActivityLog } from "../types";

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

/** Directory list: organisations visible via RLS (owner, member, or platform admin). */
export async function fetchOrganizations(): Promise<Organization[]> {
  const supabase = requireClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
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

export async function acceptOrganizationInvite(organizationId: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.rpc("accept_organization_invite", {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(error.message);
}

export async function activatePendingInvites(): Promise<number> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc("activate_pending_invites");
  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : 0;
}

export async function fetchInvitePreviewSupabase(
  organizationId: string,
  email: string,
): Promise<InvitePreview | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc("get_invite_preview", {
    p_organization_id: organizationId,
    p_email: email.trim().toLowerCase(),
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") return null;
  const preview = data as Record<string, unknown>;
  return {
    orgId: String(preview.orgId),
    orgName: String(preview.orgName),
    email: String(preview.email),
    role: preview.role as InvitePreview["role"],
    title: preview.title != null ? String(preview.title) : null,
    memberStatus: preview.memberStatus as InvitePreview["memberStatus"],
    accountExists: Boolean(preview.accountExists),
    canRegister: Boolean(preview.canRegister),
    canAcceptWhileSignedIn: Boolean(preview.canAcceptWhileSignedIn),
  };
}

export async function logActivity(params: {
  action: string;
  description: string;
  organizationId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.rpc("log_activity", {
    p_action: params.action,
    p_description: params.description,
    p_organization_id: params.organizationId ?? null,
    p_entity_type: params.entityType ?? null,
    p_entity_id: params.entityId ?? null,
    p_metadata: params.metadata ?? {},
  });
  if (error) console.warn("[log_activity]", error.message);
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

  const org = mapOrganizationRow(data as Record<string, unknown>, count ?? 0);

  void logActivity({
    action: "org.view",
    description: `Viewed organization ${org.name}`,
    organizationId: id,
    entityType: "organization",
    entityId: id,
  });

  return org;
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
  const members = ((data ?? []) as Record<string, unknown>[]).map(mapMemberRow);
  const inviterIds = [...new Set(members.map((m) => m.invitedBy).filter(Boolean))] as string[];
  if (inviterIds.length === 0) return members;

  const { data: inviters, error: inviterError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", inviterIds);
  if (inviterError) throw new Error(inviterError.message);

  const inviterById = new Map(
    (inviters ?? []).map((row) => [
      String(row.id),
      { name: (row.full_name as string | null) ?? null, email: (row.email as string | null) ?? null },
    ]),
  );

  return members.map((m) => {
    const inviter = m.invitedBy ? inviterById.get(m.invitedBy) : undefined;
    return {
      ...m,
      invitedByName: inviter?.name ?? null,
      invitedByEmail: inviter?.email ?? null,
    };
  });
}

export async function invokeCreateOrganization(payload: CreateOrgInput): Promise<Organization> {
  const supabase = requireClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("You must be signed in to create an organisation");

  const { organizationToDbInsert } = await import("./supabase-mappers");
  const row = organizationToDbInsert(user.id, payload as Record<string, unknown>);

  const { data, error } = await supabase.from("organizations").insert(row).select("*").single();
  if (error) {
    const msg = error.message.includes("check constraint")
      ? "Organisation data failed validation — check required fields for the selected type"
      : error.message;
    throw new Error(msg);
  }

  try {
    await logActivity({
      action: "org.create",
      description: `Created organization ${data.name}`,
      organizationId: String(data.id),
      entityType: "organization",
      entityId: String(data.id),
      metadata: { type: data.type },
    });
  } catch {
    // Activity log is best-effort; org creation already succeeded.
  }

  return mapOrganizationRow(data as Record<string, unknown>, 0);
}

export async function invokeInviteMember(
  orgId: string,
  payload: Record<string, unknown>,
): Promise<InviteMemberResult> {
  const supabase = requireClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("You must be signed in to invite members");

  const { data: perms, error: permError } = await supabase.rpc("get_effective_permissions", {
    p_organization_id: orgId,
  });
  if (permError) throw new Error("Permission check failed");
  const canInvite = (perms as { members?: { invite?: boolean } })?.members?.invite === true;
  if (!canInvite) throw new Error("You do not have permission to invite members");

  const email = String(payload.email ?? "")
    .toLowerCase()
    .trim();
  if (!email) throw new Error("Email is required");

  const role = (payload.role as string) ?? "member";
  const { data: existing } = await supabase
    .from("organization_members")
    .select("id, status")
    .eq("organization_id", orgId)
    .eq("email", email)
    .maybeSingle();

  if (existing && existing.status !== "removed") {
    throw new Error("This email has already been invited to this organization");
  }

  const memberPayload: Record<string, unknown> = {
    organization_id: orgId,
    email,
    status: "invited",
    role,
    user_id: null,
    joined_at: null,
    invited_by: user.id,
    title: typeof payload.title === "string" ? payload.title.trim() || null : null,
    department: typeof payload.department === "string" ? payload.department.trim() || null : null,
    phone: typeof payload.phone === "string" ? payload.phone.trim() || null : null,
    invite_message:
      typeof payload.inviteMessage === "string" ? payload.inviteMessage.trim() || null : null,
    invited_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const accessProfileId = typeof payload.accessProfileId === "string" ? payload.accessProfileId.trim() : "";
  if (accessProfileId) {
    memberPayload.access_profile_id = accessProfileId;
  } else {
    const slugByRole: Record<string, string> = {
      admin: "org_admin",
      member: "org_member",
      viewer: "org_viewer",
    };
    const { data: defaultProfile } = await supabase
      .from("access_profiles")
      .select("id")
      .eq("slug", slugByRole[role] ?? "org_member")
      .maybeSingle();
    if (defaultProfile?.id) memberPayload.access_profile_id = defaultProfile.id;
  }

  let memberRow: Record<string, unknown>;
  if (existing?.status === "removed") {
    const { data, error } = await supabase
      .from("organization_members")
      .update(memberPayload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    memberRow = data as Record<string, unknown>;
  } else {
    const { data, error } = await supabase
      .from("organization_members")
      .insert(memberPayload)
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new Error("This email has already been invited to this organization");
      }
      throw new Error(error.message);
    }
    memberRow = data as Record<string, unknown>;
  }

  await logActivity({
    action: "member.invite",
    description: `Invited ${email}`,
    organizationId: orgId,
    entityType: "member",
    entityId: String(memberRow.id),
    metadata: { email, role },
  });

  return {
    ...mapMemberRow(memberRow),
    emailSent: false,
  };
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

export async function deleteOrganization(orgId: string): Promise<void> {
  const supabase = requireClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("You must be signed in to delete an organisation");

  const { data: org, error: readError } = await supabase
    .from("organizations")
    .select("id, name, created_by")
    .eq("id", orgId)
    .single();
  if (readError) throw new Error(readError.message === "JSON object requested, multiple (or no) rows returned"
    ? "Organisation not found"
    : readError.message);

  const isOwner = String(org.created_by) === user.id;
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!isOwner && !profile?.is_admin) {
    throw new Error("You do not have permission to delete this organisation");
  }

  await logActivity({
    action: "org.delete",
    description: `Deleted organisation ${org.name}`,
    organizationId: orgId,
    entityType: "organization",
    entityId: orgId,
    metadata: { name: org.name },
  });

  const { error } = await supabase.from("organizations").delete().eq("id", orgId);
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

export async function fetchActivityLogs(options?: { orgId?: string; action?: string; limit?: number }): Promise<ActivityLog[]> {
  const supabase = requireClient();
  let query = supabase
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.orgId) {
    query = query.eq("organization_id", options.orgId);
  }

  if (options?.action) {
    query = query.eq("action", options.action);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapActivityLogRow) as ActivityLog[];
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
    .select("id, type, created_at");

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

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

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
    organizationsCreatedThisMonth: orgList.filter(
      (o) => new Date(String(o.created_at)).getTime() >= monthStart.getTime(),
    ).length,
  };
}
