// The admin signs in with the password from the deploy form (and no longer
// with Umami's default), adds a website, records a pageview through the
// tracker endpoint, and both are still there after a restart.
const PASSWORD = "e2e-umami-pass";
export const vars = { ADMIN_PASSWORD: PASSWORD };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (body, token) => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
  body: JSON.stringify(body),
});

async function login({ http, assert }) {
  // The password is rotated just after the server comes up; give it a moment.
  let res;
  for (let i = 0; i < 30; i++) {
    res = await http("umami", "/api/auth/login", json({ username: "admin", password: PASSWORD }));
    if (res.status === 200) break;
    await sleep(2000);
  }
  assert(res.status === 200 && res.json?.token, `admin signs in with ADMIN_PASSWORD (got ${res.status}: ${res.text})`);
  return res.json.token;
}

export async function setup(ctx) {
  const { http, assert, log } = ctx;
  const token = await login(ctx);
  const old = await http("umami", "/api/auth/login", json({ username: "admin", password: "umami" }));
  assert(old.status === 401, `default password admin/umami is rejected (got ${old.status})`);

  const site = await http("umami", "/api/websites", json({ name: "e2e", domain: "e2e.example.com" }, token));
  assert(site.status === 200 && site.json?.id, `website created (got ${site.status}: ${site.text})`);
  log(`website ${site.json.id}`);

  const send = await http("umami", "/api/send", {
    ...json({ type: "event", payload: { website: site.json.id, hostname: "e2e.example.com", url: "/hello", title: "Hello", language: "en-US", screen: "1920x1080" } }),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    },
  });
  assert(send.status === 200, `pageview accepted (got ${send.status}: ${send.text})`);
  return { websiteId: site.json.id };
}

export async function verify(ctx, { websiteId }) {
  const { http, assert } = ctx;
  const token = await login(ctx);
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const site = await http("umami", `/api/websites/${websiteId}`, auth);
  assert(site.status === 200 && site.json?.name === "e2e", `website still there (got ${site.status}: ${site.text})`);
  const now = Date.now();
  const stats = await http("umami", `/api/websites/${websiteId}/stats?startAt=${now - 3_600_000}&endAt=${now + 60_000}`, auth);
  const pageviews = stats.json?.pageviews?.value ?? stats.json?.pageviews;
  assert(pageviews >= 1, `pageview recorded (got ${stats.status}: ${stats.text})`);
}
