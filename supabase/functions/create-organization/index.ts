import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getBearerToken, handleCors, jsonResponse } from "../_shared/cors.ts";
import { createOrgSchema, mapCreateOrgRow, mapOrganizationResponse } from "../_shared/schemas.ts";

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
    const parsed = createOrgSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.issues[0]?.message ?? "Validation failed" }, 400);
    }

    const row = mapCreateOrgRow(user.id, parsed.data);

    const { data: org, error: insertError } = await userClient
      .from("organizations")
      .insert(row)
      .select("*")
      .single();

    if (insertError) {
      console.error("create-organization insert:", insertError);
      const msg = insertError.message.includes("check constraint")
        ? "Organization data failed database validation"
        : insertError.message;
      return jsonResponse({ error: msg }, 400);
    }

    await userClient.rpc("log_activity", {
      p_action: "org.create",
      p_description: `Created organization ${org.name}`,
      p_organization_id: org.id,
      p_entity_type: "organization",
      p_entity_id: org.id,
      p_metadata: { type: org.type },
    });

    return jsonResponse(mapOrganizationResponse(org as Record<string, unknown>), 201);
  } catch (err) {
    console.error("create-organization error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
