// Sign in with the admin from the deploy form, create a category through the
// API, and check it is still there after a restart.
export const vars = { ADMIN_PASSWORD: "e2e-miniflux-pass" };

const auth = { Authorization: `Basic ${Buffer.from("admin:e2e-miniflux-pass").toString("base64")}` };

export async function setup({ http, assert }) {
  const me = await http("miniflux", "/v1/me", { headers: auth });
  assert(me.status === 200 && me.json?.is_admin, `admin can sign in (got ${me.status})`);
  const res = await http("miniflux", "/v1/categories", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "e2e" }),
  });
  assert(res.status === 201, `category created (got ${res.status}: ${res.text})`);
}

export async function verify({ http, assert }) {
  const res = await http("miniflux", "/v1/categories", { headers: auth });
  assert(res.json?.some((c) => c.title === "e2e"), `category "e2e" exists (got ${res.text})`);
}
