import { z } from "zod";
import {
  emailField,
  optionalEmailField,
  optionalPhoneField,
  optionalUrlField,
  fullNameField,
  passwordStrengthSchema,
  isValidCharityRegNumber,
  isValidE164,
  toE164,
  validatePostalCode,
} from "./lib/validation";

// ─── Enums & constants ───────────────────────────────────────────────────────

export const ORG_TYPES = ["school", "nonprofit", "business"] as const;
export const MEMBER_STATUSES = ["invited", "active", "suspended", "removed"] as const;
export const MEMBER_ROLES = ["admin", "member", "viewer"] as const;

export const MEMBER_ROLE_LABELS: Record<(typeof MEMBER_ROLES)[number], string> = {
  admin: "Admin — can manage members and settings",
  member: "Member — standard access",
  viewer: "Viewer — read-only",
};

export const ORG_STATUSES = ["active", "inactive", "archived", "pending_verification"] as const;
export const ACCOUNT_STATUSES = ["active", "suspended", "deactivated"] as const;
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export const UPLOAD_ENTITY_TYPES = ["profile", "organization", "organization_banner", "member", "document"] as const;

export const ACTIVITY_ACTIONS = [
  "auth.sign_up",
  "auth.sign_in",
  "auth.sign_out",
  "auth.password_change",
  "profile.update",
  "profile.avatar_upload",
  "profile.preferences_update",
  "account.session_revoke",
  "account.deactivate",
  "org.create",
  "org.update",
  "org.view",
  "org.status_change",
  "org.logo_upload",
  "org.banner_upload",
  "member.invite",
  "member.update",
  "member.remove",
  "file.upload",
  "file.delete",
] as const;

export type OrgType = (typeof ORG_TYPES)[number];
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export type MemberRole = (typeof MEMBER_ROLES)[number];
export type OrgStatus = (typeof ORG_STATUSES)[number];
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type UploadEntityType = (typeof UPLOAD_ENTITY_TYPES)[number];
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  school: "School",
  nonprofit: "Charity",
  business: "Business",
};

export const ORG_STATUS_LABELS: Record<OrgStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
  pending_verification: "Pending verification",
};

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  invited: "Invited",
  active: "Active",
  suspended: "Suspended",
  removed: "Removed",
};

export const ACTIVITY_SEVERITIES = ["info", "notice", "warning", "critical"] as const;
export type ActivitySeverity = (typeof ACTIVITY_SEVERITIES)[number];

export const ACTIVITY_SEVERITY_LABELS: Record<ActivitySeverity, string> = {
  info: "Information",
  notice: "Notice",
  warning: "Warning",
  critical: "Critical",
};

/** Plain-language labels — mirrors supabase activity_action_catalog */
export const ACTIVITY_ACTION_CATALOG: Record<
  ActivityAction,
  { label: string; category: string; severity: ActivitySeverity; hint: string }
