// The workspace is created at boot for ADMIN_EMAIL (installation.create is
// closed), the admin signs in through the emailed link (caught by Mailpit),
// writes a document and uploads an attachment, and both are still there after
// a restart (the attachment lives on the volume).
const EMAIL = "admin@example.com";
export const sidecars = [{ name: "mail", image: "axllent/mailpit:v1.31.5", port: 8025 }];
export const vars = {
  ADMIN_EMAIL: EMAIL,
  SMTP_HOST: "ubt-outline-mail",
  SMTP_PORT: "1025",
  SMTP_SECURE: "false",
  SMTP_FROM_EMAIL: "Outline <outline@example.com>",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FILE = `e2e attachment ${Date.now()}`;

async function signIn({ http, sidecar, assert, log }) {
  const mail = sidecar("mail");
  await fetch(`${mail}/api/v1/messages`, { method: "DELETE" });
  const ask = await http("outline", "/auth/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL }),
  });
  assert(ask.status === 200, `sign-in email requested (got ${ask.status}: ${ask.text})`);

  let link;
  for (let i = 0; i < 30 && !link; i++) {
    await sleep(1000);
    const list = await fetch(`${mail}/api/v1/messages`).then((r) => r.json());
    const id = list.messages?.find((m) => m.To?.some((t) => t.Address === EMAIL))?.ID;
    if (!id) continue;
    const msg = await fetch(`${mail}/api/v1/message/${id}`).then((r) => r.json());
    link = (msg.Text + msg.HTML).match(/\/auth\/email\.callback\?token=[^"'\s<&]+/)?.[0];
  }
  assert(link, "the sign-in email arrived with a link");
  log("sign-in email received");

  const cb = await http("outline", `${link}&follow=true`);
  const cookie = cb.headers.getSetCookie().find((c) => c.startsWith("accessToken="));
  assert(cookie, `the link signs in (got ${cb.status}, cookies: ${cb.headers.getSetCookie().join("; ")})`);
  const auth = { Authorization: `Bearer ${cookie.split(";")[0].slice("accessToken=".length)}` };
  const api = (path, body) =>
    http("outline", `/api/${path}`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  return { api, auth };
}

export async function setup(ctx) {
  const { http, assert, url } = ctx;
  // The boot script has created the workspace once installation.create refuses.
  let again;
  for (let i = 0; i < 30; i++) {
    again = await http("outline", "/api/installation.create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamName: "Intruder", userName: "Intruder", userEmail: "intruder@example.com" }),
    });
    if (again.text.includes("existing teams")) break;
    await sleep(2000);
  }
  assert(again.text.includes("existing teams"), `installation.create is closed (got ${again.status}: ${again.text})`);

  const { api } = await signIn(ctx);
  const info = await api("auth.info");
  assert(info.json?.data?.user?.email === EMAIL && info.json.data.user.role === "admin", `signed in as the admin (got ${info.text.slice(0, 300)})`);

  const cols = await api("collections.list");
  let collectionId = cols.json?.data?.[0]?.id;
  if (!collectionId) collectionId = (await api("collections.create", { name: "e2e" })).json?.data?.id;
  assert(collectionId, "there is a collection to write in");
  const doc = await api("documents.create", { title: "e2e", text: "Hello from e2e", collectionId, publish: true });
  assert(doc.status === 200 && doc.json?.data?.id, `document created (got ${doc.status}: ${doc.text.slice(0, 300)})`);

  const up = await api("attachments.create", { name: "e2e.txt", contentType: "text/plain", size: FILE.length, preset: "documentAttachment" });
  assert(up.status === 200 && up.json?.data?.uploadUrl, `attachment created (got ${up.status}: ${up.text.slice(0, 300)})`);
  const form = new FormData();
  for (const [k, v] of Object.entries(up.json.data.form)) form.append(k, v);
  form.append("file", new Blob([FILE], { type: "text/plain" }), "e2e.txt");
  const target = up.json.data.uploadUrl.startsWith("http") ? up.json.data.uploadUrl : url("outline") + up.json.data.uploadUrl;
  // The form carries a signature for this key, so the upload needs no session.
  const sent = await fetch(target, { method: "POST", body: form });
  assert(sent.status === 200, `attachment uploaded to local storage (got ${sent.status}: ${await sent.text()})`);
  return { docId: doc.json.data.id, key: up.json.data.form.key };
}

export async function verify(ctx, { docId, key }) {
  const { http, assert } = ctx;
  const { api, auth } = await signIn(ctx);
  const doc = await api("documents.info", { id: docId });
  assert(doc.json?.data?.text?.includes("Hello from e2e"), `document still there (got ${doc.status}: ${doc.text.slice(0, 300)})`);
  const file = await http("outline", `/api/files.get?key=${encodeURIComponent(key)}`, { headers: auth });
  assert(file.text === FILE, `attachment still on the volume (got ${file.status}: ${file.text.slice(0, 200)})`);
}
