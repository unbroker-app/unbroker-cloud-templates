// The admin from the deploy form exists at boot and the super-admin
// onboarding page is closed. The admin signs in through the API, creates an
// API inbox, a contact and a conversation, and posts a message with an
// attachment; Sidekiq is running. After a restart the conversation, the
// message and the attachment (on the volume) are still there.
const EMAIL = "admin@example.com";
const PASSWORD = "E2e-Chatwoot-pass1!";
export const vars = { ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD: PASSWORD, COMPANY_NAME: "E2E Corp" };

const FILE = `e2e attachment ${Date.now()}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn({ http, assert }) {
  let res;
  for (let i = 0; i < 30; i++) {
    res = await http("chatwoot", "/auth/sign_in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    if (res.status === 200) break;
    await sleep(2000);
  }
  assert(res.status === 200, `admin signs in (got ${res.status}: ${res.text.slice(0, 300)})`);
  const auth = Object.fromEntries(["access-token", "client", "uid"].map((h) => [h, res.headers.get(h)]));
  const accountId = res.json.data.account_id ?? res.json.data.accounts?.[0]?.id;
  const call = (method, path, body) =>
    http("chatwoot", `/api/v1/accounts/${accountId}${path}`, {
      method,
      headers: { ...auth, ...(body && !(body instanceof FormData) && { "Content-Type": "application/json" }) },
      ...(body && { body: body instanceof FormData ? body : JSON.stringify(body) }),
    });
  return { call, data: res.json.data };
}

function sidekiqRunning({ exec }) {
  return exec("chatwoot", ["sh", "-c", "grep -l sidekiq /proc/[0-9]*/cmdline 2>/dev/null | wc -l"]).trim() !== "0";
}

export async function setup(ctx) {
  const { http, assert, log } = ctx;
  const onboarding = await http("chatwoot", "/installation/onboarding");
  assert(onboarding.status === 302, `super-admin onboarding is closed (got ${onboarding.status})`);
  const signup = await http("chatwoot", "/api/v1/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account_name: "Intruder", email: "intruder@example.com", password: PASSWORD, user_full_name: "X" }),
  });
  assert(signup.status >= 400, `public sign-up is disabled (got ${signup.status})`);

  const { call, data } = await signIn(ctx);
  assert(data.type === "SuperAdmin" || data.role === "administrator", `signed in as the admin (got ${JSON.stringify(data).slice(0, 200)})`);
  assert(sidekiqRunning(ctx), "Sidekiq runs next to the web server");
  // Rails.cache must not be the default file store under the read-only /app/tmp.
  const cache = ctx.exec("chatwoot", ["bundle", "exec", "ruby", "-r/tmp/unbroker_cache.rb", "bin/rails", "runner",
    'Rails.cache.write("e2e", 42); puts Rails.cache.class.name; puts Rails.cache.read("e2e")']);
  assert(/MemoryStore\s+42/.test(cache), `Rails.cache works (got ${cache.slice(-300)})`);

  const inbox = await call("POST", "/inboxes", { name: "E2E API", channel: { type: "api" } });
  assert(inbox.status === 200 && inbox.json?.id, `inbox created (got ${inbox.status}: ${inbox.text.slice(0, 300)})`);
  const contact = await call("POST", "/contacts", { name: "E2E Customer", email: "customer@example.com", inbox_id: inbox.json.id });
  const contactId = contact.json?.payload?.contact?.id ?? contact.json?.id;
  const sourceId = contact.json?.payload?.contact_inbox?.source_id ?? contact.json?.payload?.contact?.contact_inboxes?.[0]?.source_id;
  assert(contactId, `contact created (got ${contact.status}: ${contact.text.slice(0, 300)})`);
  const conv = await call("POST", "/conversations", { inbox_id: inbox.json.id, contact_id: contactId, ...(sourceId && { source_id: sourceId }) });
  assert(conv.status === 200 && conv.json?.id, `conversation created (got ${conv.status}: ${conv.text.slice(0, 300)})`);

  const form = new FormData();
  form.append("content", "Hello from e2e");
  form.append("message_type", "outgoing");
  form.append("attachments[]", new Blob([FILE], { type: "text/plain" }), "e2e.txt");
  const msg = await call("POST", `/conversations/${conv.json.id}/messages`, form);
  assert(msg.status === 200 && msg.json?.attachments?.length === 1, `message with attachment posted (got ${msg.status}: ${msg.text.slice(0, 300)})`);
  log(`conversation ${conv.json.id}`);
  return { conversationId: conv.json.id };
}

export async function verify(ctx, { conversationId }) {
  const { assert, url } = ctx;
  const { call } = await signIn(ctx);
  assert(sidekiqRunning(ctx), "Sidekiq runs next to the web server");
  const msgs = await call("GET", `/conversations/${conversationId}/messages`);
  const message = msgs.json?.payload?.find((m) => m.content === "Hello from e2e");
  assert(message, `message still there (got ${msgs.status}: ${msgs.text.slice(0, 300)})`);
  const dataUrl = message.attachments?.[0]?.data_url;
  assert(dataUrl, "attachment still listed");
  const file = await fetch(new URL(new URL(dataUrl).pathname + new URL(dataUrl).search, url("chatwoot")));
  assert((await file.text()) === FILE, `attachment bytes served from the volume (got ${file.status})`);
}
