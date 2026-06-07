import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./src/server/db.ts";
import { upload, publicUploadUrl } from "./src/server/upload.ts";
import { getRequestMeta } from "./src/server/activityLog.ts";
import {
  createOrgSchema,
  updateOrgSchema,
  inviteMemberSchema,
  updateMemberSchema,
  updateProfileSchema,
  updatePreferencesSchema,
  changePasswordSchema,
  ACTIVITY_ACTIONS,
} from "./src/types.ts";
import { sendPasswordResetEmailLocal, consumePasswordResetToken } from "./src/server/email.ts";

interface TokenPayload {
  id: string;
  email: string;
  fullName: string;
  sessionId: string;
  exp: number;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "2mb" }));
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  function generateToken(user: { id: string; email: string; fullName: string }, sessionId: string) {
    const payload: TokenPayload = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      sessionId,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    };
    return Buffer.from(JSON.stringify(payload)).toString("base64");
  }

  function getAuthenticatedUser(req: express.Request): TokenPayload | null {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return null;
    try {
      const payload = JSON.parse(Buffer.from(authHeader.split(" ")[1], "base64").toString("utf-8")) as TokenPayload;
      if (payload.exp < Date.now()) return null;
      db.touchSession(payload.sessionId);
      return payload;
    } catch {
      return null;
    }
  }

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

  // ─── Auth ───────────────────────────────────────────────────────────────────

  app.post("/api/auth/sign-in", (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
      const user = db.findUserByEmail(email);
      if (!user || !db.hashCompare(password, user.passwordHash)) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const meta = getRequestMeta(req);
      const session = db.createSession(user.id, meta);
      db.recordSignIn(user.id, activityCtx(req, user.id), session.id);
      const { passwordHash, ...profile } = user;
      return res.json({ user: profile, token: generateToken(user, session.id) });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Sign in failed" });
    }
  });

  app.post("/api/auth/sign-up", (req, res) => {
    try {
      const { email, password, fullName, phone, jobTitle, timezone } = req.body;
      if (!email || !password || !fullName) return res.status(400).json({ error: "All fields are required" });
      if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
      const profile = db.createUser(email, password, fullName, { phone, jobTitle, timezone }, activityCtx(req, "system"));
      const meta = getRequestMeta(req);
      const session = db.createSession(profile.id, meta);
      db.recordSignIn(profile.id, activityCtx(req, profile.id), session.id);
      return res.status(201).json({ user: profile, token: generateToken({ ...profile, fullName: profile.fullName }, session.id) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      return res.status(msg.includes("exists") ? 409 : 500).json({ error: msg });
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

  app.post("/api/auth/forgot-password", (req, res) => {
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

  app.post("/api/auth/reset-password", (req, res) => {
    try {
      const { token, password } = req.body ?? {};
      if (!token || !password) return res.status(400).json({ error: "Token and password are required" });
      if (typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
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
    const parsed = updateProfileSchema.safeParse(req.body);
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
    return res.json(db.getOrganizationsByAdmin(user.id));
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
    const { orgId, ...rest } = req.body;
    if (!orgId) return res.status(400).json({ error: "Organization ID is required" });
    const parsed = inviteMemberSchema.safeParse(rest);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    try {
      const member = db.inviteMember(
        user.id,
        orgId,
        parsed.data.email,
        parsed.data.role,
        {
          title: parsed.data.title,
          department: parsed.data.department,
          phone: parsed.data.phone,
          inviteMessage: parsed.data.inviteMessage,
          accessProfileId: parsed.data.accessProfileId || undefined,
        },
        activityCtx(req, user.id, orgId)
      );
      return res.status(201).json(member);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invite failed";
      const status = msg.includes("Conflict") ? 409 : msg.includes("Unauthorized") || msg.includes("RLS") ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // ─── Static / Vite ──────────────────────────────────────────────────────────

  if (process.env.NODE_ENV !== "production") {
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
