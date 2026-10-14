// Over the public HTTP interface: queries without the password are refused,
// the "default" user creates a table and inserts rows (and may manage users),
// and the rows are still there after a restart.
const PASSWORD = "e2e-clickhouse-pass";
export const vars = { CLICKHOUSE_PASSWORD: PASSWORD };

const as = (user, key) => ({ "X-ClickHouse-User": user, "X-ClickHouse-Key": key });
const query = (http, sql, headers = as("default", PASSWORD)) =>
  http("clickhouse", "/", { method: "POST", headers, body: sql });

export async function setup({ http, assert }) {
  const anon = await http("clickhouse", "/?query=SELECT%201");
  assert(anon.status !== 200, `a query without credentials is refused (got ${anon.status}: ${anon.text})`);
  const wrong = await query(http, "SELECT 1", as("default", "wrong"));
  assert(wrong.status !== 200, `a wrong password is refused (got ${wrong.status})`);

  for (const sql of [
    "CREATE DATABASE IF NOT EXISTS e2e",
    "CREATE TABLE e2e.events (id UInt32, at DateTime) ENGINE = MergeTree ORDER BY id",
    "INSERT INTO e2e.events SELECT number, now() FROM numbers(100000)",
    "CREATE USER IF NOT EXISTS reader IDENTIFIED BY 'e2e-reader-pass'",
    "GRANT SELECT ON e2e.* TO reader",
  ]) {
    const r = await query(http, sql);
    assert(r.status === 200, `${sql.split(" ").slice(0, 3).join(" ")}… (got ${r.status}: ${r.text})`);
  }
}

export async function verify({ http, assert }) {
  const count = await query(http, "SELECT count() FROM e2e.events");
  assert(count.text.trim() === "100000", `100000 rows (got ${count.status}: ${count.text})`);
  const reader = await query(http, "SELECT count() FROM e2e.events", as("reader", "e2e-reader-pass"));
  assert(reader.text.trim() === "100000", `the user created over SQL can read (got ${reader.status}: ${reader.text})`);
}
