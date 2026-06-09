import fs from "fs";
import path from "path";
import crypto from "crypto";
import { isValidCharityRegNumber } from "../lib/validation";
import type {
  Profile,
  Organization,
  OrganizationMember,
  ActivityLog,
  UploadedFile,
  UserSession,
  OrgType,
  OrgStatus,
  ThemePreference,
  CreateOrgInput,
  UpdateOrgInput,
  UpdateProfilePayload,
  UpdatePreferencesInput,
  MemberRole,
  MemberStatus,
  AccessProfile,
  InvitePreview,
} from "../types";
import { ACTIVITY_ACTION_CATALOG } from "../types";
import { createActivityLog, type ActivityContext } from "./activityLog";
import { sendOrgInviteEmailLocal, sendWelcomeEmailLocal } from "./email";
import { hashPassword, verifyPassword, needsPasswordRehash } from "./security";

const DB_PATH = path.join(process.cwd(), "db.json");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

interface UserRecord extends Profile {
  passwordHash: string;
}

interface DBStore {
  users: UserRecord[];
  organizations: Organization[];
  members: OrganizationMember[];
  activityLogs: ActivityLog[];
  uploadedFiles: UploadedFile[];
  sessions: UserSession[];
  accessProfiles: AccessProfile[];
}

const ACCESS_PROFILE_IDS = {
  platform_admin: "11111111-1111-4111-8111-111111111101",
  org_owner: "11111111-1111-4111-8111-111111111102",
  org_admin: "11111111-1111-4111-8111-111111111103",
  org_member: "11111111-1111-4111-8111-111111111104",
  org_viewer: "11111111-1111-4111-8111-111111111105",
} as const;

const LEGACY_ACCESS_PROFILE_IDS: Record<string, string> = {
  "ap-platform-admin": ACCESS_PROFILE_IDS.platform_admin,
  "ap-org-owner": ACCESS_PROFILE_IDS.org_owner,
  "ap-org-admin": ACCESS_PROFILE_IDS.org_admin,
  "ap-org-member": ACCESS_PROFILE_IDS.org_member,
  "ap-org-viewer": ACCESS_PROFILE_IDS.org_viewer,
};

const SEED_ACCESS_PROFILES: AccessProfile[] = [
  {
    id: ACCESS_PROFILE_IDS.platform_admin,
    slug: "platform_admin",
    name: "Platform Administrator",
    description: "Full platform access. Can view all organizations and every audit log entry.",
    scope: "platform",
    permissions: {
      platform: { read: true, manage_users: true, view_all_logs: true },
      organizations: { create: true, read: true, update: true, delete: true },
      members: { invite: true, update: true, remove: true, assign_roles: true },
      activity_logs: { read: true, read_all: true },
      files: { upload: true, delete: true },
      settings: { read: true, write: true },
    },
    sortOrder: 10,
  },
  {
    id: ACCESS_PROFILE_IDS.org_owner,
    slug: "org_owner",
    name: "Organization Owner",
    description: "Created the organization. Full control over members, settings, and org audit logs.",
    scope: "organization",
    permissions: {
      organizations: { read: true, update: true, delete: true },
      members: { invite: true, update: true, remove: true, assign_roles: true },
      activity_logs: { read: true, read_all: false },
      files: { upload: true, delete: true },
      settings: { read: true, write: true },
    },
    sortOrder: 20,
  },
  {
    id: ACCESS_PROFILE_IDS.org_admin,
    slug: "org_admin",
    name: "Organization Admin",
    description: "Can manage members, update organization details, and view organization activity.",
    scope: "organization",
    permissions: {
      organizations: { read: true, update: true, delete: false },
      members: { invite: true, update: true, remove: true, assign_roles: true },
      activity_logs: { read: true, read_all: false },
      files: { upload: true, delete: true },
      settings: { read: true, write: true },
    },
    sortOrder: 30,
  },
  {
    id: ACCESS_PROFILE_IDS.org_member,
    slug: "org_member",
    name: "Member",
    description: "Standard member. Can view organization details.",
    scope: "organization",
    permissions: {
      organizations: { read: true, update: false, delete: false },
      members: { invite: false, update: false, remove: false, assign_roles: false },
      activity_logs: { read: false, read_all: false },
      files: { upload: true, delete: false },
      settings: { read: true, write: false },
    },
    sortOrder: 40,
  },
  {
    id: ACCESS_PROFILE_IDS.org_viewer,
    slug: "org_viewer",
    name: "Viewer",
    description: "Read-only access to organization information.",
    scope: "organization",
    permissions: {
      organizations: { read: true, update: false, delete: false },
      members: { invite: false, update: false, remove: false, assign_roles: false },
      activity_logs: { read: false, read_all: false },
      files: { upload: false, delete: false },
      settings: { read: true, write: false },
    },
    sortOrder: 50,
  },
];

function profileIdForRole(role: MemberRole): string {
  const slug = role === "admin" ? "org_admin" : role === "viewer" ? "org_viewer" : "org_member";
  return SEED_ACCESS_PROFILES.find((p) => p.slug === slug)?.id ?? SEED_ACCESS_PROFILES[2].id;
}

