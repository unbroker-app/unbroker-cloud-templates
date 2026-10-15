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

// cookie_key is random per installation and lives on the volume.
function installedAt({ exec }) {
  return exec("prestashop", ["sh", "-c", "grep -o \"'cookie_key' => '[^']*'\" /var/www/html/app/config/parameters.php"]).trim();
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
  exec("prestashop", ["sh", "-c", "echo e2e-marker > /var/www/html/img/e2e-marker.jpg"]);
  const at = installedAt(ctx);
  assert(at.length > 20, `cookie_key found (got ${at})`);
  log("installation identified by its cookie_key");
  return { at };
}

export async function verify(ctx, { at }) {
  const { http, assert } = ctx;
  const home = await http("prestashop", "/");
  assert(home.status === 200 && home.text.includes("E2E Store"), `store front answers (got ${home.status})`);
  assert(installedAt(ctx) === at, "same installation (no reinstall)");
  const marker = await http("prestashop", "/img/e2e-marker.jpg");
  assert(marker.text.trim() === "e2e-marker", `file on the volume still served (got ${marker.status})`);
  await adminLogin(ctx);
}
