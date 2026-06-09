function parseAllowedOrigins(): string[] {
  const raw =
    Deno.env.get("ALLOWED_ORIGINS") ??
    Deno.env.get("APP_URL") ??
    Deno.env.get("SITE_URL") ??
    Deno.env.get("SUPABASE_AUTH_SITE_URL");
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function pickOrigin(req: Request | null): string {
  const allowed = parseAllowedOrigins();
  const requestOrigin = req?.headers.get("Origin")?.replace(/\/$/, "") ?? null;

  if (requestOrigin) {
    if (allowed.length === 0 || allowed.includes(requestOrigin)) {
      return requestOrigin;
    }
  }

  if (allowed.length > 0) return allowed[0];
  return "*";
}

export function corsHeaders(req: Request | null = null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": pickOrigin(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
}

export function jsonResponse(body: unknown, status = 200, req: Request | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  return null;
}

export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
