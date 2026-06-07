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
