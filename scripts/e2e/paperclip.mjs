// While there is no admin, the boot script prints a one-time invite URL to the
// logs. A new account signs up, claims the instance through that invite and
// creates a company; after a restart the instance stays claimed and the
// company is still there.
const EMAIL = "e2e@example.com";
const PASSWORD = "e2e-paperclip-pass-9x";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client({ http, url }, cookie = "") {
  const headers = () => ({ "Content-Type": "application/json", Origin: url("paperclip"), ...(cookie && { Cookie: cookie }) });
  const call = async (method, path, body) => {
    const res = await http("paperclip", path, { method, headers: headers(), ...(body && { body: JSON.stringify(body) }) });
    const set = res.headers.getSetCookie().map((c) => c.split(";")[0]);
    if (set.length) cookie = [...cookie.split("; ").filter(Boolean), ...set].join("; ");
    return res;
  };
  return { get: (p) => call("GET", p), post: (p, b) => call("POST", p, b ?? {}) };
}

export async function setup(ctx) {
  const { assert, logs, log } = ctx;
  let invite;
  for (let i = 0; i < 60 && !invite; i++) {
    invite = logs("paperclip").match(/\/invite\/(pcp_bootstrap_[0-9a-f]+)/g)?.pop()?.slice("/invite/".length);
    if (!invite) await sleep(2000);
  }
  assert(invite, "the boot script printed a bootstrap invite URL");
  log("bootstrap invite found in the logs");

  const api = client(ctx);
  const health = await api.get("/api/health");
  assert(health.json?.bootstrapStatus === "bootstrap_pending" && health.json?.bootstrapInviteActive, `instance waits for its admin (got ${health.text.slice(0, 300)})`);

  const up = await api.post("/api/auth/sign-up/email", { email: EMAIL, password: PASSWORD, name: "E2E Admin" });
  assert(up.status === 200, `account created (got ${up.status}: ${up.text.slice(0, 300)})`);
  const accept = await api.post(`/api/invites/${invite}/accept`, { requestType: "human" });
  assert(accept.status < 300 && accept.json?.bootstrapAccepted, `invite accepted (got ${accept.status}: ${accept.text.slice(0, 300)})`);

  const ready = await api.get("/api/health");
  assert(ready.json?.bootstrapStatus === "ready", `instance claimed (got ${ready.text.slice(0, 300)})`);
  const again = await client(ctx).post(`/api/invites/${invite}/accept`, { requestType: "human" });
  assert(again.status >= 400, `the invite works once (got ${again.status})`);

  const company = await api.post("/api/companies", { name: "E2E Corp" });
  assert(company.status < 300 && company.json?.id, `company created (got ${company.status}: ${company.text.slice(0, 300)})`);
  return { companyId: company.json.id };
}

export async function verify(ctx, { companyId }) {
  const { assert } = ctx;
  const api = client(ctx);
  const health = await api.get("/api/health");
  assert(health.json?.bootstrapStatus === "ready", `instance still claimed (got ${health.text.slice(0, 300)})`);
  const signin = await api.post("/api/auth/sign-in/email", { email: EMAIL, password: PASSWORD });
  assert(signin.status === 200, `admin signs in (got ${signin.status}: ${signin.text.slice(0, 300)})`);
  const list = await api.get("/api/companies");
  const companies = Array.isArray(list.json) ? list.json : (list.json?.companies ?? list.json?.data ?? []);
  assert(companies.some((c) => c.id === companyId), `company still there (got ${list.status}: ${list.text.slice(0, 300)})`);
}
