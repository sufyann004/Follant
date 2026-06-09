/**
 * One-time import: local db.json → Supabase (service role).
 * Usage: node scripts/import-db-to-supabase.mjs
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.SUPABASE_URL_PROD || process.env.VITE_SUPABASE_URL_DEV;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY_PROD;

if (!url || !key) {
  console.error("Missing SUPABASE_URL_PROD and SUPABASE_SERVICE_ROLE_KEY_PROD in .env");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

async function rest(path, options = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...options, headers: { ...headers, ...options.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function normalizeEin(value) {
  if (!value) return null;
  if (/^\d{2}-\d{7}$/.test(value)) return value;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return null;
}

function orgToRow(org, createdBy) {
  const nonprofitEin = org.type === "nonprofit" ? normalizeEin(org.nonprofitEin) ?? "12-3456789" : null;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    type: org.type,
    description: org.description,
    website: org.website,
    contact_email: org.contactEmail,
    contact_phone: org.contactPhone,
    logo_url: org.logoUrl?.startsWith("/uploads/") ? null : org.logoUrl,
    banner_url: org.bannerUrl?.startsWith("/uploads/") ? null : org.bannerUrl,
    status: org.status ?? "active",
    created_by: createdBy,
    address_line1: org.addressLine1,
    address_line2: org.addressLine2,
    city: org.city,
    state_region: org.stateRegion,
    postal_code: org.postalCode,
    country: org.country ?? "GB",
    timezone: org.timezone ?? "Europe/London",
    locale: org.locale ?? "en-GB",
    currency: org.currency ?? "GBP",
    tags: org.tags ?? [],
    settings: org.settings ?? {},
    school_district: org.schoolDistrict,
    school_grade_levels: org.schoolGradeLevels,
    school_accreditation: org.schoolAccreditation,
    school_student_count: org.schoolStudentCount,
    nonprofit_ein: nonprofitEin,
    nonprofit_tax_status: org.nonprofitTaxStatus,
    nonprofit_mission: org.nonprofitMission,
    nonprofit_founded_year: org.nonprofitFoundedYear,
    business_reg_number: org.businessRegNumber,
    business_industry: org.businessIndustry,
    business_company_size: org.businessCompanySize,
    business_tax_id: org.businessTaxId,
    business_duns_number: org.businessDunsNumber,
    created_at: org.createdAt,
    updated_at: org.updatedAt,
  };
}

const roleToSlug = {
  admin: "org_admin",
  member: "org_member",
  viewer: "org_viewer",
};

async function main() {
  const db = JSON.parse(readFileSync(join(__dirname, "..", "db.json"), "utf8"));
  const users = (await fetch(`${url}/auth/v1/admin/users?per_page=100`, { headers }).then((r) => r.json())).users;
  const admin = users.find((u) => u.email?.toLowerCase() === "admin@example.com");
  if (!admin) throw new Error("admin@example.com not found in Supabase Auth");

  const profiles = await rest("access_profiles?select=id,slug");
  const profileBySlug = new Map(profiles.map((p) => [p.slug, p.id]));

  const existing = await rest("organizations?select=id");
  const existingIds = new Set(existing.map((o) => o.id));

  let orgCount = 0;
  for (const org of db.organizations ?? []) {
    if (existingIds.has(org.id)) {
      console.log("Skip org (exists):", org.name);
      continue;
    }
    await rest("organizations", {
      method: "POST",
      body: JSON.stringify(orgToRow(org, admin.id)),
    });
    orgCount++;
    console.log("Imported org:", org.name);
  }

  const localAdminId = db.users?.[0]?.id;
  let memberCount = 0;
  for (const m of db.members ?? []) {
    const exists = await rest(`organization_members?id=eq.${m.id}&select=id`);
    if (exists.length > 0) continue;

    const row = {
      id: m.id,
      organization_id: m.organizationId,
      email: m.email?.toLowerCase().trim(),
      user_id: m.userId === localAdminId ? admin.id : m.userId ?? null,
      status: m.status,
      role: m.role,
      title: m.title ?? null,
      department: m.department ?? null,
      phone: m.phone ?? null,
      invite_message: m.inviteMessage ?? null,
      invited_by: m.invitedBy === localAdminId ? admin.id : m.invitedBy ?? null,
      access_profile_id: profileBySlug.get(roleToSlug[m.role] ?? "org_member") ?? null,
      invited_at: m.invitedAt,
      joined_at: m.joinedAt,
      updated_at: m.updatedAt ?? m.invitedAt,
    };

    try {
      await rest("organization_members", { method: "POST", body: JSON.stringify(row) });
      memberCount++;
    } catch (err) {
      console.warn("Member skip:", m.email, err.message);
    }
  }

  console.log(`Done. Imported ${orgCount} orgs, ${memberCount} members for ${admin.email}`);

  const existingLogIds = new Set(
    (await rest("activity_logs?select=id")).map((row) => row.id),
  );
  const orgIdSet = new Set([...existingIds, ...(db.organizations ?? []).map((o) => o.id)]);

  function activityToRow(log) {
    const userId = log.userId === localAdminId ? admin.id : admin.id;
    return {
      id: log.id,
      user_id: userId,
      organization_id: log.organizationId && orgIdSet.has(log.organizationId) ? log.organizationId : null,
      action: log.action,
      entity_type: log.entityType ?? null,
      entity_id: log.entityId ?? null,
      description: log.description,
      metadata: log.metadata ?? {},
      ip_address: log.ipAddress ?? null,
      user_agent: log.userAgent ?? null,
      created_at: log.createdAt,
      action_label: log.actionLabel ?? null,
      category: log.category ?? null,
      severity: log.severity ?? "info",
      actor_name: log.actorName ?? null,
      actor_email: log.actorEmail ?? null,
      organization_name: log.organizationName ?? null,
    };
  }

  const pendingLogs = (db.activityLogs ?? []).filter((log) => !existingLogIds.has(log.id));
  let logCount = 0;
  const batchSize = 100;
  for (let i = 0; i < pendingLogs.length; i += batchSize) {
    const batch = pendingLogs.slice(i, i + batchSize).map(activityToRow);
    try {
      await rest("activity_logs", { method: "POST", body: JSON.stringify(batch) });
      logCount += batch.length;
    } catch (err) {
      console.warn(`Activity batch ${i / batchSize + 1} skip:`, err.message);
    }
  }
  console.log(`Imported ${logCount} activity logs (${pendingLogs.length} pending, ${existingLogIds.size} already in Supabase)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
