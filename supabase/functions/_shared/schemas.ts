import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const ORG_TYPES = ["school", "nonprofit", "business"] as const;

export const createOrgSchema = z
  .object({
    name: z.string().min(2, "Organization name must be at least 2 characters").max(120),
    type: z.enum(ORG_TYPES),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug")
      .optional()
      .or(z.literal("")),
    description: z.string().max(2000).optional(),
    website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
    contactEmail: z.string().email().optional().or(z.literal("")),
    contactPhone: z.string().optional(),
    status: z.enum(["active", "inactive", "archived", "pending_verification"]).optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    stateRegion: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    timezone: z.string().optional(),
    locale: z.string().optional(),
    currency: z.string().optional(),
    tags: z.array(z.string()).optional(),
    schoolDistrict: z.string().optional(),
    schoolGradeLevels: z.string().optional(),
    schoolAccreditation: z.string().optional(),
    schoolStudentCount: z.coerce.number().int().positive().optional().or(z.literal("")),
    nonprofitEin: z.string().optional(),
    nonprofitTaxStatus: z.string().optional(),
    nonprofitMission: z.string().optional(),
    nonprofitFoundedYear: z.coerce
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear())
      .optional()
      .or(z.literal("")),
    businessRegNumber: z.string().optional(),
    businessIndustry: z.string().optional(),
    businessCompanySize: z.string().optional(),
    businessTaxId: z.string().optional(),
    businessDunsNumber: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "school") {
      if (!data.schoolDistrict?.trim()) {
        ctx.addIssue({ code: "custom", path: ["schoolDistrict"], message: "School district is required" });
      }
    } else if (data.type === "nonprofit") {
      if (!data.nonprofitEin || !/^\d{2}-\d{7}$/.test(data.nonprofitEin)) {
        ctx.addIssue({ code: "custom", path: ["nonprofitEin"], message: "EIN must be format XX-XXXXXXX" });
      }
    } else if (data.type === "business") {
      if (!data.businessRegNumber?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["businessRegNumber"],
          message: "Registration number is required",
        });
      }
    }
  });

export const inviteMemberSchema = z.object({
  orgId: z.string().uuid("Invalid organization ID"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
  accessProfileId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  inviteMessage: z.string().max(500).optional(),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export function mapCreateOrgRow(userId: string, data: CreateOrgInput): Record<string, unknown> {
  const empty = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);
  const numOrNull = (v: number | "" | undefined) =>
    typeof v === "number" && !Number.isNaN(v) ? v : null;

  return {
    name: data.name.trim(),
    type: data.type,
    created_by: userId,
    slug: empty(data.slug),
    description: empty(data.description),
    website: empty(data.website),
    contact_email: empty(data.contactEmail),
    contact_phone: empty(data.contactPhone),
    status: data.status ?? "active",
    address_line1: empty(data.addressLine1),
    address_line2: empty(data.addressLine2),
    city: empty(data.city),
    state_region: empty(data.stateRegion),
    postal_code: empty(data.postalCode),
    country: empty(data.country) ?? "US",
    timezone: empty(data.timezone) ?? "UTC",
    locale: empty(data.locale) ?? "en-US",
    currency: empty(data.currency) ?? "USD",
    tags: data.tags ?? [],
    school_district: data.type === "school" ? empty(data.schoolDistrict) : null,
    school_grade_levels: data.type === "school" ? empty(data.schoolGradeLevels) : null,
    school_accreditation: data.type === "school" ? empty(data.schoolAccreditation) : null,
    school_student_count: data.type === "school" ? numOrNull(data.schoolStudentCount) : null,
    nonprofit_ein: data.type === "nonprofit" ? empty(data.nonprofitEin) : null,
    nonprofit_tax_status: data.type === "nonprofit" ? empty(data.nonprofitTaxStatus) : null,
    nonprofit_mission: data.type === "nonprofit" ? empty(data.nonprofitMission) : null,
    nonprofit_founded_year:
      data.type === "nonprofit" ? numOrNull(data.nonprofitFoundedYear) : null,
    business_reg_number: data.type === "business" ? empty(data.businessRegNumber) : null,
    business_industry: data.type === "business" ? empty(data.businessIndustry) : null,
    business_company_size: data.type === "business" ? empty(data.businessCompanySize) : null,
    business_tax_id: data.type === "business" ? empty(data.businessTaxId) : null,
    business_duns_number: data.type === "business" ? empty(data.businessDunsNumber) : null,
  };
}

export function mapOrganizationResponse(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug ?? null,
    type: row.type,
    description: row.description ?? null,
    website: row.website ?? null,
    contactEmail: row.contact_email ?? null,
    contactPhone: row.contact_phone ?? null,
    logoUrl: row.logo_url ?? null,
    bannerUrl: row.banner_url ?? null,
    status: row.status ?? "active",
    createdBy: row.created_by,
    addressLine1: row.address_line1 ?? null,
    addressLine2: row.address_line2 ?? null,
    city: row.city ?? null,
    stateRegion: row.state_region ?? null,
    postalCode: row.postal_code ?? null,
    country: row.country ?? "US",
    timezone: row.timezone ?? "UTC",
    locale: row.locale ?? "en-US",
    currency: row.currency ?? "USD",
    tags: row.tags ?? [],
    settings: row.settings ?? {},
    schoolDistrict: row.school_district ?? null,
    schoolGradeLevels: row.school_grade_levels ?? null,
    schoolAccreditation: row.school_accreditation ?? null,
    schoolStudentCount: row.school_student_count ?? null,
    nonprofitEin: row.nonprofit_ein ?? null,
    nonprofitTaxStatus: row.nonprofit_tax_status ?? null,
    nonprofitMission: row.nonprofit_mission ?? null,
    nonprofitFoundedYear: row.nonprofit_founded_year ?? null,
    businessRegNumber: row.business_reg_number ?? null,
    businessIndustry: row.business_industry ?? null,
    businessCompanySize: row.business_company_size ?? null,
    businessTaxId: row.business_tax_id ?? null,
    businessDunsNumber: row.business_duns_number ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMemberResponse(row: Record<string, unknown>) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    userId: row.user_id ?? null,
    status: row.status,
    role: row.role,
    title: row.title ?? null,
    department: row.department ?? null,
    phone: row.phone ?? null,
    inviteMessage: row.invite_message ?? null,
    invitedBy: row.invited_by ?? null,
    permissions: row.permissions ?? {},
    accessProfileId: row.access_profile_id ?? null,
    invitedAt: row.invited_at,
    joinedAt: row.joined_at ?? null,
    lastActiveAt: row.last_active_at ?? null,
    updatedAt: row.updated_at,
  };
}
