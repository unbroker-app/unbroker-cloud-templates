#!/usr/bin/env node
// End-to-end check for one template, the way CI runs it on every pull request
// that touches it:
//   1. `npm run try` starts it under the platform's constraints and waits until
//      every public service answers its healthcheck;
//   2. scripts/e2e/<slug>.mjs, if there is one, drives the app: sign in,
//      create something (setup), then check it is there (verify);
//   3. every container restarts, the app must come back healthy, and verify
//      runs again: the data has to survive a restart;
//   4. on failure, every container's logs are printed.
//
//   npm run e2e -- <slug> [--keep]     --keep leaves it running afterwards
//
// An e2e file exports any of:
//   vars                     answers for the deploy form (missing required
//                            ones get a random value, or an email if the
//                            name says EMAIL)
//   setup(ctx)               runs once after the first boot; may return state
//   verify(ctx, state)       runs after the first boot and after the restart
//   sidecars                 [{ name, image, port, env? }]: helper containers
//                            that are not part of the template (a mail catcher,
//                            say), started first on the template's network.
//                            The template reaches one at ubt-<slug>-<name>
//                            and the test at ctx.sidecar(name).
// ctx is { url(service), env(service), exec(service, argv), logs(service),
//          log(msg), sidecar(name),
//          http(service, path, init) → { status, headers, text, json } }.
// Throw (or use ctx.assert) to fail.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { templateSchema } from "./schema.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const [slug, ...rest] = process.argv.slice(2);
if (!slug) {
  console.error("usage: npm run e2e -- <slug> [--keep]");
  process.exit(2);
}
const keep = rest.includes("--keep");
const CI = !!process.env.GITHUB_ACTIONS;
const group = (title) => CI && console.log(`::group::${title}`);
const endGroup = () => CI && console.log("::endgroup::");

const template = templateSchema.parse(
  parse(await readFile(join(ROOT, "templates", slug, "template.yaml"), "utf8")),
);
const e2ePath = join(ROOT, "scripts", "e2e", `${slug}.mjs`);
const spec = existsSync(e2ePath) ? await import(pathToFileURL(e2ePath)) : {};

const answers = { ...(spec.vars ?? {}) };
for (const [key, v] of Object.entries(template.variables))
  if (!(key in answers) && v.default === undefined && v.required)
    answers[key] = /EMAIL/.test(key) ? "e2e@example.com" : `E2e-${randomBytes(12).toString("hex")}`;

const sidecarHost = (slug, name) => `ubt-${slug}-${name}`;
const sidecars = {};

const node = (args) => spawnSync("node", [join(ROOT, "scripts", "try.mjs"), slug, ...args], { stdio: "inherit" });
const docker = (args) => spawnSync("docker", args, { encoding: "utf8" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let state;
const step = async (title, fn) => {
  console.log(`\n▶ ${title}`);
  const t0 = Date.now();
  const out = await fn();
  console.log(`✓ ${title} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  return out;
};

async function waitHealthy() {
  for (const [name, s] of Object.entries(state.services).filter(([, s]) => s.public)) {
    const url = `${s.url}${s.healthcheck ?? "/"}`;
    const deadline = Date.now() + 240_000;
    let status = 0;
    while (Date.now() < deadline) {
      status = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5000) })
        .then((r) => r.status)
        .catch(() => 0);
      if (status >= 200 && status < 400) break;
      await sleep(2000);
    }
    if (!(status >= 200 && status < 400)) throw new Error(`${name} not healthy at ${url} (${status || "no answer"})`);
    console.log(`  ${name} ✓ ${status}`);
  }
}

const ctx = {
  url: (name) => state.services[name].url,
  sidecar: (name) => sidecars[name],
  env: (name) => state.services[name].env,
  log: (msg) => console.log(`  ${msg}`),
  assert(cond, msg) {
    if (!cond) throw new Error(`assertion failed: ${msg}`);
  },
  logs: (name) => {
    const r = docker(["logs", state.services[name].container]);
    return r.stdout + r.stderr;
  },
  exec(name, argv) {
    const r = docker(["exec", state.services[name].container, ...argv]);
    if (r.status !== 0) throw new Error(`exec in ${name} failed: ${r.stderr || r.stdout}`);
    return r.stdout;
  },
  async http(name, path, init = {}) {
    const res = await fetch(`${state.services[name].url}${path}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
      ...init,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, headers: res.headers, text, json };
  },
};

function dumpLogs() {
  const containers = [
    ...Object.values(state?.services ?? {}).map((s) => s.container),
    ...(spec.sidecars ?? []).map((s) => sidecarHost(slug, s.name)),
  ];
  for (const c of containers) {
    group(`logs: ${c}`);
    if (!CI) console.log(`\n── logs: ${c}`);
    const r = docker(["logs", "--tail", "300", c]);
    console.log(r.stdout + r.stderr);
    endGroup();
  }
}

let ok = false;
try {
  if (spec.sidecars?.length)
    await step("sidecars", async () => {
      const net = `ubt-${slug}`;
      if (docker(["network", "inspect", net]).status !== 0) docker(["network", "create", net]);
      for (const sc of spec.sidecars) {
        const name = sidecarHost(slug, sc.name);
        docker(["rm", "-f", name]);
        const env = Object.entries(sc.env ?? {}).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
        const r = docker(["run", "-d", "--name", name, "--network", net, "-p", `127.0.0.1::${sc.port}`, ...env, sc.image]);
        if (r.status !== 0) throw new Error(`sidecar ${sc.name}: ${r.stderr}`);
        const hostPort = docker(["port", name, String(sc.port)]).stdout.trim().split("\n")[0].split(":").pop();
        sidecars[sc.name] = `http://localhost:${hostPort}`;
        console.log(`  ${sc.name} (${sc.image}) at ${sidecars[sc.name]}`);
      }
    });
  const sets = Object.entries(answers).flatMap(([k, v]) => ["--set", `${k}=${v}`]);
  await step("first boot", async () => {
    const r = node(sets);
    state = existsSync(join(ROOT, ".try", `${slug}.json`))
      ? JSON.parse(await readFile(join(ROOT, ".try", `${slug}.json`), "utf8"))
      : null;
    if (r.status !== 0) throw new Error("npm run try failed");
  });
  const data = spec.setup ? await step("setup", () => spec.setup(ctx)) : undefined;
  if (spec.verify) await step("verify", () => spec.verify(ctx, data));
  await step("restart every container", async () => {
    for (const c of state.order) {
      const r = docker(["restart", c]);
      if (r.status !== 0) throw new Error(`restart ${c}: ${r.stderr}`);
    }
    await waitHealthy();
  });
  if (spec.verify) await step("verify after restart", () => spec.verify(ctx, data));
  ok = true;
} catch (error) {
  console.error(`\n✗ ${error.stack ?? error}`);
  dumpLogs();
} finally {
  if (!keep) {
    for (const sc of spec.sidecars ?? []) docker(["rm", "-f", sidecarHost(slug, sc.name)]);
    node(["--down"]);
  }
}
console.log(ok ? `\n✓ ${slug} passed end-to-end` : `\n✗ ${slug} failed end-to-end`);
process.exit(ok ? 0 : 1);