> = {
  "auth.sign_up": { label: "Account created", category: "Authentication", severity: "notice", hint: "New user registration" },
  "auth.sign_in": { label: "Signed in", category: "Authentication", severity: "info", hint: "Successful login" },
  "auth.sign_out": { label: "Signed out", category: "Authentication", severity: "info", hint: "User logged out" },
  "auth.password_change": { label: "Password changed", category: "Security", severity: "warning", hint: "Password was updated" },
  "profile.update": { label: "Profile updated", category: "Account", severity: "info", hint: "Profile details changed" },
  "profile.avatar_upload": { label: "Avatar uploaded", category: "Account", severity: "info", hint: "Profile photo uploaded" },
  "profile.preferences_update": { label: "Preferences updated", category: "Account", severity: "info", hint: "Settings or notifications changed" },
  "account.session_revoke": { label: "Session revoked", category: "Security", severity: "warning", hint: "A login session was ended" },
  "account.deactivate": { label: "Account deactivated", category: "Security", severity: "critical", hint: "Account was deactivated" },
  "org.create": { label: "Organisation created", category: "Organisations", severity: "notice", hint: "New organisation added" },
  "org.update": { label: "Organisation updated", category: "Organisations", severity: "info", hint: "Organisation details changed" },
  "org.view": { label: "Organisation viewed", category: "Organisations", severity: "info", hint: "Organisation page opened" },
  "org.status_change": { label: "Status changed", category: "Organisations", severity: "warning", hint: "Organisation status updated" },
  "org.logo_upload": { label: "Logo uploaded", category: "Organisations", severity: "info", hint: "Organisation logo updated" },
  "org.banner_upload": { label: "Banner uploaded", category: "Organisations", severity: "info", hint: "Organisation banner updated" },
  "member.invite": { label: "Member invited", category: "Members", severity: "notice", hint: "Invitation sent" },
  "member.update": { label: "Member updated", category: "Members", severity: "info", hint: "Member role or access changed" },
  "member.remove": { label: "Member removed", category: "Members", severity: "warning", hint: "Member removed from org" },
  "file.upload": { label: "File uploaded", category: "Files", severity: "info", hint: "File or image uploaded" },
  "file.delete": { label: "File deleted", category: "Files", severity: "warning", hint: "File was deleted" },
};

export const ACCESS_PROFILE_SLUGS = [
  "platform_admin",
  "org_owner",
  "org_admin",
  "org_member",
  "org_viewer",
] as const;
export type AccessProfileSlug = (typeof ACCESS_PROFILE_SLUGS)[number];

export const ROLE_DEFAULT_ACCESS_SLUG: Record<MemberRole, AccessProfileSlug> = {
  admin: "org_admin",
  member: "org_member",
  viewer: "org_viewer",
};

export interface AccessPermissions {
  organizations?: { create?: boolean; read?: boolean; update?: boolean; delete?: boolean };
  members?: { invite?: boolean; update?: boolean; remove?: boolean; assign_roles?: boolean };
  activity_logs?: { read?: boolean; read_all?: boolean };
  files?: { upload?: boolean; delete?: boolean };
  settings?: { read?: boolean; write?: boolean };
  platform?: { read?: boolean; manage_users?: boolean; view_all_logs?: boolean };
}

export interface AccessProfile {
  id: string;
  slug: AccessProfileSlug;
  name: string;
  description: string;
  scope: "platform" | "organization";
  permissions: AccessPermissions;
  sortOrder: number;
}

// ─── Auth schemas ────────────────────────────────────────────────────────────

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z
  .object({
    email: emailField,
    password: passwordStrengthSchema,
    fullName: fullNameField,
    phoneDial: z.string().min(1),
    phoneNational: z.string().optional().or(z.literal("")),
    phone: optionalPhoneField,
    jobTitle: z.string().trim().max(80).optional().or(z.literal("")),
    timezone: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const national = (data.phoneNational ?? "").replace(/\D/g, "");
    if (!national) return;
    const e164 = toE164(data.phoneDial, national);
    if (!isValidE164(e164)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phoneNational"],
        message: "Enter a valid phone number for the selected country",
      });
    }
  });

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    password: passwordStrengthSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordStrengthSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z
  .object({
    fullName: fullNameField,
    phoneDial: z.string().min(1),
    phoneNational: z.string().optional().or(z.literal("")),
    phone: optionalPhoneField,
    jobTitle: z.string().trim().max(80).optional().or(z.literal("")),
    department: z.string().trim().max(80).optional().or(z.literal("")),
    bio: z.string().max(500, "Bio must be 500 characters or less").optional().or(z.literal("")),
    timezone: z.string().optional(),
    locale: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const national = (data.phoneNational ?? "").replace(/\D/g, "");
    if (!national) return;
    const e164 = toE164(data.phoneDial, national);
    if (!isValidE164(e164)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phoneNational"],
        message: "Enter a valid phone number for the selected country",
      });
    }
  });

export const updatePreferencesSchema = z.object({
  theme: z.enum(THEME_PREFERENCES),
  notifyEmail: z.boolean(),
  notifyPush: z.boolean(),
  notifySms: z.boolean(),
  notifyMarketing: z.boolean(),
});

