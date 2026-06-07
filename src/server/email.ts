import fs from "fs";
import path from "path";
import crypto from "crypto";

const EMAILS_DIR = path.join(process.cwd(), "data", "emails");
const RESET_TOKENS = new Map<string, { userId: string; email: string; exp: number }>();

function ensureEmailsDir() {
  if (!fs.existsSync(EMAILS_DIR)) fs.mkdirSync(EMAILS_DIR, { recursive: true });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapEmail(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;border-radius:16px;">
        <tr><td style="padding:28px 32px;font-size:15px;line-height:1.6;color:#404040;">${bodyHtml}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function writeDevEmail(kind: string, to: string, subject: string, html: string) {
  ensureEmailsDir();
  const filename = `${Date.now()}-${kind}-${to.replace(/[@.]/g, "_")}.html`;
  const filePath = path.join(EMAILS_DIR, filename);
  const envelope = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${escapeHtml(subject)}</title></head><body style="font-family:monospace;padding:16px;background:#111;color:#eee;"><p><strong>To:</strong> ${escapeHtml(to)}</p><p><strong>Subject:</strong> ${escapeHtml(subject)}</p><hr />${html}</body></html>`;
  fs.writeFileSync(filePath, envelope, "utf-8");
  console.log(`[email] ${subject} → ${to} (saved ${filePath})`);
}

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function sendOrgInviteEmailLocal(input: {
  email: string;
  orgId: string;
  orgName: string;
  role: string;
  inviteMessage?: string | null;
  inviterName?: string | null;
}) {
  const link = `${appUrl()}/sign-up?org=${encodeURIComponent(input.orgId)}&email=${encodeURIComponent(input.email)}`;
  const note = input.inviteMessage
    ? `<p style="margin:16px 0;padding:12px 16px;background:#f5f5f5;border-left:3px solid #0a0a0a;border-radius:8px;font-style:italic;">"${escapeHtml(input.inviteMessage)}"</p>`
    : "";
  const html = wrapEmail(
    "Organization invitation",
    `<p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#737373;">Admin Dashboard</p>
     <h1 style="margin:0 0 16px;font-size:22px;color:#0a0a0a;">You're invited to join ${escapeHtml(input.orgName)}</h1>
     <p style="margin:0 0 16px;">${escapeHtml(input.inviterName ?? "An administrator")} invited you as <strong>${escapeHtml(input.role)}</strong>.</p>
     ${note}
     <p style="margin:0 0 24px;">Accept the invitation to create your account.</p>
     <a href="${link}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;">Accept invitation</a>
     <p style="margin:24px 0 0;font-size:12px;color:#737373;word-break:break-all;">${escapeHtml(link)}</p>`,
  );
  writeDevEmail("invite", input.email, `You're invited to ${input.orgName}`, html);
}

export function sendPasswordResetEmailLocal(email: string, userId: string) {
  const token = crypto.randomBytes(24).toString("hex");
  RESET_TOKENS.set(token, { userId, email, exp: Date.now() + 60 * 60 * 1000 });
  const link = `${appUrl()}/reset-password?token=${token}`;
  const html = wrapEmail(
    "Reset your password",
    `<p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#737373;">Admin Dashboard</p>
     <h1 style="margin:0 0 16px;font-size:22px;color:#0a0a0a;">Reset your password</h1>
     <p style="margin:0 0 24px;">We received a request to reset the password for <strong>${escapeHtml(email)}</strong>.</p>
     <a href="${link}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;">Reset password</a>
     <p style="margin:24px 0 0;font-size:12px;color:#737373;word-break:break-all;">${escapeHtml(link)}</p>`,
  );
  writeDevEmail("recovery", email, "Reset your Admin Dashboard password", html);
  return { ok: true as const };
}

export function consumePasswordResetToken(token: string) {
  const entry = RESET_TOKENS.get(token);
  if (!entry || entry.exp < Date.now()) return null;
  RESET_TOKENS.delete(token);
  return entry;
}

export function sendWelcomeEmailLocal(email: string, fullName: string) {
  const html = wrapEmail(
    "Welcome",
    `<p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#737373;">Admin Dashboard</p>
     <h1 style="margin:0 0 16px;font-size:22px;color:#0a0a0a;">Welcome, ${escapeHtml(fullName)}</h1>
     <p style="margin:0 0 24px;">Your admin account for <strong>${escapeHtml(email)}</strong> is ready.</p>
     <a href="${appUrl()}/sign-in" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;">Sign in</a>`,
  );
  writeDevEmail("confirmation", email, "Welcome to Admin Dashboard", html);
}