function userOrgPermissions(userId: string, orgId: string) {
  const user = store.users.find((u) => u.id === userId);
  if (user?.isAdmin) {
    return SEED_ACCESS_PROFILES.find((p) => p.slug === "platform_admin")!.permissions;
  }
  const org = store.organizations.find((o) => o.id === orgId);
  if (org?.createdBy === userId) {
    return SEED_ACCESS_PROFILES.find((p) => p.slug === "org_owner")!.permissions;
  }
  const member = store.members.find(
    (m) => m.organizationId === orgId && m.userId === userId && m.status === "active",
  );
  if (!member) return {};
  const profile = member.accessProfileId
    ? store.accessProfiles.find((p) => p.id === member.accessProfileId)
    : SEED_ACCESS_PROFILES.find(
        (p) =>
          p.slug ===
          (member.role === "admin" ? "org_admin" : member.role === "viewer" ? "org_viewer" : "org_member"),
      );
  return profile?.permissions ?? {};
}

function canViewOrganization(userId: string, orgId: string): boolean {
  const user = store.users.find((u) => u.id === userId);
  if (user?.isAdmin) return true;
  const org = store.organizations.find((o) => o.id === orgId);
  if (org?.createdBy === userId) return true;
  return store.members.some(
    (m) =>
      m.organizationId === orgId &&
      m.userId === userId &&
      (m.status === "active" || m.status === "invited"),
  );
}

function canInviteMembers(userId: string, orgId: string): boolean {
  return userOrgPermissions(userId, orgId).members?.invite === true;
}

function canManageOrganization(userId: string, orgId: string): boolean {
  const perms = userOrgPermissions(userId, orgId);
  return perms.organizations?.update === true || perms.organizations?.delete === true;
}

