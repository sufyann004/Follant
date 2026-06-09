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

const headers = { apikey: anon, Authorization: `Bearer ${session.access_token}` };

const profile = await fetch(`${url}/rest/v1/profiles?id=eq.${session.user.id}&select=is_admin,full_name`, { headers }).then((r) => r.json());
const orgs = await fetch(`${url}/rest/v1/organizations?select=id,name&order=name`, { headers }).then((r) => r.json());

console.log("Profile:", profile[0]);
console.log("Visible orgs:", orgs.length, orgs.map((o) => o.name).join(", "));
