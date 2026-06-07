import fs from "fs";
import path from "path";
import crypto from "crypto";
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
  UploadEntityType,
  CreateOrgInput,
  UpdateOrgInput,
  UpdateProfileInput,
  UpdatePreferencesInput,
  MemberRole,
  MemberStatus,
  AccessProfile,
} from "../types";
import { ACTIVITY_ACTION_CATALOG } from "../types";
import { createActivityLog, type ActivityContext } from "./activityLog";

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

const SEED_ACCESS_PROFILES: AccessProfile[] = [
  {
    id: "ap-platform-admin",
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
    id: "ap-org-owner",
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
    id: "ap-org-admin",
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
    id: "ap-org-member",
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
    id: "ap-org-viewer",
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

function defaultProfile(partial: Partial<UserRecord> & Pick<UserRecord, "id" | "email" | "fullName" | "passwordHash">): UserRecord {
  const now = new Date().toISOString();
  return {
    isAdmin: true,
    phone: null,
    avatarUrl: null,
    jobTitle: null,
    department: null,
    bio: null,
    timezone: "UTC",
    locale: "en-US",
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
  email: "admin@example.com",
  fullName: "System Admin",
  jobTitle: "Platform Administrator",
  department: "Operations",
  phone: "+1-555-0100",
  bio: "Default seeded admin account for evaluation.",
  passwordHash: crypto.createHash("sha256").update("Password123!").digest("hex"),
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
    country: "US",
    timezone: "America/Chicago",
    locale: "en-US",
    currency: "USD",
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
    name: "Oakridge Unified District",
    slug: "oakridge-unified",
    type: "school",
    createdBy: DEFAULT_SEED_USER.id,
    schoolDistrict: "District 204-A",
    schoolGradeLevels: "K-12",
    schoolAccreditation: "AdvancED",
    schoolStudentCount: 4200,
    description: "Public school district serving the Oakridge metropolitan area.",
    contactEmail: "admin@oakridge.edu",
    contactPhone: "+1-555-1001",
    city: "Oakridge",
    stateRegion: "IL",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  }),
  baseOrg({
    id: "b49a370c-9e12-454b-adc6-3cd491289402",
    name: "Hope Food Bank",
    slug: "hope-food-bank",
    type: "nonprofit",
    createdBy: DEFAULT_SEED_USER.id,
    nonprofitEin: "12-3456789",
    nonprofitTaxStatus: "501(c)(3)",
    nonprofitMission: "Eliminating hunger in our community through food distribution and education.",
    nonprofitFoundedYear: 1998,
    description: "Regional food bank network.",
    contactEmail: "info@hope.org",
    city: "Springfield",
    stateRegion: "IL",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  }),
  baseOrg({
    id: "c59c380d-0e23-465c-bdf7-4de592390503",
    name: "Acme Corporate Ventures",
    slug: "acme-corporate",
    type: "business",
    createdBy: DEFAULT_SEED_USER.id,
    businessRegNumber: "CORP-9812-B",
    businessIndustry: "Technology",
    businessCompanySize: "51-200",
    businessTaxId: "98-7654321",
    website: "https://acme.example.com",
    description: "B2B software and consulting.",
    contactEmail: "hello@acme.example.com",
    city: "Chicago",
    stateRegion: "IL",
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  }),
];

const SEED_MEMBERS: OrganizationMember[] = [
  {
    id: "d1111111-2041-4cf1-a3f8-8bb111111111",
    organizationId: SEED_ORGS[0].id,
    email: "principal@oakridge.edu",
    status: "active",
    role: "admin",
    title: "Principal",
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
    email: "viceprincipal@oakridge.edu",
    status: "invited",
    role: "member",
    title: "Vice Principal",
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
    email: "volunteer-lead@hope.org",
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

function migrateStore(raw: Record<string, unknown>): DBStore {
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

  const members = ((raw.members as OrganizationMember[]) || []).map((m) => ({
    permissions: {},
    updatedAt: m.invitedAt,
    ...m,
  }));

  return {
    users: users.length ? users : [DEFAULT_SEED_USER],
    organizations: organizations.length ? organizations : SEED_ORGS,
    members: members.length ? members : SEED_MEMBERS,
    activityLogs: (raw.activityLogs as ActivityLog[]) || [],
    uploadedFiles: (raw.uploadedFiles as UploadedFile[]) || [],
    sessions: (raw.sessions as UserSession[]) || [],
    accessProfiles: (raw.accessProfiles as AccessProfile[]) || SEED_ACCESS_PROFILES,
  };
}

function initDB(): DBStore {
  try {
    if (fs.existsSync(DB_PATH)) {
      return migrateStore(JSON.parse(fs.readFileSync(DB_PATH, "utf-8")));
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
  if (data.name && data.name.length < 2) throw new Error("Organization name must be at least 2 characters");
  if (type === "school" && (!data.schoolDistrict || !data.schoolDistrict.trim())) {
    throw new Error("School district is required");
  }
  if (type === "nonprofit" && (!data.nonprofitEin || !/^\d{2}-\d{7}$/.test(data.nonprofitEin))) {
    throw new Error("EIN must fit format XX-XXXXXXX");
  }
  if (type === "business" && (!data.businessRegNumber || !data.businessRegNumber.trim())) {
    throw new Error("Business registration number is required");
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
      timezone: extras?.timezone || "UTC",
      passwordHash: crypto.createHash("sha256").update(passwordPlain).digest("hex"),
    });
    store.users.push(user);
    if (ctx) log({ ...ctx, userId: user.id }, "auth.sign_up", `Registered account ${email}`, { entityType: "user", entityId: user.id });
    saveDB(store);
    return stripUser(user);
  },

  hashCompare(plain: string, hash: string) {
    return crypto.createHash("sha256").update(plain).digest("hex") === hash;
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

  recordSignOut(userId: string, ctx: ActivityContext, sessionId?: string) {
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

  updateProfile(userId: string, data: UpdateProfileInput, ctx: ActivityContext): Profile {
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
    user.passwordHash = crypto.createHash("sha256").update(newPassword).digest("hex");
    user.updatedAt = new Date().toISOString();
    log(ctx, "auth.password_change", "Changed account password", { entityType: "user", entityId: userId });
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

  getOrganizationsByAdmin(adminId: string) {
    return store.organizations
      .filter((o) => o.createdBy === adminId)
      .map((o) => ({
        ...o,
        _count_members: store.members.filter((m) => m.organizationId === o.id && m.status !== "removed").length,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getOrganizationById(orgId: string, adminId: string, ctx?: ActivityContext) {
    const org = store.organizations.find((o) => o.id === orgId);
    if (!org) return null;
    if (org.createdBy !== adminId) throw new Error("RLS Violation: Unauthorized access to this organization");
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
    if (!org || org.createdBy !== adminId) throw new Error("RLS Violation: Unauthorized");
    const type = (data.type || org.type) as OrgType;
    validateOrgFields(type, { ...org, ...data, type, name: data.name || org.name });
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
    if (!org || org.createdBy !== adminId) throw new Error("RLS Violation: Unauthorized");
    org[field] = url;
    org.updatedAt = new Date().toISOString();
    log({ ...ctx, organizationId: orgId }, field === "logoUrl" ? "org.logo_upload" : "org.banner_upload", `Updated organization ${field}`, {
      entityType: "organization",
      entityId: orgId,
    });
    saveDB(store);
    return org;
  },

  getOrganizationMembers(orgId: string, adminId: string) {
    const org = this.getOrganizationById(orgId, adminId);
    if (!org) throw new Error("RLS Violation: Unauthorized member view");
    return store.members
      .filter((m) => m.organizationId === orgId && m.status !== "removed")
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
  ) {
    const org = this.getOrganizationById(orgId, adminId);
    if (!org) throw new Error("Unauthorized: You do not have admin permissions for this organization");
    const normalized = email.toLowerCase().trim();
    if (store.members.some((m) => m.organizationId === orgId && m.email === normalized && m.status !== "removed")) {
      throw new Error("Conflict: This email has already been invited to this organization");
    }
    const member: OrganizationMember = {
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
      invitedAt: new Date().toISOString(),
      joinedAt: null,
      updatedAt: new Date().toISOString(),
    };
    store.members.push(member);
    if (ctx) {
      log({ ...ctx, organizationId: orgId }, "member.invite", `Invited ${normalized} to ${org.name}`, {
        entityType: "member",
        entityId: member.id,
        metadata: { email: normalized, role },
      });
      console.log(`[SIMULATED MAIL] Invite sent to ${normalized} for org ${org.name}`);
    }
    saveDB(store);
    return member;
  },

  updateMember(orgId: string, memberId: string, adminId: string, data: Partial<OrganizationMember>, ctx: ActivityContext) {
    const org = this.getOrganizationById(orgId, adminId);
    if (!org) throw new Error("Unauthorized");
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
    if (!org) throw new Error("Unauthorized");
    return store.activityLogs.filter((l) => l.organizationId === orgId).slice(0, limit);
  },
};

export type { UserRecord };
