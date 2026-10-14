// First boot downloads and installs PrestaShop onto the volume. The store
// front answers, the back office only lives at ADMIN_FOLDER (no /admin, no
// /install left behind), and the admin signs in with the form's password.
// After a restart the same installation is still there: no reinstall, same
// admin, and a file written to the volume is still served.
const EMAIL = "admin@example.com";
const PASSWORD = "e2e-presta-pass";
const FOLDER = "bo-e2e7x";
export const vars = { ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD: PASSWORD, ADMIN_FOLDER: FOLDER, SHOP_NAME: "E2E Store" };

async function adminLogin({ http, assert }) {
  const page = await http("prestashop", `/${FOLDER}/index.php/login`);
  assert(page.status === 200 && /passwd/.test(page.text), `back-office login page (got ${page.status})`);
  const cookie = page.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const res = await http("prestashop", `/${FOLDER}/index.php/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams({ email: EMAIL, passwd: PASSWORD }),
  });
  const to = res.headers.get("location") ?? "";
  assert(res.status === 302 && to && !/\/login(\?|$)/.test(to), `admin signs in (got ${res.status} → ${to})`);
}

function installedAt({ exec, env }) {
  const pw = env("db").MYSQL_ROOT_PASSWORD;
  return exec("db", ["mysql", "-uroot", `-p${pw}`, "-N", "-e", "SELECT MIN(date_add) FROM prestashop.ps_configuration"]).trim();
}

export async function setup(ctx) {
  const { http, assert, exec, log } = ctx;
  const home = await http("prestashop", "/");
  assert(home.status === 200 && home.text.includes("E2E Store"), `store front answers (got ${home.status})`);
  for (const path of ["/admin/", "/install/"]) {
    const r = await http("prestashop", path);
    assert(r.status === 404, `${path} is gone (got ${r.status})`);
  }
  await adminLogin(ctx);
  exec("prestashop", ["sh", "-c", "echo e2e-marker > /var/www/html/img/e2e-marker.txt"]);
  const at = installedAt(ctx);
  log(`installed at ${at}`);
  return { at };
}

export async function verify(ctx, { at }) {
  const { http, assert } = ctx;
  const home = await http("prestashop", "/");
  assert(home.status === 200 && home.text.includes("E2E Store"), `store front answers (got ${home.status})`);
  assert(installedAt(ctx) === at, "same installation (no reinstall)");
  const marker = await http("prestashop", "/img/e2e-marker.txt");
  assert(marker.text.trim() === "e2e-marker", `file on the volume still served (got ${marker.status})`);
  await adminLogin(ctx);
}
