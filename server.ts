import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { db } from "./src/server/db.ts";
import { upload, publicUploadUrl } from "./src/server/upload.ts";
import { getRequestMeta } from "./src/server/activityLog.ts";
import {
  createOrgSchema,
  updateOrgSchema,
  inviteMemberRequestSchema,
  updateMemberSchema,
  updateProfileApiSchema,
  updatePreferencesSchema,
  changePasswordSchema,
  ACTIVITY_ACTIONS,
} from "./src/types.ts";
import { passwordStrengthSchema } from "./src/lib/validation.ts";
import { sendPasswordResetEmailLocal, consumePasswordResetToken } from "./src/server/email.ts";
import {
  assertProductionSecurityConfig,
  createSessionToken,
  verifySessionToken,
  securityHeaders,
  rateLimit,
  safeUploadHeaders,
  type SessionTokenPayload,
} from "./src/server/security.ts";
import { isSupabaseOnlyMode } from "./src/server/supabase-mode.ts";

async function startServer() {
  assertProductionSecurityConfig();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const supabaseOnly = isSupabaseOnlyMode();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(express.json({ limit: "2mb" }));
  app.use("/uploads", safeUploadHeaders, express.static(path.join(process.cwd(), "uploads")));

  function getAuthenticatedUser(req: express.Request): SessionTokenPayload | null {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return null;
    const payload = verifySessionToken(authHeader.slice(7));
    if (!payload) return null;
    db.touchSession(payload.sessionId);
    return payload;
  }

  const authRateLimit = rateLimit({
    keyPrefix: "auth",
    windowMs: 15 * 60 * 1000,
    max: 30,
  });

  function activityCtx(req: express.Request, userId: string, organizationId?: string | null) {
    const meta = getRequestMeta(req);
    return { userId, organizationId, ...meta };
  }

  function requireAuth(req: express.Request, res: express.Response) {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthenticated" });
      return null;
    }
    const record = db.findUserById(user.id);
    if (!record || record.accountStatus === "deactivated" || record.accountStatus === "suspended") {
      res.status(403).json({ error: "Account is not active" });
      return null;
    }
    if (!record.isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return null;
    }
    return user;
  }

  if (supabaseOnly) {
    console.log("[SERVER] Supabase-only mode — legacy /api routes disabled");
  } else {
  // ─── Auth ───────────────────────────────────────────────────────────────────

  app.post("/api/auth/sign-in", authRateLimit, (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
      const user = db.findUserByEmail(email);
      if (!user || !db.hashCompare(password, user.passwordHash)) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      db.upgradePasswordHashIfNeeded(user.id, password);
      const meta = getRequestMeta(req);
      const session = db.createSession(user.id, meta);
      db.activatePendingInvites(user.id, user.email, activityCtx(req, user.id));
      db.recordSignIn(user.id, activityCtx(req, user.id), session.id);
      const { passwordHash, ...profile } = user;
      return res.json({ user: profile, token: createSessionToken(user, session.id) });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Sign in failed" });
    }
  });

  app.post("/api/auth/sign-up", (_req, res) => {
    return res.status(403).json({
      error: "Access is by invitation only. Use the link in your invitation email to set up your account.",
    });
  });

  app.get("/api/invites/preview", authRateLimit, (req, res) => {
    const orgId = typeof req.query.orgId === "string" ? req.query.orgId : typeof req.query.org === "string" ? req.query.org : "";
    const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
    if (!orgId || !email) {
      return res.status(400).json({ error: "Organisation and email are required" });
    }
    const preview = db.getInvitePreview(orgId, email);
    if (!preview) {
      return res.status(404).json({ error: "This invitation link is invalid or has expired" });
    }
    return res.json(preview);
  });

  app.post("/api/auth/accept-invite", authRateLimit, (req, res) => {
    try {
      const { orgId, email, password, fullName, phone, jobTitle, timezone } = req.body ?? {};
      if (!orgId || !email || !password || !fullName) {
        return res.status(400).json({ error: "Invitation details and account fields are required" });
      }
      if (typeof password !== "string") {
        return res.status(400).json({ error: "Password is required" });
      }
      const passwordCheck = passwordStrengthSchema.safeParse(password);
      if (!passwordCheck.success) {
        return res.status(400).json({ error: passwordCheck.error.issues[0]?.message ?? "Invalid password" });
      }
      const { user: profile } = db.acceptInviteRegistration(
        String(orgId),
        String(email),
        String(password),
        String(fullName),
        {
          phone: typeof phone === "string" ? phone : undefined,
          jobTitle: typeof jobTitle === "string" ? jobTitle : undefined,
          timezone: typeof timezone === "string" ? timezone : undefined,
        },
        activityCtx(req, "system"),
      );
      const meta = getRequestMeta(req);
      const session = db.createSession(profile.id, meta);
      db.recordSignIn(profile.id, activityCtx(req, profile.id), session.id);
      return res.status(201).json({
        user: profile,
        token: createSessionToken({ ...profile, fullName: profile.fullName }, session.id),
        orgId: String(orgId),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not accept invitation";
      const status = msg.includes("already exists") ? 409 : msg.includes("no longer valid") ? 404 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.post("/api/auth/sign-out", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    db.recordSignOut(user.id, activityCtx(req, user.id), user.sessionId);
    return res.json({ ok: true });
  });

  app.get("/api/auth/me", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const current = db.findUserById(user.id);
    if (!current) return res.status(404).json({ error: "User profile not found" });
    const { passwordHash, ...profile } = current;
    return res.json({ user: profile });
  });

  app.post("/api/auth/forgot-password", authRateLimit, (req, res) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!email) return res.status(400).json({ error: "Email is required" });
      const user = db.findUserByEmail(email);
      if (user) {
        sendPasswordResetEmailLocal(email, user.id);
      }
      return res.json({ ok: true, message: "If an account exists for that email, a reset link has been sent." });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Request failed" });
    }
  });

  app.post("/api/auth/reset-password", authRateLimit, (req, res) => {
    try {
      const { token, password } = req.body ?? {};
      if (!token || !password) return res.status(400).json({ error: "Token and password are required" });
      if (typeof password !== "string") {
        return res.status(400).json({ error: "Password is required" });
      }
      const passwordCheck = passwordStrengthSchema.safeParse(password);
      if (!passwordCheck.success) {
        return res.status(400).json({ error: passwordCheck.error.issues[0]?.message ?? "Invalid password" });
      }
      const entry = consumePasswordResetToken(String(token));
      if (!entry) return res.status(400).json({ error: "Invalid or expired reset link" });
      db.resetPassword(entry.userId, password, activityCtx(req, entry.userId));
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Reset failed" });
    }
  });

  app.get("/api/statistics", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    return res.json(db.getStatistics(user.id));
  });

  // ─── Account management ─────────────────────────────────────────────────────

  app.patch("/api/account/profile", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const parsed = updateProfileApiSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    try {
      const profile = db.updateProfile(user.id, parsed.data, activityCtx(req, user.id));
      return res.json({ user: profile });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Update failed" });
    }
  });

  app.patch("/api/account/preferences", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const parsed = updatePreferencesSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    try {
      const profile = db.updatePreferences(user.id, parsed.data, activityCtx(req, user.id));
      return res.json({ user: profile });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Update failed" });
    }
  });

  app.post("/api/account/change-password", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    try {
      db.changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword, activityCtx(req, user.id));
      return res.json({ ok: true });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Password change failed" });
    }
  });

  app.post("/api/account/deactivate", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    db.deactivateAccount(user.id, activityCtx(req, user.id));
    return res.json({ ok: true });
  });

  app.get("/api/account/sessions", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const sessions = db.getSessions(user.id).map((s) => ({ ...s, isCurrent: s.id === user.sessionId }));
    return res.json(sessions);
  });

  app.delete("/api/account/sessions/:id", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (req.params.id === user.sessionId) {
      return res.status(400).json({ error: "Cannot revoke your current session from this device" });
    }
    try {
      db.revokeSession(user.id, req.params.id, activityCtx(req, user.id));
      return res.json({ ok: true });
    } catch (err) {
      return res.status(404).json({ error: err instanceof Error ? err.message : "Not found" });
    }
  });

  app.post("/api/account/avatar", upload.single("file"), (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = publicUploadUrl(req.file.filename);
    db.saveUploadedFile(
      {
        uploadedBy: user.id,
        organizationId: null,
        entityType: "profile",
        entityId: user.id,
        originalFilename: req.file.originalname,
        storedFilename: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storagePath: req.file.path,
        publicUrl: url,
      },
      activityCtx(req, user.id)
    );
    const profile = db.setAvatarUrl(user.id, url, activityCtx(req, user.id));
    return res.json({ user: profile, url });
  });

  app.delete("/api/account/avatar", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const profile = db.clearAvatarUrl(user.id, activityCtx(req, user.id));
      return res.json({ user: profile });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Could not remove avatar" });
    }
  });

  // ─── Activity logs ──────────────────────────────────────────────────────────

  app.get("/api/activity", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const logs = db.getActivityLogs(user.id, {
      organizationId: typeof req.query.organizationId === "string" ? req.query.organizationId : undefined,
      action: typeof req.query.action === "string" ? req.query.action : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 200,
    });
    return res.json(logs);
  });

  app.get("/api/activity/actions", (_req, res) => {
    return res.json(ACTIVITY_ACTIONS);
  });

  app.get("/api/access-profiles", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;
    let profiles = db.getAccessProfiles();
    if (scope === "platform" || scope === "organization") {
      profiles = profiles.filter((p) => p.scope === scope);
    }
    return res.json(profiles);
  });

  app.get("/api/organizations/:id/activity", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const logs = db.getOrgActivityLogs(req.params.id, user.id);
      return res.json(logs);
    } catch (err) {
      return res.status(403).json({ error: err instanceof Error ? err.message : "Forbidden" });
    }
  });

  // ─── Organizations ────────────────────────────────────────────────────────────

  app.get("/api/organizations", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    return res.json(db.getOrganizationsForUser(user.id));
  });

  app.get("/api/organizations/:id", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const org = db.getOrganizationById(req.params.id, user.id, activityCtx(req, user.id, req.params.id));
      if (!org) return res.status(404).json({ error: "Organization not found" });
      return res.json(org);
    } catch (err) {
      return res.status(403).json({ error: err instanceof Error ? err.message : "Forbidden" });
    }
  });

  app.patch("/api/organizations/:id", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const parsed = updateOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
    }
    try {
      const org = db.updateOrganization(req.params.id, user.id, parsed.data, activityCtx(req, user.id, req.params.id));
      return res.json(org);
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Update failed" });
    }
  });

  app.get("/api/organizations/:id/members", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      return res.json(db.getOrganizationMembers(req.params.id, user.id));
    } catch (err) {
      return res.status(403).json({ error: err instanceof Error ? err.message : "Forbidden" });
    }
  });

  app.patch("/api/organizations/:orgId/members/:memberId", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const parsed = updateMemberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    try {
      const member = db.updateMember(req.params.orgId, req.params.memberId, user.id, parsed.data, activityCtx(req, user.id, req.params.orgId));
      return res.json(member);
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Update failed" });
    }
  });

  app.delete("/api/organizations/:orgId/members/:memberId", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      db.removeMember(req.params.orgId, req.params.memberId, user.id, activityCtx(req, user.id, req.params.orgId));
      return res.json({ ok: true });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Remove failed" });
    }
  });

  app.post("/api/organizations/:id/logo", upload.single("file"), (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = publicUploadUrl(req.file.filename);
    try {
      db.saveUploadedFile(
        {
          uploadedBy: user.id,
          organizationId: req.params.id,
          entityType: "organization",
          entityId: req.params.id,
          originalFilename: req.file.originalname,
          storedFilename: req.file.filename,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          storagePath: req.file.path,
          publicUrl: url,
        },
        activityCtx(req, user.id, req.params.id)
      );
      const org = db.setOrganizationImage(req.params.id, user.id, "logoUrl", url, activityCtx(req, user.id, req.params.id));
      return res.json({ organization: org, url });
    } catch (err) {
      return res.status(403).json({ error: err instanceof Error ? err.message : "Upload failed" });
    }
  });

  app.post("/api/organizations/:id/banner", upload.single("file"), (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = publicUploadUrl(req.file.filename);
    try {
      db.saveUploadedFile(
        {
          uploadedBy: user.id,
          organizationId: req.params.id,
          entityType: "organization_banner",
          entityId: req.params.id,
          originalFilename: req.file.originalname,
          storedFilename: req.file.filename,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          storagePath: req.file.path,
          publicUrl: url,
        },
        activityCtx(req, user.id, req.params.id)
      );
      const org = db.setOrganizationImage(req.params.id, user.id, "bannerUrl", url, activityCtx(req, user.id, req.params.id));
      return res.json({ organization: org, url });
    } catch (err) {
      return res.status(403).json({ error: err instanceof Error ? err.message : "Upload failed" });
    }
  });

  app.delete("/api/organizations/:id/logo", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const org = db.clearOrganizationImage(req.params.id, user.id, "logoUrl", activityCtx(req, user.id, req.params.id));
      return res.json({ organization: org });
    } catch (err) {
      return res.status(403).json({ error: err instanceof Error ? err.message : "Could not remove logo" });
    }
  });

  app.delete("/api/organizations/:id/banner", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const org = db.clearOrganizationImage(req.params.id, user.id, "bannerUrl", activityCtx(req, user.id, req.params.id));
      return res.json({ organization: org });
    } catch (err) {
      return res.status(403).json({ error: err instanceof Error ? err.message : "Could not remove banner" });
    }
  });

  // ─── Edge function simulations ──────────────────────────────────────────────

  app.post("/api/functions/create-organization", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const parsed = createOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
    }
    try {
      const org = db.createOrganization(user.id, parsed.data, activityCtx(req, user.id));
      return res.status(201).json(org);
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create organization" });
    }
  });

  app.post("/api/functions/invite-member", (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const parsed = inviteMemberRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { orgId, ...memberData } = parsed.data;
    try {
      const member = db.inviteMember(
        user.id,
        orgId,
        memberData.email,
        memberData.role,
        {
          title: memberData.title,
          department: memberData.department,
          phone: memberData.phone,
          inviteMessage: memberData.inviteMessage,
          accessProfileId: memberData.accessProfileId || undefined,
        },
        activityCtx(req, user.id, orgId)
      );
      return res.status(201).json(member);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invite failed";
      const status = msg.includes("already been invited")
        ? 409
        : msg.includes("permission")
          ? 403
          : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Unmatched /api routes must return JSON — never fall through to the SPA (HTML breaks fetch().json()).
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  }

  if (supabaseOnly) {
    app.use("/api", (_req, res) => {
      res.status(503).json({
        error: "Legacy API is disabled. Sign in with your Supabase account.",
      });
    });
  }

  // ─── Static / Vite ──────────────────────────────────────────────────────────

  const isBundledServer =
    process.env.NODE_ENV === "production" ||
    fileURLToPath(import.meta.url).endsWith(`${path.sep}server.cjs`);

  if (!isBundledServer) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Fullstack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("FATAL: Failed to launch application server:", err);
});
