import type { Organization, OrganizationMember, Profile } from "../types";

export function mapProfileRow(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    fullName: String(row.full_name ?? "User"),
    isAdmin: Boolean(row.is_admin),
    phone: (row.phone as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    jobTitle: (row.job_title as string | null) ?? null,
    department: (row.department as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    timezone: String(row.timezone ?? "Europe/London"),
    locale: String(row.locale ?? "en-GB"),
    theme: (row.theme as Profile["theme"]) ?? "system",
    accountStatus: (row.account_status as Profile["accountStatus"]) ?? "active",
    notifyEmail: row.notify_email !== false,
    notifyPush: row.notify_push !== false,
    notifySms: Boolean(row.notify_sms),
    notifyMarketing: Boolean(row.notify_marketing),
    twoFactorEnabled: Boolean(row.two_factor_enabled),
    lastLoginAt: (row.last_login_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapOrganizationRow(row: Record<string, unknown>, memberCount?: number): Organization {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: (row.slug as string | null) ?? null,
    type: row.type as Organization["type"],
    description: (row.description as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    contactEmail: (row.contact_email as string | null) ?? null,
    contactPhone: (row.contact_phone as string | null) ?? null,
    logoUrl: (row.logo_url as string | null) ?? null,
    bannerUrl: (row.banner_url as string | null) ?? null,
    status: (row.status as Organization["status"]) ?? "active",
    createdBy: String(row.created_by),
    addressLine1: (row.address_line1 as string | null) ?? null,
    addressLine2: (row.address_line2 as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    stateRegion: (row.state_region as string | null) ?? null,
    postalCode: (row.postal_code as string | null) ?? null,
    country: (row.country as string | null) ?? "GB",
    timezone: String(row.timezone ?? "Europe/London"),
    locale: String(row.locale ?? "en-GB"),
    currency: String(row.currency ?? "GBP"),
    tags: (row.tags as string[]) ?? [],
    settings: (row.settings as Record<string, unknown>) ?? {},
    schoolDistrict: (row.school_district as string | null) ?? null,
    schoolGradeLevels: (row.school_grade_levels as string | null) ?? null,
    schoolAccreditation: (row.school_accreditation as string | null) ?? null,
    schoolStudentCount: (row.school_student_count as number | null) ?? null,
    nonprofitEin: (row.nonprofit_ein as string | null) ?? null,
    nonprofitTaxStatus: (row.nonprofit_tax_status as string | null) ?? null,
    nonprofitMission: (row.nonprofit_mission as string | null) ?? null,
    nonprofitFoundedYear: (row.nonprofit_founded_year as number | null) ?? null,
    businessRegNumber: (row.business_reg_number as string | null) ?? null,
    businessIndustry: (row.business_industry as string | null) ?? null,
    businessCompanySize: (row.business_company_size as string | null) ?? null,
    businessTaxId: (row.business_tax_id as string | null) ?? null,
    businessDunsNumber: (row.business_duns_number as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...(memberCount !== undefined ? { _count_members: memberCount } : {}),
  };
}

export function mapActivityLogRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    organizationId: (row.organization_id as string | null) ?? null,
    action: row.action,
    actionLabel: (row.action_label as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    severity: (row.severity as string | null) ?? null,
    entityType: (row.entity_type as string | null) ?? null,
    entityId: (row.entity_id as string | null) ?? null,
    description: String(row.description),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    ipAddress: (row.ip_address as string | null) ?? null,
    userAgent: (row.user_agent as string | null) ?? null,
    actorName: (row.actor_name as string | null) ?? null,
    actorEmail: (row.actor_email as string | null) ?? null,
    organizationName: (row.organization_name as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export function mapMemberRow(row: Record<string, unknown>): OrganizationMember {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    email: String(row.email),
    userId: (row.user_id as string | null) ?? null,
    status: row.status as OrganizationMember["status"],
    role: row.role as OrganizationMember["role"],
    title: (row.title as string | null) ?? null,
    department: (row.department as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    inviteMessage: (row.invite_message as string | null) ?? null,
    invitedBy: (row.invited_by as string | null) ?? null,
    permissions: (row.permissions as Record<string, unknown>) ?? {},
    accessProfileId: (row.access_profile_id as string | null) ?? null,
    invitedAt: String(row.invited_at),
    joinedAt: (row.joined_at as string | null) ?? null,
    lastActiveAt: (row.last_active_at as string | null) ?? null,
    updatedAt: String(row.updated_at),
  };
}

/** Maps camelCase API / edge-function responses (mapMemberResponse). */
export function mapMemberFromApiResponse(row: Record<string, unknown>): OrganizationMember {
  if (row.organization_id !== undefined) {
    return mapMemberRow(row);
  }
  return {
    id: String(row.id),
    organizationId: String(row.organizationId),
    email: String(row.email),
    userId: (row.userId as string | null) ?? null,
    status: row.status as OrganizationMember["status"],
    role: row.role as OrganizationMember["role"],
    title: (row.title as string | null) ?? null,
    department: (row.department as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    inviteMessage: (row.inviteMessage as string | null) ?? null,
    invitedBy: (row.invitedBy as string | null) ?? null,
    permissions: (row.permissions as Record<string, unknown>) ?? {},
    accessProfileId: (row.accessProfileId as string | null) ?? null,
    invitedAt: String(row.invitedAt),
    joinedAt: (row.joinedAt as string | null) ?? null,
    lastActiveAt: (row.lastActiveAt as string | null) ?? null,
    updatedAt: String(row.updatedAt),
  };
}

export function mapOrganizationFromApiResponse(row: Record<string, unknown>): Organization {
  if (row.created_by !== undefined) {
    return mapOrganizationRow(row);
  }
  return {
    id: String(row.id),
    name: String(row.name),
    slug: (row.slug as string | null) ?? null,
    type: row.type as Organization["type"],
    description: (row.description as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    contactEmail: (row.contactEmail as string | null) ?? null,
    contactPhone: (row.contactPhone as string | null) ?? null,
    logoUrl: (row.logoUrl as string | null) ?? null,
    bannerUrl: (row.bannerUrl as string | null) ?? null,
    status: (row.status as Organization["status"]) ?? "active",
    createdBy: String(row.createdBy),
    addressLine1: (row.addressLine1 as string | null) ?? null,
    addressLine2: (row.addressLine2 as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    stateRegion: (row.stateRegion as string | null) ?? null,
    postalCode: (row.postalCode as string | null) ?? null,
    country: (row.country as string | null) ?? "GB",
    timezone: String(row.timezone ?? "Europe/London"),
    locale: String(row.locale ?? "en-GB"),
    currency: String(row.currency ?? "GBP"),
    tags: (row.tags as string[]) ?? [],
    settings: (row.settings as Record<string, unknown>) ?? {},
    schoolDistrict: (row.schoolDistrict as string | null) ?? null,
    schoolGradeLevels: (row.schoolGradeLevels as string | null) ?? null,
    schoolAccreditation: (row.schoolAccreditation as string | null) ?? null,
    schoolStudentCount: (row.schoolStudentCount as number | null) ?? null,
    nonprofitEin: (row.nonprofitEin as string | null) ?? null,
    nonprofitTaxStatus: (row.nonprofitTaxStatus as string | null) ?? null,
    nonprofitMission: (row.nonprofitMission as string | null) ?? null,
    nonprofitFoundedYear: (row.nonprofitFoundedYear as number | null) ?? null,
    businessRegNumber: (row.businessRegNumber as string | null) ?? null,
    businessIndustry: (row.businessIndustry as string | null) ?? null,
    businessCompanySize: (row.businessCompanySize as string | null) ?? null,
    businessTaxId: (row.businessTaxId as string | null) ?? null,
    businessDunsNumber: (row.businessDunsNumber as string | null) ?? null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export function profileToDbUpdate(data: {
  fullName?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  bio?: string;
  timezone?: string;
  locale?: string;
  theme?: string;
  notifyEmail?: boolean;
  notifyPush?: boolean;
  notifySms?: boolean;
  notifyMarketing?: boolean;
}): Record<string, unknown> {
  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.fullName !== undefined) out.full_name = data.fullName;
  if (data.phone !== undefined) out.phone = data.phone || null;
  if (data.jobTitle !== undefined) out.job_title = data.jobTitle || null;
  if (data.department !== undefined) out.department = data.department || null;
  if (data.bio !== undefined) out.bio = data.bio || null;
  if (data.timezone !== undefined) out.timezone = data.timezone;
  if (data.locale !== undefined) out.locale = data.locale;
  if (data.theme !== undefined) out.theme = data.theme;
  if (data.notifyEmail !== undefined) out.notify_email = data.notifyEmail;
  if (data.notifyPush !== undefined) out.notify_push = data.notifyPush;
  if (data.notifySms !== undefined) out.notify_sms = data.notifySms;
  if (data.notifyMarketing !== undefined) out.notify_marketing = data.notifyMarketing;
  return out;
}

const emptyText = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const numOrNull = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : null);

/** Insert row for organizations (mirrors Edge Function mapCreateOrgRow). */
export function organizationToDbInsert(
  userId: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const type = data.type as string;
  return {
    name: String(data.name).trim(),
    type,
    created_by: userId,
    slug: emptyText(data.slug),
    description: emptyText(data.description),
    website: emptyText(data.website),
    contact_email: emptyText(data.contactEmail),
    contact_phone: emptyText(data.contactPhone),
    status: data.status ?? "active",
    address_line1: emptyText(data.addressLine1),
    address_line2: emptyText(data.addressLine2),
    city: emptyText(data.city),
    state_region: emptyText(data.stateRegion),
    postal_code: emptyText(data.postalCode),
    country: emptyText(data.country) ?? "GB",
    timezone: emptyText(data.timezone) ?? "Europe/London",
    locale: emptyText(data.locale) ?? "en-GB",
    currency: emptyText(data.currency) ?? "GBP",
    tags: (data.tags as string[] | undefined) ?? [],
    school_district: type === "school" ? emptyText(data.schoolDistrict) : null,
    school_grade_levels: type === "school" ? emptyText(data.schoolGradeLevels) : null,
    school_accreditation: type === "school" ? emptyText(data.schoolAccreditation) : null,
    school_student_count: type === "school" ? numOrNull(data.schoolStudentCount) : null,
    nonprofit_ein: type === "nonprofit" ? emptyText(data.nonprofitEin) : null,
    nonprofit_tax_status: type === "nonprofit" ? emptyText(data.nonprofitTaxStatus) : null,
    nonprofit_mission: type === "nonprofit" ? emptyText(data.nonprofitMission) : null,
    nonprofit_founded_year: type === "nonprofit" ? numOrNull(data.nonprofitFoundedYear) : null,
    business_reg_number: type === "business" ? emptyText(data.businessRegNumber) : null,
    business_industry: type === "business" ? emptyText(data.businessIndustry) : null,
    business_company_size: type === "business" ? emptyText(data.businessCompanySize) : null,
    business_tax_id: type === "business" ? emptyText(data.businessTaxId) : null,
    business_duns_number: type === "business" ? emptyText(data.businessDunsNumber) : null,
  };
}

export function organizationToDbUpdate(data: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = {
    name: "name",
    slug: "slug",
    type: "type",
    description: "description",
    website: "website",
    contactEmail: "contact_email",
    contactPhone: "contact_phone",
    status: "status",
    addressLine1: "address_line1",
    addressLine2: "address_line2",
    city: "city",
    stateRegion: "state_region",
    postalCode: "postal_code",
    country: "country",
    timezone: "timezone",
    locale: "locale",
    currency: "currency",
    tags: "tags",
    schoolDistrict: "school_district",
    schoolGradeLevels: "school_grade_levels",
    schoolAccreditation: "school_accreditation",
    schoolStudentCount: "school_student_count",
    nonprofitEin: "nonprofit_ein",
    nonprofitTaxStatus: "nonprofit_tax_status",
    nonprofitMission: "nonprofit_mission",
    nonprofitFoundedYear: "nonprofit_founded_year",
    businessRegNumber: "business_reg_number",
    businessIndustry: "business_industry",
    businessCompanySize: "business_company_size",
    businessTaxId: "business_tax_id",
    businessDunsNumber: "business_duns_number",
  };

  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [camel, snake] of Object.entries(map)) {
    if (data[camel] !== undefined) {
      out[snake] = data[camel];
    }
  }
  return out;
}