function defaultProfile(partial: Partial<UserRecord> & Pick<UserRecord, "id" | "email" | "fullName" | "passwordHash">): UserRecord {
  const now = new Date().toISOString();
  return {
    isAdmin: true,
    phone: null,
    avatarUrl: null,
    jobTitle: null,
    department: null,
    bio: null,
    timezone: "Europe/London",
    locale: "en-GB",
    theme: "system",
    accountStatus: "active",
    notifyEmail: true,
    notifyPush: true,
    notifySms: false,
    notifyMarketing: false,
    twoFactorEnabled: false,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

const DEFAULT_SEED_USER = defaultProfile({
  id: "8c715003-8820-4e3a-96bd-5bda5e656501",
  email: "admin@example.co.uk",
  fullName: "Alex Morgan",
  jobTitle: "Operations Manager",
  department: "Operations",
  phone: "+447700900123",
  bio: "Default demo account for local evaluation.",
  passwordHash: hashPassword("Password123!"),
});

function baseOrg(partial: Partial<Organization> & Pick<Organization, "id" | "name" | "type" | "createdBy">): Organization {
  const now = new Date().toISOString();
  return {
    slug: null,
    description: null,
    website: null,
    contactEmail: null,
    contactPhone: null,
    logoUrl: null,
    bannerUrl: null,
    status: "active",
    addressLine1: null,
    addressLine2: null,
    city: null,
    stateRegion: null,
    postalCode: null,
    country: "GB",
    timezone: "Europe/London",
    locale: "en-GB",
    currency: "GBP",
    tags: [],
    settings: {},
    schoolDistrict: null,
    schoolGradeLevels: null,
    schoolAccreditation: null,
    schoolStudentCount: null,
    nonprofitEin: null,
    nonprofitTaxStatus: null,
    nonprofitMission: null,
    nonprofitFoundedYear: null,
    businessRegNumber: null,
    businessIndustry: null,
    businessCompanySize: null,
    businessTaxId: null,
    businessDunsNumber: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

const SEED_ORGS: Organization[] = [
  baseOrg({
    id: "a39b360b-8d07-424a-93a5-2bc381188301",
    name: "Greenwich Borough Schools",
    slug: "greenwich-borough-schools",
    type: "school",
    createdBy: DEFAULT_SEED_USER.id,
    schoolDistrict: "Royal Borough of Greenwich",
    schoolGradeLevels: "Reception–Year 11",
    schoolAccreditation: "Ofsted",
    schoolStudentCount: 4200,
    description: "Community schools serving families across Greenwich.",
    contactEmail: "admin@greenwich-schools.gov.uk",
    contactPhone: "+442081234567",
    addressLine1: "Royal Hill",
    city: "London",
    stateRegion: "Greater London",
    postalCode: "SE10 8RA",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  }),
  baseOrg({
    id: "b49a370c-9e12-454b-adc6-3cd491289402",
    name: "Thames Community Food Bank",
    slug: "thames-community-food-bank",
    type: "nonprofit",
    createdBy: DEFAULT_SEED_USER.id,
    nonprofitEin: "1234567",
    nonprofitTaxStatus: "Registered charity",
    nonprofitMission: "Reducing food poverty across South East London through distribution and advice.",
    nonprofitFoundedYear: 1998,
    description: "Regional food bank network.",
    contactEmail: "info@thamesfoodbank.org.uk",
    contactPhone: "+442071234567",
    city: "London",
    stateRegion: "Greater London",
    postalCode: "SE1 7PB",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  }),
  baseOrg({
    id: "c59c380d-0e23-465c-bdf7-4de592390503",
    name: "Meridian Software Ltd",
    slug: "meridian-software",
    type: "business",
    createdBy: DEFAULT_SEED_USER.id,
    businessRegNumber: "12345678",
    businessIndustry: "Technology",
    businessCompanySize: "51–200",
    businessTaxId: "GB123456789",
    website: "https://meridian.example.co.uk",
    description: "B2B software and consulting for UK public sector teams.",
    contactEmail: "hello@meridian.example.co.uk",
    contactPhone: "+441612345678",
    city: "Manchester",
    stateRegion: "Greater Manchester",
    postalCode: "M1 1AE",
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  }),
];

const SEED_MEMBERS: OrganizationMember[] = [
  {
    id: "d1111111-2041-4cf1-a3f8-8bb111111111",
    organizationId: SEED_ORGS[0].id,
    email: "headteacher@greenwich-schools.gov.uk",
    status: "active",
    role: "admin",
    title: "Headteacher",
    department: "Administration",
    permissions: {},
    accessProfileId: profileIdForRole("admin"),
    invitedBy: DEFAULT_SEED_USER.id,
    invitedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    joinedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "d2222222-2041-4cf1-a3f8-8bb222222222",
    organizationId: SEED_ORGS[0].id,
    email: "deputy@greenwich-schools.gov.uk",
    status: "invited",
    role: "member",
    title: "Deputy Headteacher",
    permissions: {},
    accessProfileId: profileIdForRole("member"),
    invitedBy: DEFAULT_SEED_USER.id,
    invitedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    joinedAt: null,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "d3333333-2041-4cf1-a3f8-8bb333333333",
    organizationId: SEED_ORGS[1].id,
    email: "volunteer-lead@thamesfoodbank.org.uk",
    status: "active",
    role: "viewer",
    title: "Volunteer Lead",
    permissions: {},
    accessProfileId: profileIdForRole("viewer"),
    invitedBy: DEFAULT_SEED_USER.id,
    invitedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    joinedAt: new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function remapAccessProfileId(id: string | null | undefined): string | null | undefined {
  if (!id) return id;
  return LEGACY_ACCESS_PROFILE_IDS[id] ?? id;
}

function migrateStore(raw: Record<string, unknown>): { store: DBStore; migrated: boolean } {
  let migrated = false;

  const users = ((raw.users as UserRecord[]) || []).map((u) =>
    defaultProfile({
      ...u,
      passwordHash: (u as UserRecord).passwordHash,
      id: u.id,
      email: u.email,
      fullName: u.fullName,
    })
  );

  const organizations = ((raw.organizations as Organization[]) || []).map((o) =>
    baseOrg({ ...o, createdBy: o.createdBy, id: o.id, name: o.name, type: o.type })
  );

  const members = ((raw.members as OrganizationMember[]) || []).map((m) => {
    const nextProfileId = remapAccessProfileId(m.accessProfileId);
    if (nextProfileId !== m.accessProfileId) migrated = true;
    return {
      ...m,
      accessProfileId: nextProfileId ?? m.accessProfileId,
      permissions: m.permissions ?? {},
      updatedAt: m.updatedAt ?? m.invitedAt,
    };
  });

  let accessProfiles = (raw.accessProfiles as AccessProfile[]) || SEED_ACCESS_PROFILES;
  if (accessProfiles.some((p) => p.id.startsWith("ap-"))) {
    accessProfiles = SEED_ACCESS_PROFILES;
    migrated = true;
  }

  const store: DBStore = {
    users: users.length ? users : [DEFAULT_SEED_USER],
    organizations: organizations.length ? organizations : SEED_ORGS,
    members: members.length ? members : SEED_MEMBERS,
    activityLogs: (raw.activityLogs as ActivityLog[]) || [],
    uploadedFiles: (raw.uploadedFiles as UploadedFile[]) || [],
    sessions: (raw.sessions as UserSession[]) || [],
    accessProfiles,
  };

  return { store, migrated };
}

function initDB(): DBStore {
  try {
    if (fs.existsSync(DB_PATH)) {
      const { store: migratedStore, migrated } = migrateStore(JSON.parse(fs.readFileSync(DB_PATH, "utf-8")));
      if (migrated) saveDB(migratedStore);
      return migratedStore;
    }
  } catch (err) {
    console.error("Failed to read database, initializing fresh", err);
  }

  const initial: DBStore = {
    users: [DEFAULT_SEED_USER],
    organizations: SEED_ORGS,
    members: SEED_MEMBERS,
    activityLogs: [],
    uploadedFiles: [],
    sessions: [],
    accessProfiles: SEED_ACCESS_PROFILES,
  };
  saveDB(initial);
  return initial;
}

function saveDB(store: DBStore) {
  fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2), "utf-8");
}

function stripUser(user: UserRecord): Profile {
  const { passwordHash: _, ...profile } = user;
  return profile;
}

function log(ctx: ActivityContext, action: ActivityLog["action"], description: string, opts?: Parameters<typeof createActivityLog>[3]) {
  const entry = createActivityLog(ctx, action, description, opts);
  const catalog = ACTIVITY_ACTION_CATALOG[action];
  const user = store.users.find((u) => u.id === ctx.userId);
  const org = ctx.organizationId ? store.organizations.find((o) => o.id === ctx.organizationId) : null;
  store.activityLogs.unshift({
    ...entry,
    actionLabel: catalog?.label ?? action,
    category: catalog?.category ?? "general",
    severity: catalog?.severity ?? "info",
    actorName: user?.fullName ?? null,
    actorEmail: user?.email ?? null,
    organizationName: org?.name ?? null,
  });
  if (store.activityLogs.length > 5000) store.activityLogs.length = 5000;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function validateOrgFields(type: OrgType, data: Partial<CreateOrgInput>) {
  if (data.name && data.name.length < 2) throw new Error("Organisation name must be at least 2 characters");
  if (type === "school" && (!data.schoolDistrict || !data.schoolDistrict.trim())) {
    throw new Error("Local authority or trust name is required");
  }
  if (type === "nonprofit" && (!data.nonprofitEin || !isValidCharityRegNumber(data.nonprofitEin))) {
    throw new Error("Enter a valid charity registration number (6–8 digits, e.g. 1234567)");
  }
  if (type === "business" && (!data.businessRegNumber || !data.businessRegNumber.trim())) {
    throw new Error("Companies House registration number is required");
  }
}

function mapOrgInput(type: OrgType, data: CreateOrgInput | UpdateOrgInput): Partial<Organization> {
  return {
    name: data.name,
    slug: data.slug?.trim() || (data.name ? slugify(data.name) : undefined),
    description: data.description || null,
    website: data.website || null,
    contactEmail: data.contactEmail || null,
    contactPhone: data.contactPhone || null,
    status: (data.status as OrgStatus) || undefined,
    addressLine1: data.addressLine1 || null,
    addressLine2: data.addressLine2 || null,
    city: data.city || null,
    stateRegion: data.stateRegion || null,
    postalCode: data.postalCode || null,
    country: data.country || null,
    timezone: data.timezone,
    locale: data.locale,
    currency: data.currency,
    tags: data.tags || undefined,
    schoolDistrict: type === "school" ? data.schoolDistrict || null : null,
    schoolGradeLevels: type === "school" ? data.schoolGradeLevels || null : null,
    schoolAccreditation: type === "school" ? data.schoolAccreditation || null : null,
    schoolStudentCount: type === "school" && data.schoolStudentCount ? Number(data.schoolStudentCount) : null,
    nonprofitEin: type === "nonprofit" ? data.nonprofitEin || null : null,
    nonprofitTaxStatus: type === "nonprofit" ? data.nonprofitTaxStatus || null : null,
    nonprofitMission: type === "nonprofit" ? data.nonprofitMission || null : null,
    nonprofitFoundedYear: type === "nonprofit" && data.nonprofitFoundedYear ? Number(data.nonprofitFoundedYear) : null,
    businessRegNumber: type === "business" ? data.businessRegNumber || null : null,
    businessIndustry: type === "business" ? data.businessIndustry || null : null,
    businessCompanySize: type === "business" ? data.businessCompanySize || null : null,
    businessTaxId: type === "business" ? data.businessTaxId || null : null,
    businessDunsNumber: type === "business" ? data.businessDunsNumber || null : null,
  };
}

const store = initDB();

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const db = {
  getUploadsDir: () => UPLOADS_DIR,

  findUserByEmail(email: string) {
    return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },

  findUserById(id: string) {
    return store.users.find((u) => u.id === id);
  },

  createUser(
    email: string,
    passwordPlain: string,
    fullName: string,
    extras?: { phone?: string; jobTitle?: string; timezone?: string },
    ctx?: ActivityContext
  ): Profile {
    if (this.findUserByEmail(email)) throw new Error("A user with this email already exists");
    const user = defaultProfile({
      id: crypto.randomUUID(),
      email,
      fullName,
      phone: extras?.phone || null,
      jobTitle: extras?.jobTitle || null,
      timezone: extras?.timezone || "Europe/London",
      passwordHash: hashPassword(passwordPlain),
    });
    store.users.push(user);
    if (ctx) log({ ...ctx, userId: user.id }, "auth.sign_up", `Registered account ${email}`, { entityType: "user", entityId: user.id });
    sendWelcomeEmailLocal(email, fullName);
    saveDB(store);
    return stripUser(user);
  },

  hashCompare(plain: string, hash: string) {
    return verifyPassword(plain, hash);
  },

  upgradePasswordHashIfNeeded(userId: string, plainPassword: string) {
    const user = this.findUserById(userId);
    if (!user || !needsPasswordRehash(user.passwordHash)) return;
    user.passwordHash = hashPassword(plainPassword);
    user.updatedAt = new Date().toISOString();
    saveDB(store);
  },

  createSession(userId: string, meta: { ipAddress?: string | null; userAgent?: string | null }) {
    store.sessions.forEach((s) => {
      if (s.userId === userId) s.isCurrent = false;
    });
    const session: UserSession = {
      id: crypto.randomUUID(),
      userId,
      deviceLabel: meta.userAgent?.includes("Mobile") ? "Mobile device" : "Desktop browser",
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      isCurrent: true,
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      revokedAt: null,
    };
    store.sessions.unshift(session);
    saveDB(store);
    return session;
  },

  touchSession(sessionId: string) {
    const s = store.sessions.find((x) => x.id === sessionId && !x.revokedAt);
    if (s) {
      s.lastActiveAt = new Date().toISOString();
      saveDB(store);
    }
  },

  recordSignIn(userId: string, ctx: ActivityContext, sessionId: string) {
    const user = this.findUserById(userId);
    if (user) {
      user.lastLoginAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
    }
    log(ctx, "auth.sign_in", "Signed in to admin dashboard", { entityType: "session", entityId: sessionId });
    saveDB(store);
  },

  recordSignOut(_userId: string, ctx: ActivityContext, sessionId?: string) {
    if (sessionId) {
      const s = store.sessions.find((x) => x.id === sessionId);
      if (s) {
        s.revokedAt = new Date().toISOString();
        s.isCurrent = false;
      }
    }
    log(ctx, "auth.sign_out", "Signed out", { entityType: "session", entityId: sessionId });
    saveDB(store);
  },

  getSessions(userId: string) {
    return store.sessions.filter((s) => s.userId === userId && !s.revokedAt);
  },

  revokeSession(userId: string, sessionId: string, ctx: ActivityContext) {
    const s = store.sessions.find((x) => x.id === sessionId && x.userId === userId);
    if (!s) throw new Error("Session not found");
    s.revokedAt = new Date().toISOString();
    s.isCurrent = false;
    log(ctx, "account.session_revoke", "Revoked a login session", { entityType: "session", entityId: sessionId });
    saveDB(store);
  },

  updateProfile(userId: string, data: UpdateProfilePayload, ctx: ActivityContext): Profile {
    const user = this.findUserById(userId);
    if (!user) throw new Error("User not found");
    Object.assign(user, {
      fullName: data.fullName,
      phone: data.phone ?? null,
      jobTitle: data.jobTitle ?? null,
      department: data.department ?? null,
      bio: data.bio ?? null,
      timezone: data.timezone || user.timezone,
      locale: data.locale || user.locale,
      updatedAt: new Date().toISOString(),
    });
    log(ctx, "profile.update", "Updated profile information", { entityType: "user", entityId: userId, metadata: data });
    saveDB(store);
    return stripUser(user);
  },

  updatePreferences(userId: string, data: UpdatePreferencesInput, ctx: ActivityContext): Profile {
    const user = this.findUserById(userId);
    if (!user) throw new Error("User not found");
    Object.assign(user, {
      theme: data.theme as ThemePreference,
      notifyEmail: data.notifyEmail,
      notifyPush: data.notifyPush,
      notifySms: data.notifySms,
      notifyMarketing: data.notifyMarketing,
      updatedAt: new Date().toISOString(),
    });
    log(ctx, "profile.preferences_update", "Updated notification and theme preferences", {
      entityType: "user",
      entityId: userId,
    });
    saveDB(store);
    return stripUser(user);
  },

  changePassword(userId: string, currentPassword: string, newPassword: string, ctx: ActivityContext) {
    const user = this.findUserById(userId);
    if (!user || !this.hashCompare(currentPassword, user.passwordHash)) {
      throw new Error("Current password is incorrect");
    }
    user.passwordHash = hashPassword(newPassword);
    user.updatedAt = new Date().toISOString();
    log(ctx, "auth.password_change", "Changed account password", { entityType: "user", entityId: userId });
    saveDB(store);
  },

  resetPassword(userId: string, newPassword: string, ctx: ActivityContext) {
    const user = this.findUserById(userId);
    if (!user) throw new Error("User not found");
    user.passwordHash = hashPassword(newPassword);
    user.updatedAt = new Date().toISOString();
    log(ctx, "auth.password_change", "Reset account password via email link", {
      entityType: "user",
      entityId: userId,
    });
    saveDB(store);
  },

  deactivateAccount(userId: string, ctx: ActivityContext) {
    const user = this.findUserById(userId);
    if (!user) throw new Error("User not found");
    user.accountStatus = "deactivated";
    user.updatedAt = new Date().toISOString();
    log(ctx, "account.deactivate", "Deactivated account", { entityType: "user", entityId: userId });
    saveDB(store);
  },

  setAvatarUrl(userId: string, avatarUrl: string, ctx: ActivityContext): Profile {
    const user = this.findUserById(userId);
    if (!user) throw new Error("User not found");
    user.avatarUrl = avatarUrl;
    user.updatedAt = new Date().toISOString();
    log(ctx, "profile.avatar_upload", "Updated profile avatar", { entityType: "user", entityId: userId });
    saveDB(store);
    return stripUser(user);
  },

  clearAvatarUrl(userId: string, ctx: ActivityContext): Profile {
    const user = this.findUserById(userId);
    if (!user) throw new Error("User not found");
    if (user.avatarUrl) {
      this.removeUploadedFileByPublicUrl(user.avatarUrl);
    }
    user.avatarUrl = null;
    user.updatedAt = new Date().toISOString();
    log(ctx, "file.delete", "Removed profile avatar", { entityType: "user", entityId: userId });
    saveDB(store);
    return stripUser(user);
  },

  /** Directory: orgs the user created or belongs to as an active member. */
  getOrganizationsForUser(userId: string) {
    const user = store.users.find((u) => u.id === userId);
    const orgIds = new Set<string>();

    if (user?.isAdmin) {
      store.organizations.forEach((o) => orgIds.add(o.id));
    } else {
      store.organizations.filter((o) => o.createdBy === userId).forEach((o) => orgIds.add(o.id));
      store.members
        .filter((m) => m.userId === userId && m.status === "active")
        .forEach((m) => orgIds.add(m.organizationId));
    }

    return store.organizations
      .filter((o) => orgIds.has(o.id))
      .map((o) => ({
        ...o,
        _count_members: store.members.filter((m) => m.organizationId === o.id && m.status !== "removed").length,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getInvitePreview(orgId: string, email: string): InvitePreview | null {
    const normalized = email.toLowerCase().trim();
    const org = store.organizations.find((o) => o.id === orgId);
    if (!org) return null;

    const member = store.members.find(
      (m) => m.organizationId === orgId && m.email === normalized && m.status !== "removed",
    );
    if (!member) return null;

    const existingUser = this.findUserByEmail(normalized);
    return {
      orgId,
      orgName: org.name,
      email: normalized,
      role: member.role,
      title: member.title ?? null,
      memberStatus: member.status,
      accountExists: !!existingUser,
      canRegister: member.status === "invited" && !existingUser,
      canAcceptWhileSignedIn: member.status === "invited" && !!existingUser,
    };
  },

  activatePendingInvites(userId: string, email: string, ctx?: ActivityContext): string[] {
    const normalized = email.toLowerCase().trim();
    const now = new Date().toISOString();
    const activatedOrgIds: string[] = [];

    for (const member of store.members) {
      if (member.email !== normalized || member.status !== "invited") continue;
      const org = store.organizations.find((o) => o.id === member.organizationId);
      member.userId = userId;
      member.status = "active";
      member.joinedAt = now;
      member.updatedAt = now;
      activatedOrgIds.push(member.organizationId);
      if (ctx) {
        log(
          { ...ctx, userId, organizationId: member.organizationId },
          "member.accept",
          `Accepted invitation to ${org?.name ?? "organisation"}`,
          { entityType: "member", entityId: member.id, metadata: { email: normalized } },
        );
      }
    }

    if (activatedOrgIds.length) saveDB(store);
    return activatedOrgIds;
  },

  acceptInviteRegistration(
    orgId: string,
    email: string,
    passwordPlain: string,
    fullName: string,
    extras?: { phone?: string; jobTitle?: string; timezone?: string },
    ctx?: ActivityContext,
  ): { user: Profile; member: OrganizationMember } {
    const normalized = email.toLowerCase().trim();
    const preview = this.getInvitePreview(orgId, normalized);
    if (!preview || preview.memberStatus !== "invited") {
      throw new Error("This invitation is no longer valid");
    }
    if (preview.accountExists) {
      throw new Error("An account already exists for this email. Sign in to accept the invitation.");
    }

    const member = store.members.find(
      (m) => m.organizationId === orgId && m.email === normalized && m.status === "invited",
    );
    if (!member) throw new Error("This invitation is no longer valid");

    const org = store.organizations.find((o) => o.id === orgId);
    const profile = this.createUser(normalized, passwordPlain, fullName, extras, ctx);
    const now = new Date().toISOString();
    member.userId = profile.id;
    member.status = "active";
    member.joinedAt = now;
    member.updatedAt = now;

    if (ctx) {
      log(
        { ...ctx, userId: profile.id, organizationId: orgId },
        "member.accept",
        `Accepted invitation to ${org?.name ?? "organisation"}`,
        { entityType: "member", entityId: member.id, metadata: { email: normalized } },
      );
    }

    saveDB(store);
    return { user: profile, member };
  },

  /** @deprecated Use getOrganizationsForUser */
  getOrganizationsByAdmin(adminId: string) {
    return this.getOrganizationsForUser(adminId);
  },

  getOrganizationById(orgId: string, adminId: string, ctx?: ActivityContext) {
    const org = store.organizations.find((o) => o.id === orgId);
    if (!org) return null;
    if (!canViewOrganization(adminId, orgId)) {
      throw new Error("You don't have permission to view this organisation");
    }
    if (ctx) log({ ...ctx, organizationId: orgId }, "org.view", `Viewed organization ${org.name}`, { entityType: "organization", entityId: orgId });
    saveDB(store);
    return org;
  },

  createOrganization(adminId: string, data: CreateOrgInput, ctx: ActivityContext) {
    validateOrgFields(data.type, data);
    const now = new Date().toISOString();
    const mapped = mapOrgInput(data.type, data);
    const newOrg: Organization = baseOrg({
      id: crypto.randomUUID(),
      type: data.type,
      createdBy: adminId,
      createdAt: now,
      updatedAt: now,
      ...mapped,
      name: data.name,
    } as Organization);
    store.organizations.push(newOrg);
    const creator = store.users.find((u) => u.id === adminId);
    store.members.push({
      id: crypto.randomUUID(),
      organizationId: newOrg.id,
      email: (creator?.email ?? `${adminId}@local.invalid`).toLowerCase(),
      userId: adminId,
      status: "active",
      role: "admin",
      title: null,
      department: null,
      phone: null,
      inviteMessage: null,
      invitedBy: adminId,
      permissions: {},
      accessProfileId: SEED_ACCESS_PROFILES.find((p) => p.slug === "org_owner")!.id,
      invitedAt: now,
      joinedAt: now,
      lastActiveAt: null,
      updatedAt: now,
    });
    log({ ...ctx, organizationId: newOrg.id }, "org.create", `Created organization ${newOrg.name}`, {
      entityType: "organization",
      entityId: newOrg.id,
      metadata: { type: newOrg.type },
    });
    saveDB(store);
    return newOrg;
  },

  updateOrganization(orgId: string, adminId: string, data: UpdateOrgInput, ctx: ActivityContext) {
    const org = store.organizations.find((o) => o.id === orgId);
    if (!org || !canManageOrganization(adminId, orgId)) throw new Error("You don't have permission to change this organisation");
    const type = (data.type || org.type) as OrgType;
    validateOrgFields(type, {
      name: data.name || org.name,
      schoolDistrict: data.schoolDistrict ?? org.schoolDistrict ?? undefined,
      nonprofitEin: data.nonprofitEin ?? org.nonprofitEin ?? undefined,
      businessRegNumber: data.businessRegNumber ?? org.businessRegNumber ?? undefined,
    });
    Object.assign(org, mapOrgInput(type, { ...data, name: data.name || org.name, type }), {
      type,
      updatedAt: new Date().toISOString(),
    });
    log({ ...ctx, organizationId: orgId }, "org.update", `Updated organization ${org.name}`, { entityType: "organization", entityId: orgId });
    saveDB(store);
    return org;
  },

  setOrganizationImage(
    orgId: string,
    adminId: string,
    field: "logoUrl" | "bannerUrl",
    url: string,
    ctx: ActivityContext
  ) {
    const org = store.organizations.find((o) => o.id === orgId);
    if (!org || org.createdBy !== adminId) throw new Error("You don't have permission to change this organisation");
    org[field] = url;
    org.updatedAt = new Date().toISOString();
    log({ ...ctx, organizationId: orgId }, field === "logoUrl" ? "org.logo_upload" : "org.banner_upload", `Updated organization ${field}`, {
      entityType: "organization",
      entityId: orgId,
    });
    saveDB(store);
    return org;
  },

  clearOrganizationImage(
    orgId: string,
    adminId: string,
    field: "logoUrl" | "bannerUrl",
    ctx: ActivityContext
  ) {
    const org = store.organizations.find((o) => o.id === orgId);
    if (!org || org.createdBy !== adminId) throw new Error("You don't have permission to change this organisation");
    const url = org[field];
    if (url) {
      this.removeUploadedFileByPublicUrl(url);
    }
    org[field] = null;
    org.updatedAt = new Date().toISOString();
    log(
      { ...ctx, organizationId: orgId },
      "file.delete",
      `Removed organization ${field === "logoUrl" ? "logo" : "banner"}`,
      { entityType: "organization", entityId: orgId }
    );
    saveDB(store);
    return org;
  },

  removeUploadedFileByPublicUrl(publicUrl: string) {
    const idx = store.uploadedFiles.findIndex((f) => f.publicUrl === publicUrl);
    if (idx < 0) return;
    const file = store.uploadedFiles[idx];
    try {
      if (fs.existsSync(file.storagePath)) fs.unlinkSync(file.storagePath);
    } catch {
      /* disk cleanup is best-effort */
    }
    store.uploadedFiles.splice(idx, 1);
  },

  getOrganizationMembers(orgId: string, adminId: string) {
    const org = this.getOrganizationById(orgId, adminId);
    if (!org) throw new Error("You don't have permission to view members for this organisation");
    return store.members
      .filter((m) => m.organizationId === orgId && m.status !== "removed")
      .map((m) => {
        const inviter = m.invitedBy ? store.users.find((u) => u.id === m.invitedBy) : undefined;
        return {
          ...m,
          invitedByName: inviter?.fullName ?? null,
          invitedByEmail: inviter?.email ?? null,
        };
      })
      .sort((a, b) => new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime());
  },

  inviteMember(
    adminId: string,
    orgId: string,
    email: string,
    role: MemberRole = "member",
    extras?: {
      title?: string;
      department?: string;
      phone?: string;
      inviteMessage?: string;
      accessProfileId?: string;
    },
    ctx?: ActivityContext
  ): OrganizationMember & { emailSent: boolean } {
    const org = store.organizations.find((o) => o.id === orgId);
    if (!org) throw new Error("Organisation not found");
    if (!canInviteMembers(adminId, orgId)) {
      throw new Error("You don't have permission to invite members");
    }
    const normalized = email.toLowerCase().trim();
    const activeDuplicate = store.members.some(
      (m) => m.organizationId === orgId && m.email === normalized && m.status !== "removed",
    );
    if (activeDuplicate) {
      throw new Error("This person has already been invited to this organisation");
    }

    const now = new Date().toISOString();
    const removed = store.members.find(
      (m) => m.organizationId === orgId && m.email === normalized && m.status === "removed",
    );

    let member: OrganizationMember;
    if (removed) {
      removed.status = "invited";
      removed.role = role;
      removed.title = extras?.title ?? null;
      removed.department = extras?.department ?? null;
      removed.phone = extras?.phone ?? null;
      removed.inviteMessage = extras?.inviteMessage ?? null;
      removed.invitedBy = adminId;
      removed.userId = null;
      removed.joinedAt = null;
      removed.invitedAt = now;
      removed.updatedAt = now;
      removed.accessProfileId = extras?.accessProfileId?.trim()
        ? extras.accessProfileId
        : profileIdForRole(role);
      member = removed;
    } else {
      member = {
        id: crypto.randomUUID(),
        organizationId: orgId,
        email: normalized,
        userId: null,
        status: "invited",
        role,
        title: extras?.title ?? null,
        department: extras?.department ?? null,
        phone: extras?.phone ?? null,
        inviteMessage: extras?.inviteMessage ?? null,
        invitedBy: adminId,
        permissions: {},
        accessProfileId: extras?.accessProfileId?.trim()
          ? extras.accessProfileId
          : profileIdForRole(role),
        invitedAt: now,
        joinedAt: null,
        updatedAt: now,
      };
      store.members.push(member);
    }

    if (ctx) {
      log({ ...ctx, organizationId: orgId }, "member.invite", `Invited ${normalized} to ${org.name}`, {
        entityType: "member",
        entityId: member.id,
        metadata: { email: normalized, role },
      });
    }

    let emailSent = false;
    try {
      const inviter = store.users.find((u) => u.id === adminId);
      sendOrgInviteEmailLocal({
        email: normalized,
        orgId,
        orgName: org.name,
        role,
        inviteMessage: extras?.inviteMessage,
        inviterName: inviter?.fullName ?? null,
      });
      emailSent = true;
    } catch (err) {
      console.error("[invite-member] email failed:", err);
    }

    saveDB(store);
    return { ...member, emailSent };
  },

  updateMember(orgId: string, memberId: string, adminId: string, data: Partial<OrganizationMember>, ctx: ActivityContext) {
    const org = this.getOrganizationById(orgId, adminId);
    if (!org) throw new Error("You don't have permission to do that");
    const member = store.members.find((m) => m.id === memberId && m.organizationId === orgId);
    if (!member) throw new Error("Member not found");
    if (data.role) {
      member.role = data.role as MemberRole;
      if (!(data as { accessProfileId?: string }).accessProfileId) {
        member.accessProfileId = profileIdForRole(member.role);
      }
    }
    if (data.status) member.status = data.status as MemberStatus;
    if (data.title !== undefined) member.title = data.title;
    if (data.department !== undefined) member.department = data.department;
    if (data.phone !== undefined) member.phone = data.phone;
    if ((data as { accessProfileId?: string }).accessProfileId !== undefined) {
      const nextProfile = (data as { accessProfileId?: string }).accessProfileId;
      member.accessProfileId = nextProfile?.trim()
        ? nextProfile
        : profileIdForRole(member.role);
    }
    member.updatedAt = new Date().toISOString();
    log({ ...ctx, organizationId: orgId }, "member.update", `Updated member ${member.email}`, { entityType: "member", entityId: memberId });
    saveDB(store);
    return member;
  },

  removeMember(orgId: string, memberId: string, adminId: string, ctx: ActivityContext) {
    const member = this.updateMember(orgId, memberId, adminId, { status: "removed" }, ctx);
    log({ ...ctx, organizationId: orgId }, "member.remove", `Removed member ${member.email}`, { entityType: "member", entityId: memberId });
    return member;
  },

  saveUploadedFile(record: Omit<UploadedFile, "id" | "createdAt">, ctx: ActivityContext) {
    const file: UploadedFile = { ...record, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    store.uploadedFiles.unshift(file);
    log({ ...ctx, organizationId: file.organizationId ?? ctx.organizationId }, "file.upload", `Uploaded ${file.originalFilename}`, {
      entityType: file.entityType,
      entityId: file.entityId,
      metadata: { mimeType: file.mimeType, sizeBytes: file.sizeBytes },
    });
    saveDB(store);
    return file;
  },

  getActivityLogs(userId: string, filters?: { organizationId?: string; action?: string; limit?: number }) {
    const user = this.findUserById(userId);
    let logs = user?.isAdmin
      ? [...store.activityLogs]
      : store.activityLogs.filter((l) => l.userId === userId);
    if (filters?.organizationId) {
      logs = logs.filter((l) => l.organizationId === filters.organizationId);
    }
    if (filters?.action) {
      logs = logs.filter((l) => l.action === filters.action);
    }
    return logs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, filters?.limit ?? 200);
  },

  getAccessProfiles() {
    return [...store.accessProfiles].sort((a, b) => a.sortOrder - b.sortOrder);
  },

  getAccessProfileById(id: string) {
    return store.accessProfiles.find((p) => p.id === id) ?? null;
  },

  getOrgActivityLogs(orgId: string, adminId: string, limit = 200) {
    const org = store.organizations.find((o) => o.id === orgId && o.createdBy === adminId);
    if (!org) throw new Error("You don't have permission to do that");
    return store.activityLogs.filter((l) => l.organizationId === orgId).slice(0, limit);
  },

  getStatistics(adminId: string) {
    const orgs = store.organizations.filter((o) => o.createdBy === adminId);
    const orgIds = new Set(orgs.map((o) => o.id));
    const members = store.members.filter(
      (m) => orgIds.has(m.organizationId) && m.status !== "removed",
    );
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const organizationsByType = { school: 0, nonprofit: 0, business: 0 } as Record<
      OrgType,
      number
    >;
    for (const org of orgs) {
      organizationsByType[org.type] += 1;
    }

    return {
      totalOrganizations: orgs.length,
      totalMembers: members.length,
      activeMembers: members.filter((m) => m.status === "active").length,
      pendingInvites: members.filter((m) => m.status === "invited").length,
      organizationsByType,
      organizationsCreatedThisMonth: orgs.filter(
        (o) => new Date(o.createdAt).getTime() >= monthStart.getTime(),
      ).length,
    };
  },
};

export type { UserRecord };