// ─── Organization schemas ────────────────────────────────────────────────────

const orgBaseFields = {
  name: z.string().trim().min(2, "Organisation name must be at least 2 characters").max(120),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only")
    .optional()
    .or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  website: optionalUrlField,
  contactEmail: optionalEmailField,
  contactPhoneDial: z.string().optional(),
  contactPhoneNational: z.string().optional().or(z.literal("")),
  contactPhone: optionalPhoneField,
  status: z.enum(ORG_STATUSES).optional(),
  addressLine1: z.string().optional().or(z.literal("")),
  addressLine2: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  stateRegion: z.string().optional().or(z.literal("")),
  postalCode: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  currency: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // Type-specific
  schoolDistrict: z.string().optional().or(z.literal("")),
  schoolGradeLevels: z.string().optional().or(z.literal("")),
  schoolAccreditation: z.string().optional().or(z.literal("")),
  schoolStudentCount: z.coerce.number().int().positive().optional().or(z.literal("")),
  nonprofitEin: z.string().optional().or(z.literal("")),
  nonprofitTaxStatus: z.string().optional().or(z.literal("")),
  nonprofitMission: z.string().optional().or(z.literal("")),
  nonprofitFoundedYear: z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional().or(z.literal("")),
  businessRegNumber: z.string().optional().or(z.literal("")),
  businessIndustry: z.string().optional().or(z.literal("")),
  businessCompanySize: z.string().optional().or(z.literal("")),
  businessTaxId: z.string().optional().or(z.literal("")),
  businessDunsNumber: z.string().optional().or(z.literal("")),
};

function applyOrgContactValidation(
  data: Record<string, unknown>,
  ctx: z.RefinementCtx
) {
  const national = String(data.contactPhoneNational ?? "").replace(/\D/g, "");
  if (national) {
    const e164 = toE164(String(data.contactPhoneDial ?? "+44"), national);
    if (!isValidE164(e164)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contactPhoneNational"],
        message: "Enter a valid phone number for the selected country",
      });
    }
  }
  const postal = String(data.postalCode ?? "").trim();
  const country = String(data.country ?? "").trim();
  if (postal && country && !validatePostalCode(country, postal)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["postalCode"],
      message: "Postcode doesn't look right for the selected country",
    });
  }
}

function applyOrgTypeValidation(
  data: { type: OrgType } & Record<string, unknown>,
  ctx: z.RefinementCtx
) {
  if (data.type === "school") {
    if (!data.schoolDistrict || String(data.schoolDistrict).trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["schoolDistrict"], message: "Local authority or trust name is required" });
    }
  } else if (data.type === "nonprofit") {
    if (!data.nonprofitEin || !isValidCharityRegNumber(String(data.nonprofitEin))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nonprofitEin"], message: "Enter a valid charity registration number (6–8 digits)" });
    }
  } else if (data.type === "business") {
    if (!data.businessRegNumber || String(data.businessRegNumber).trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["businessRegNumber"], message: "Companies House number is required" });
    }
  }
}

export const createOrgSchema = z
  .object({
    type: z.enum(ORG_TYPES),
    ...orgBaseFields,
  })
  .superRefine((data, ctx) => {
    applyOrgTypeValidation(data, ctx);
    applyOrgContactValidation(data as Record<string, unknown>, ctx);
  });

export const updateOrgSchema = z
  .object({
    type: z.enum(ORG_TYPES).optional(),
    ...orgBaseFields,
  })
  .superRefine((data, ctx) => {
    if (data.type) applyOrgTypeValidation(data as { type: OrgType } & Record<string, unknown>, ctx);
    applyOrgContactValidation(data as Record<string, unknown>, ctx);
  });

