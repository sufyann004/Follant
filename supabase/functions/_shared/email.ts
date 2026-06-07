export interface OrgInviteEmailPayload {
  email: string;
  orgId: string;
  orgName: string;
  role: string;
  inviteMessage?: string | null;
  inviterName?: string | null;
  inviterEmail?: string | null;
}

function appBaseUrl(): string {
  return (
    Deno.env.get("APP_URL") ??
    Deno.env.get("SITE_URL") ??
    Deno.env.get("SUPABASE_AUTH_SITE_URL") ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Send org invitation via Supabase Auth (invite template for new users, magic link for existing). */
export async function sendOrgInviteEmail(payload: OrgInviteEmailPayload): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.warn("[email] Missing Supabase env — skipping invite email to", payload.email);
    return;
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const appUrl = appBaseUrl();
  const redirectTo = `${appUrl}/sign-up?org=${payload.orgId}`;
  const metadata = {
    org_name: payload.orgName,
    org_id: payload.orgId,
    role: payload.role,
    invite_message: payload.inviteMessage ?? "",
    inviter_name: payload.inviterName ?? payload.inviterEmail ?? "An administrator",
  };

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(payload.email, {
    redirectTo,
    data: metadata,
  });

  if (!inviteError) {
    console.log("[email] Invite email sent to", payload.email, "for org", payload.orgName);
    return;
  }

  const message = inviteError.message.toLowerCase();
  const alreadyRegistered =
    message.includes("already") ||
    message.includes("registered") ||
    message.includes("exists");

  if (!alreadyRegistered) {
    console.error("[email] inviteUserByEmail failed:", inviteError.message);
    throw new Error("Failed to send invitation email");
  }

  const otpResponse = await fetch(`${supabaseUrl}/auth/v1/otp`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: payload.email,
      create_user: false,
      data: { ...metadata, org_invite: true },
      options: { emailRedirectTo: `${appUrl}/orgs/${payload.orgId}` },
    }),
  });

  if (!otpResponse.ok) {
    const body = await otpResponse.text();
    console.error("[email] magic link fallback failed:", body);
    throw new Error("Failed to send invitation email to existing user");
  }

  console.log("[email] Magic-link invite sent to existing user", payload.email);
}
