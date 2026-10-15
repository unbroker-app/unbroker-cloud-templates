// MailCheap only signs in with a code it emails through Resend or Amazon SES,
// which a test can't receive. So: the health check passes with the generated
// secrets, the sign-in page renders, and the RS256 key Better Auth creates in
// MongoDB on first use (encrypted with BETTER_AUTH_SECRET) is served again,
// unchanged, after a restart.
export const vars = {
  ADMIN_EMAIL: "admin@example.com",
  EMAIL_FROM: "MailCheap <login@example.com>",
};

export async function setup({ http, assert }) {
  const health = await http("mailcheap", "/api/health");
  assert(health.status === 200 && health.json?.ok, `healthy (got ${health.status}: ${health.text})`);
  const signin = await http("mailcheap", "/signin");
  assert(signin.status === 200 && signin.text.includes("MailCheap"), `sign-in page renders (got ${signin.status})`);
  const jwks = await http("mailcheap", "/api/auth/jwks");
  const kid = jwks.json?.keys?.[0]?.kid;
  assert(jwks.status === 200 && kid, `signing key created (got ${jwks.status}: ${jwks.text})`);
  return { kid };
}

export async function verify({ http, assert }, { kid }) {
  const jwks = await http("mailcheap", "/api/auth/jwks");
  const kids = jwks.json?.keys?.map((k) => k.kid) ?? [];
  assert(kids.includes(kid), `signing key ${kid} still served (got ${jwks.status}: ${jwks.text})`);
}