export const inviteMemberSchema = z
  .object({
    email: emailField,
    role: z.enum(MEMBER_ROLES).default("member"),
    accessProfileId: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((v) => v === "" || z.string().uuid().safeParse(v).success, "Choose a valid permission level"),
    title: z.string().trim().max(80).optional().or(z.literal("")),
    department: z.string().trim().max(80).optional().or(z.literal("")),
    phoneDial: z.string().min(1),
    phoneNational: z.string().optional().or(z.literal("")),
    phone: optionalPhoneField,
    inviteMessage: z.string().max(500).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const national = (data.phoneNational ?? "").replace(/\D/g, "");
    if (!national) return;
    const e164 = toE164(data.phoneDial, national);
    if (!isValidE164(e164)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phoneNational"],
        message: "Enter a valid phone number for the selected country",
      });
    }
  });

export const updateMemberSchema = z.object({
  role: z.enum(MEMBER_ROLES).optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  phone: optionalPhoneField,
  accessProfileId: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => v === "" || z.string().uuid().safeParse(v).success, "Choose a valid permission level"),
});

// ─── Domain types ────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  phone?: string | null;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  bio?: string | null;
  timezone: string;
  locale: string;
  theme: ThemePreference;
  accountStatus: AccountStatus;
  notifyEmail: boolean;
  notifyPush: boolean;
  notifySms: boolean;
  notifyMarketing: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug?: string | null;
  type: OrgType;
  description?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  status: OrgStatus;
  createdBy: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  country?: string | null;
  timezone: string;
  locale: string;
  currency: string;
  tags: string[];
  settings: Record<string, unknown>;
  schoolDistrict?: string | null;
  schoolGradeLevels?: string | null;
  schoolAccreditation?: string | null;
  schoolStudentCount?: number | null;
  nonprofitEin?: string | null;
  nonprofitTaxStatus?: string | null;
  nonprofitMission?: string | null;
  nonprofitFoundedYear?: number | null;
  businessRegNumber?: string | null;
  businessIndustry?: string | null;
  businessCompanySize?: string | null;
  businessTaxId?: string | null;
  businessDunsNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  _count_members?: number;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  email: string;
  userId?: string | null;
  status: MemberStatus;
  role: MemberRole;
  title?: string | null;
  department?: string | null;
  phone?: string | null;
  inviteMessage?: string | null;
  invitedBy?: string | null;
  permissions: Record<string, unknown>;
  accessProfileId?: string | null;
  invitedAt: string;
  joinedAt?: string | null;
  lastActiveAt?: string | null;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  organizationId?: string | null;
  action: ActivityAction;
  actionLabel?: string | null;
  category?: string | null;
  severity?: ActivitySeverity | null;
  entityType?: string | null;
  entityId?: string | null;
  description: string;
  metadata: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  organizationName?: string | null;
  createdAt: string;
}

export interface UploadedFile {
  id: string;
  uploadedBy: string;
  organizationId?: string | null;
  entityType: UploadEntityType;
  entityId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  publicUrl: string;
  createdAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  deviceLabel?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  isCurrent: boolean;
  lastActiveAt: string;
  createdAt: string;
  revokedAt?: string | null;
}

export interface DashboardStats {
  totalOrganizations: number;
  totalMembers: number;
  activeMembers: number;
  pendingInvites: number;
  organizationsByType: Record<OrgType, number>;
  activityLast7Days: number;
  organizationsCreatedThisMonth: number;
}

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

/** API payloads with phone UI helper fields removed */
export type CreateOrgPayload = Omit<
  CreateOrgInput,
  "contactPhoneDial" | "contactPhoneNational" | "phoneDial" | "phoneNational"
>;
export type UpdateOrgPayload = Omit<
  UpdateOrgInput,
  "contactPhoneDial" | "contactPhoneNational" | "phoneDial" | "phoneNational"
>;
export type UpdateProfilePayload = Omit<
  UpdateProfileInput,
  "phoneDial" | "phoneNational" | "contactPhoneDial" | "contactPhoneNational"
>;
export type InviteMemberPayload = Omit<
  z.infer<typeof inviteMemberSchema>,
  "phoneDial" | "phoneNational" | "contactPhoneDial" | "contactPhoneNational"
>;
