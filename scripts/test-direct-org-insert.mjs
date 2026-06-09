import "dotenv/config";

const url = process.env.VITE_SUPABASE_URL_DEV;
const anon = process.env.VITE_SUPABASE_ANON_KEY_DEV;

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@example.com", password: "Password123!" }),
});
const session = await login.json();
if (!session.access_token) {
  console.error("Login failed:", session);
  process.exit(1);
}

const headers = {
  apikey: anon,
  Authorization: `Bearer ${session.access_token}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const row = {
  name: "Direct Insert Test Org",
  type: "school",
  created_by: session.user.id,
  school_district: "Test District",
  country: "GB",
  timezone: "Europe/London",
  locale: "en-GB",
  currency: "GBP",
  tags: [],
  status: "active",
};

const res = await fetch(`${url}/rest/v1/organizations`, {
  method: "POST",
  headers,
  body: JSON.stringify(row),
});

console.log("Status:", res.status);
const body = await res.text();
console.log("Body:", body.slice(0, 500));

if (res.ok) {
  const org = JSON.parse(body)[0];
  await fetch(`${url}/rest/v1/organizations?id=eq.${org.id}`, { method: "DELETE", headers });
  console.log("Cleaned up test org");
}
