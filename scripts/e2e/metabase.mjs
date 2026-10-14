// Setup is completed at boot with the admin from the deploy form (the setup
// page is closed), the admin signs in, creates a collection and saves a
// question, and both are still there after a restart.
const EMAIL = "e2e@example.com";
const PASSWORD = "e2e-Metabase-pass-7f3k";
export const vars = { ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD: PASSWORD };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function session({ http, assert }) {
  // The admin is created by a script just after the API comes up.
  let res;
  for (let i = 0; i < 60; i++) {
    res = await http("metabase", "/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: EMAIL, password: PASSWORD }),
    });
    if (res.status === 200) break;
    await sleep(2000);
  }
  assert(res.status === 200 && res.json?.id, `admin signs in (got ${res.status}: ${res.text})`);
  return {
    get: (path) => http("metabase", path, { headers: { "X-Metabase-Session": res.json.id } }),
    post: (path, body) =>
      http("metabase", path, {
        method: "POST",
        headers: { "X-Metabase-Session": res.json.id, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  };
}

export async function setup(ctx) {
  const { http, assert, log } = ctx;
  const api = await session(ctx);
  const props = await http("metabase", "/api/session/properties");
  assert(props.json?.["has-user-setup"] === true && !props.json?.["setup-token"], "setup is complete and its token gone");

  const col = await api.post("/api/collection", { name: "e2e" });
  assert(col.status === 200 && col.json?.id, `collection created (got ${col.status}: ${col.text})`);

  const dbs = await api.get("/api/database");
  const sample = (dbs.json?.data ?? dbs.json ?? []).find((d) => d.is_sample);
  assert(sample, `the sample database is there (got ${dbs.text.slice(0, 300)})`);
  const query = { database: sample.id, type: "native", native: { query: "SELECT COUNT(*) FROM PEOPLE" } };
  const run = await api.post("/api/dataset", query);
  const count = run.json?.data?.rows?.[0]?.[0];
  assert(count > 0, `a native query runs (got ${run.status}: ${run.text.slice(0, 300)})`);
  log(`sample database: ${count} people`);

  const card = await api.post("/api/card", {
    name: "e2e people",
    display: "scalar",
    visualization_settings: {},
    collection_id: col.json.id,
    dataset_query: query,
  });
  assert(card.status === 200 && card.json?.id, `question saved (got ${card.status}: ${card.text.slice(0, 300)})`);
  return { collectionId: col.json.id, cardId: card.json.id, count };
}

export async function verify(ctx, { collectionId, cardId, count }) {
  const { assert } = ctx;
  const api = await session(ctx);
  const col = await api.get(`/api/collection/${collectionId}`);
  assert(col.json?.name === "e2e", `collection still there (got ${col.status})`);
  const run = await api.post(`/api/card/${cardId}/query`, {});
  assert(run.json?.data?.rows?.[0]?.[0] === count, `saved question still answers ${count} (got ${run.status}: ${run.text.slice(0, 300)})`);
}
