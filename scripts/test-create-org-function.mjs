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

const payload = {
  name: "Test Edge Org",
  type: "school",
  schoolDistrict: "Test District 1",
  country: "GB",
  timezone: "Europe/London",
  currency: "GBP",
};

const res = await fetch(`${url}/functions/v1/create-organization`, {
  method: "POST",
  headers: {
    apikey: anon,
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

console.log("Status:", res.status);
console.log("Body:", await res.text());
