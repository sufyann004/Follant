import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getBearerToken, jsonResponse } from "../_shared/cors.ts";
import { inviteMemberSchema, mapMemberResponse } from "../_shared/schemas.ts";
import { sendOrgInviteEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const reply = (body: unknown, status = 200) => jsonResponse(body, status, req);

  if (req.method !== "POST") {
    return reply({ error: "Method not allowed" }, 405);
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return reply({ error: "Missing authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return reply({ error: "Server misconfiguration" }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(token);
    if (authError || !user) {
      return reply({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return reply({ error: parsed.error.issues[0]?.message ?? "Validation failed" }, 400);
    }

    const { orgId, email, role, accessProfileId, title, department, phone, inviteMessage } =
      parsed.data;

    const { data: perms, error: permError } = await userClient.rpc("get_effective_permissions", {
      p_organization_id: orgId,
    });
    if (permError) {
      console.error("get_effective_permissions:", permError);
      return reply({ error: "Permission check failed" }, 500);
    }

    const canInvite = (perms as { members?: { invite?: boolean } })?.members?.invite === true;
    if (!canInvite) {
      return reply({ error: "Forbidden: you do not have permission to invite members" }, 403);
    }

    const { data: org, error: orgError } = await userClient
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle();

    if (orgError || !org) {
      return reply({ error: "Organization not found" }, 404);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { data: existing } = await userClient
      .from("organization_members")
      .select("id, status")
      .eq("organization_id", orgId)
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existing && existing.status !== "removed") {
      return reply(
        { error: "This email has already been invited to this organization" },
        409,
      );
    }

    const memberPayload: Record<string, unknown> = {
      organization_id: orgId,
      email: normalizedEmail,
      status: "invited",
      role,
      user_id: null,
      joined_at: null,
      invited_by: user.id,
      title: title?.trim() || null,
      department: department?.trim() || null,
      phone: phone?.trim() || null,
      invite_message: inviteMessage?.trim() || null,
      invited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (accessProfileId && accessProfileId !== "") {
      memberPayload.access_profile_id = accessProfileId;
    } else {
      const slugByRole: Record<string, string> = {
        admin: "org_admin",
        member: "org_member",
        viewer: "org_viewer",
      };
      const { data: defaultProfile } = await userClient
        .from("access_profiles")
        .select("id")
        .eq("slug", slugByRole[role] ?? "org_member")
        .maybeSingle();
      if (defaultProfile?.id) {
        memberPayload.access_profile_id = defaultProfile.id;
      }
    }

    let member: Record<string, unknown>;

    if (existing?.status === "removed") {
      const { data: updated, error: updateError } = await userClient
        .from("organization_members")
        .update(memberPayload)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (updateError) {
        console.error("invite-member re-invite:", updateError);
        return reply({ error: updateError.message }, 400);
      }
      member = updated as Record<string, unknown>;
    } else {
      const { data: inserted, error: insertError } = await userClient
        .from("organization_members")
        .insert(memberPayload)
        .select("*")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          return reply(
            { error: "This email has already been invited to this organization" },
            409,
          );
        }
        console.error("invite-member insert:", insertError);
        return reply({ error: insertError.message }, 400);
      }
      member = inserted as Record<string, unknown>;
    }

    try {
      await userClient.rpc("log_activity", {
        p_action: "member.invite",
        p_description: `Invited ${normalizedEmail} to ${org.name}`,
        p_organization_id: orgId,
        p_entity_type: "member",
        p_entity_id: member.id,
        p_metadata: { email: normalizedEmail, role },
      });
    } catch (logErr) {
      console.error("[invite-member] activity log failed:", logErr);
    }

    let emailSent = false;
    try {
      const emailResult = await sendOrgInviteEmail({
        email: normalizedEmail,
        orgId,
        orgName: org.name,
        role,
        inviteMessage,
        inviterName: (user.user_metadata?.full_name as string | undefined) ?? null,
        inviterEmail: user.email ?? null,
      });
      emailSent = emailResult.sent;
    } catch (emailErr) {
      console.error("[invite-member] email failed:", emailErr);
    }

    return reply({ ...mapMemberResponse(member), emailSent }, 201);
  } catch (err) {
    console.error("invite-member error:", err);
    return reply({ error: "Internal server error" }, 500);
  }
});
