import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getBearerToken, jsonResponse } from "../_shared/cors.ts";
import { inviteMemberSchema, mapMemberResponse } from "../_shared/schemas.ts";
import { sendOrgInviteEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: "Server misconfiguration" }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.issues[0]?.message ?? "Validation failed" }, 400);
    }

    const { orgId, email, role, accessProfileId, title, department, phone, inviteMessage } =
      parsed.data;

    const { data: perms, error: permError } = await userClient.rpc("get_effective_permissions", {
      p_organization_id: orgId,
    });
    if (permError) {
      console.error("get_effective_permissions:", permError);
      return jsonResponse({ error: "Permission check failed" }, 500);
    }

    const canInvite = (perms as { members?: { invite?: boolean } })?.members?.invite === true;
    if (!canInvite) {
      return jsonResponse({ error: "Forbidden: you do not have permission to invite members" }, 403);
    }

    const { data: org, error: orgError } = await userClient
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle();

    if (orgError || !org) {
      return jsonResponse({ error: "Organization not found" }, 404);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { data: existing } = await userClient
      .from("organization_members")
      .select("id, status")
      .eq("organization_id", orgId)
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existing && existing.status !== "removed") {
      return jsonResponse(
        { error: "This email has already been invited to this organization" },
        409,
      );
    }

    const insertPayload: Record<string, unknown> = {
      organization_id: orgId,
      email: normalizedEmail,
      status: "invited",
      role,
      invited_by: user.id,
      title: title?.trim() || null,
      department: department?.trim() || null,
      phone: phone?.trim() || null,
      invite_message: inviteMessage?.trim() || null,
    };

    if (accessProfileId && accessProfileId !== "") {
      insertPayload.access_profile_id = accessProfileId;
    }

    const { data: member, error: insertError } = await userClient
      .from("organization_members")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return jsonResponse(
          { error: "This email has already been invited to this organization" },
          409,
        );
      }
      console.error("invite-member insert:", insertError);
      return jsonResponse({ error: insertError.message }, 400);
    }

    await userClient.rpc("log_activity", {
      p_action: "member.invite",
      p_description: `Invited ${normalizedEmail} to ${org.name}`,
      p_organization_id: orgId,
      p_entity_type: "member",
      p_entity_id: member.id,
      p_metadata: { email: normalizedEmail, role },
    });

    try {
      await sendOrgInviteEmail({
        email: normalizedEmail,
        orgId,
        orgName: org.name,
        role,
        inviteMessage,
        inviterName: (user.user_metadata?.full_name as string | undefined) ?? null,
        inviterEmail: user.email ?? null,
      });
    } catch (emailErr) {
      console.error("[invite-member] email failed:", emailErr);
    }

    return jsonResponse(mapMemberResponse(member as Record<string, unknown>), 201);
  } catch (err) {
    console.error("invite-member error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
