import { z } from "zod";

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

export const ACTIVITY_SEVERITIES = ["info", "notice", "warning", "critical"] as const;
export type ActivitySeverity = (typeof ACTIVITY_SEVERITIES)[number];

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
  "org.create": { label: "Organization created", category: "Organizations", severity: "notice", hint: "New organization added" },
  "org.update": { label: "Organization updated", category: "Organizations", severity: "info", hint: "Organization details changed" },
  "org.view": { label: "Organization viewed", category: "Organizations", severity: "info", hint: "Organization page opened" },
  "org.status_change": { label: "Status changed", category: "Organizations", severity: "warning", hint: "Organization status updated" },
  "org.logo_upload": { label: "Logo uploaded", category: "Organizations", severity: "info", hint: "Organization logo updated" },
  "org.banner_upload": { label: "Banner uploaded", category: "Organizations", severity: "info", hint: "Organization banner updated" },
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
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  timezone: z.string().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
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
  name: z.string().min(2, "Organization name must be at least 2 characters").max(120),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens")
    .optional()
    .or(z.literal("")),
  description: z.string().max(2000).optional(),
  website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  status: z.enum(ORG_STATUSES).optional(),
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
  // Type-specific
  schoolDistrict: z.string().optional(),
  schoolGradeLevels: z.string().optional(),
  schoolAccreditation: z.string().optional(),
  schoolStudentCount: z.coerce.number().int().positive().optional().or(z.literal("")),
  nonprofitEin: z.string().optional(),
  nonprofitTaxStatus: z.string().optional(),
  nonprofitMission: z.string().optional(),
  nonprofitFoundedYear: z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional().or(z.literal("")),
  businessRegNumber: z.string().optional(),
  businessIndustry: z.string().optional(),
  businessCompanySize: z.string().optional(),
  businessTaxId: z.string().optional(),
  businessDunsNumber: z.string().optional(),
};

function applyOrgTypeValidation(
  data: { type: OrgType } & Record<string, unknown>,
  ctx: z.RefinementCtx
) {
  if (data.type === "school") {
    if (!data.schoolDistrict || String(data.schoolDistrict).trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["schoolDistrict"], message: "School district is required" });
    }
  } else if (data.type === "nonprofit") {
    if (!data.nonprofitEin || !/^\d{2}-\d{7}$/.test(String(data.nonprofitEin))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nonprofitEin"], message: "EIN must be format XX-XXXXXXX" });
    }
  } else if (data.type === "business") {
    if (!data.businessRegNumber || String(data.businessRegNumber).trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["businessRegNumber"], message: "Registration number is required" });
    }
  }
}

export const createOrgSchema = z
  .object({
    type: z.enum(ORG_TYPES),
    ...orgBaseFields,
  })
  .superRefine(applyOrgTypeValidation);

export const updateOrgSchema = z
  .object({
    type: z.enum(ORG_TYPES).optional(),
    ...orgBaseFields,
  })
  .superRefine((data, ctx) => {
    if (data.type) applyOrgTypeValidation(data as { type: OrgType } & Record<string, unknown>, ctx);
  });

export const inviteMemberSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(MEMBER_ROLES).default("member"),
  accessProfileId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  inviteMessage: z.string().max(500).optional(),
});

export const updateMemberSchema = z.object({
  role: z.enum(MEMBER_ROLES).optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  accessProfileId: z.string().uuid().optional().or(z.literal("")),
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

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
