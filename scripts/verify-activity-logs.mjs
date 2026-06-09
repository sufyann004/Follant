import "dotenv/config";

const url = process.env.VITE_SUPABASE_URL_DEV;
const anon = process.env.VITE_SUPABASE_ANON_KEY_DEV;

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@example.com", password: "Password123!" }),
});
const session = await login.json();
const headers = { apikey: anon, Authorization: `Bearer ${session.access_token}`, Prefer: "count=exact" };

const res = await fetch(`${url}/rest/v1/activity_logs?select=id,action,description,action_label,created_at&order=created_at.desc&limit=3`, { headers });
const logs = await res.json();
console.log("count header:", res.headers.get("content-range"));
console.log("sample:", logs);
