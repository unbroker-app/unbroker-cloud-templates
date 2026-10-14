#!/usr/bin/env node
// Run a template on your machine under the same constraints Unbroker Cloud
// applies, so "works here" means "works there":
//   • every app container runs as uid/gid 10001 (datastore presets as 999),
//     with all capabilities dropped and no-new-privileges;
//   • HOME=/tmp, /tmp is a small tmpfs, PORT (and HOST=0.0.0.0 for apps) are
//     injected; the image's own filesystem is NOT writable by that user —
//     only the declared volume is;
//   • ${{services.x.host|port|url|env.KEY}}, ${{secret}} and ${{vars.KEY}} are
//     resolved the way a deploy resolves them.
//
//   npm run try -- <slug> [--set KEY=value ...]   start it, wait until healthy
//   npm run try -- <slug> --down                  remove containers + volumes
//
// Needs Docker. Public services are published on a free localhost port.
import { spawnSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { parse } from "yaml";
import { PRESETS } from "./presets.mjs";
import { SECRET_TOKEN_RE, SERVICE_TOKEN_RE, VAR_TOKEN_RE, templateSchema } from "./schema.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const [slug, ...rest] = process.argv.slice(2);
if (!slug) {
  console.error("usage: npm run try -- <slug> [--set KEY=value ...] [--down]");
  process.exit(2);
}
const net = `ubt-${slug}`;
const cname = (svc) => `ubt-${slug}-${svc}`;

function docker(args, { quiet = false, check = true } = {}) {
  const r = spawnSync("docker", args, { encoding: "utf8" });
  if (check && r.status !== 0) {
    if (!quiet) console.error(r.stderr || r.stdout);
    throw new Error(`docker ${args[0]} failed`);
  }
  return r.stdout.trim();
}

const template = templateSchema.parse(
  parse(await readFile(join(ROOT, "templates", slug, "template.yaml"), "utf8")),
);
const names = Object.keys(template.services);

if (rest.includes("--down")) {
  for (const s of names) {
    docker(["rm", "-f", cname(s)], { check: false });
    docker(["volume", "rm", "-f", `${cname(s)}-data`], { check: false });
  }
  docker(["network", "rm", net], { check: false });
  await rm(join(ROOT, ".try", `${slug}.json`), { force: true });
  console.log(`✓ removed ${slug}`);
  process.exit(0);
}

const answers = {};
for (let i = 0; i < rest.length; i++)
  if (rest[i] === "--set") {
    const [k, ...v] = rest[++i].split("=");
    answers[k] = v.join("=");
  }
const vars = {};
for (const [key, spec] of Object.entries(template.variables)) {
  vars[key] = answers[key] ?? spec.default ?? "";
  if (!vars[key] && spec.required) {
    console.error(`missing --set ${key}=…  (${spec.description})`);
    process.exit(2);
  }
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const secret = (n) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const freePort = () =>
  new Promise((resolve) => {
    const srv = createServer().listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

// Expand every service the way the platform does.
const specs = {};
for (const [name, svc] of Object.entries(template.services)) {
  const fill = (v) =>
    v.replace(SECRET_TOKEN_RE, (_m, n) => secret(n ? Number(n) : 32)).replace(VAR_TOKEN_RE, (_m, k) => vars[k]);
  const env = Object.fromEntries(Object.entries(svc.env).map(([k, v]) => [k, fill(v)]));
  if ("preset" in svc) {
    const p = PRESETS[svc.preset](secret(24));
    specs[name] = { ...p, uid: 999, public: false, env: { ...p.env, ...env } };
  } else {
    specs[name] = {
      image: svc.image,
      port: svc.port,
      volumePath: svc.volume?.path,
      startCommand: svc.startCommand,
      healthcheck: svc.healthcheck,
      uid: 10001,
      public: svc.public,
      env,
    };
  }
  if (specs[name].public) specs[name].hostPort = await freePort();
}

// Resolve references, now that every service's env and address is known.
const resolve = (value, depth = 0) =>
  value.replace(SERVICE_TOKEN_RE, (_m, target, output) => {
    const t = specs[target];
    if (output === "host") return cname(target);
    if (output === "port") return String(t.port);
    if (output === "slug") return target;
    if (output === "url") return t.public ? `http://localhost:${t.hostPort}` : `http://${cname(target)}:${t.port}`;
    const v = t.env[output.slice(4)] ?? "";
    return depth < 5 ? resolve(v, depth + 1) : v;
  });
for (const s of Object.values(specs))
  s.resolved = Object.fromEntries(Object.entries(s.env).map(([k, v]) => [k, resolve(v)]));

// Datastores first, then apps in declaration order.
const order = [...names.filter((n) => "preset" in template.services[n]), ...names.filter((n) => !("preset" in template.services[n]))];

if (spawnSync("docker", ["network", "inspect", net]).status !== 0) docker(["network", "create", net]);
for (const name of order) {
  const s = specs[name];
  const id = cname(name);
  docker(["rm", "-f", id], { check: false });
  // Restart on failure like a Deployment does, so an app that starts before its
  // database is ready recovers the same way it would in the cluster.
  const args = ["run", "-d", "--name", id, "--network", net, "--restart", "on-failure:10"];
  args.push("--user", `${s.uid}:${s.uid}`, "--cap-drop", "ALL", "--security-opt", "no-new-privileges");
  args.push("--tmpfs", `/tmp:size=256m,uid=${s.uid},gid=${s.uid},mode=1777`);
  if (s.volumePath) {
    const vol = `${id}-data`;
    docker(["volume", "create", vol]);
    // Kubernetes' fsGroup makes the volume writable by the pod's group; emulate it.
    docker(["run", "--rm", "-v", `${vol}:/v`, "alpine:3", "chown", `${s.uid}:${s.uid}`, "/v"]);
    // volume-nocopy: Docker would otherwise copy the image's directory (and its
    // owner) into the fresh volume, which a Kubernetes PVC never does.
    args.push("--mount", `type=volume,src=${vol},dst=${s.volumePath},volume-nocopy`);
  }
  if (s.hostPort) args.push("-p", `127.0.0.1:${s.hostPort}:${s.port}`);
  const env = { HOME: "/tmp", PORT: String(s.port), ...(s.uid === 10001 ? { HOST: "0.0.0.0" } : {}), ...s.resolved };
  env.HOME = "/tmp"; // the platform pins HOME; a template can't move it
  for (const [k, v] of Object.entries(env)) args.push("-e", `${k}=${v}`);
  if (s.startCommand) args.push("--entrypoint", "/bin/sh", s.image, "-c", s.startCommand);
  else args.push(s.image);
  console.log(`▶ ${name} (${s.image})`);
  docker(args);
}

// What scripts/e2e.mjs needs to drive the running template.
await mkdir(join(ROOT, ".try"), { recursive: true });
await writeFile(
  join(ROOT, ".try", `${slug}.json`),
  JSON.stringify(
    {
      slug,
      order: order.map(cname),
      services: Object.fromEntries(
        order.map((n) => [
          n,
          {
            container: cname(n),
            public: specs[n].public,
            url: specs[n].public ? `http://localhost:${specs[n].hostPort}` : null,
            healthcheck: specs[n].healthcheck ?? null,
            env: specs[n].resolved,
          },
        ]),
      ),
    },
    null,
    2,
  ),
);

// Wait for each public service to answer its healthcheck (or /) with 2xx/3xx.
let ok = true;
for (const name of order.filter((n) => specs[n].public)) {
  const s = specs[name];
  const url = `http://localhost:${s.hostPort}${s.healthcheck ?? "/"}`;
  const deadline = Date.now() + 240_000;
  let status = 0;
  process.stdout.write(`… waiting for ${name} at ${url} `);
  while (Date.now() < deadline) {
    status = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5000) })
      .then((r) => r.status)
      .catch(() => 0);
    if (status >= 200 && status < 400) break;
    const state = docker(["inspect", "-f", "{{.State.Status}}", cname(name)], { check: false });
    if (state === "exited") break;
    await new Promise((r) => setTimeout(r, 2000));
    process.stdout.write(".");
  }
  if (status >= 200 && status < 400) console.log(` ✓ ${status}\n  open http://localhost:${s.hostPort}`);
  else {
    ok = false;
    console.log(` ✗ (${status || "no answer"})`);
    const logs = spawnSync("docker", ["logs", "--tail", "60", cname(name)], { encoding: "utf8" });
    console.log(logs.stdout + logs.stderr);
  }
}
console.log(ok ? `\n✓ ${slug} is up — npm run try -- ${slug} --down to remove it` : `\n✗ ${slug} did not become healthy`);
process.exit(ok ? 0 : 1);
