#!/usr/bin/env node
// Validate every template and assemble dist/catalog.json — the document
// Unbroker Cloud reads for its "Deploy a Template" gallery.
//
//   node scripts/build.mjs           validate + write dist/catalog.json
//   node scripts/build.mjs --check   validate only (CI on pull requests)
//
// Logos are inlined as data URIs (SVGs minified, PNGs shrunk to WebP) so the
// gallery shows them with the catalog, without one request per logo.
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { optimize } from "svgo";
import { parse } from "yaml";
import { templateSchema } from "./schema.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const TEMPLATES = join(ROOT, "templates");
const LOGOS = ["logo.svg", "logo.png"];
const MAX_LOGO_BYTES = 64 * 1024;
// Twice the largest size the gallery draws a logo at.
const LOGO_PX = 96;
// What Unbroker Cloud accepts for an inline logo (data URI length).
const MAX_INLINE_CHARS = 64_000;

/** The logo as a small data URI. */
async function inlineLogo(path) {
  const bytes = await readFile(path);
  if (path.endsWith(".svg")) {
    const { data } = optimize(bytes.toString("utf8"), { multipass: true });
    return `data:image/svg+xml;base64,${Buffer.from(data).toString("base64")}`;
  }
  const webp = await sharp(bytes)
    .resize(LOGO_PX, LOGO_PX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
  return `data:image/webp;base64,${webp.toString("base64")}`;
}

const check = process.argv.includes("--check");
const commit = process.env.CATALOG_COMMIT || null;

const errors = [];
const templates = [];

for (const slug of (await readdir(TEMPLATES)).sort()) {
  const dir = join(TEMPLATES, slug);
  const fail = (msg) => errors.push(`${slug}: ${msg}`);
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(slug)) {
    fail("folder name must be a lowercase slug (max 40 chars)");
    continue;
  }
  const manifest = join(dir, "template.yaml");
  if (!existsSync(manifest)) {
    fail("missing template.yaml");
    continue;
  }
  let raw;
  try {
    raw = parse(await readFile(manifest, "utf8"));
  } catch (error) {
    fail(`template.yaml is not valid YAML: ${error.message}`);
    continue;
  }
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues)
      fail(`${issue.path.join(".") || "(root)"}: ${issue.message}`);
    continue;
  }
  const readmePath = join(dir, "README.md");
  if (!existsSync(readmePath)) {
    fail("missing README.md (the template's detail page)");
    continue;
  }
  const readme = await readFile(readmePath, "utf8");
  const logo = LOGOS.find((f) => existsSync(join(dir, f)));
  let logoUrl = null;
  if (logo) {
    const bytes = (await readFile(join(dir, logo))).length;
    if (bytes > MAX_LOGO_BYTES) fail(`${logo} is ${bytes} bytes (max ${MAX_LOGO_BYTES})`);
    logoUrl = await inlineLogo(join(dir, logo));
    if (logoUrl.length > MAX_INLINE_CHARS)
      fail(`${logo} is still ${logoUrl.length} chars inlined (max ${MAX_INLINE_CHARS})`);
  }
  templates.push({ slug, ...parsed.data, logoUrl, readme });
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ ${templates.length} template(s) valid: ${templates.map((t) => t.slug).join(", ")}`);
if (!check) {
  await mkdir(join(ROOT, "dist"), { recursive: true });
  const catalog = { version: 1, commit, generatedAt: new Date().toISOString(), templates };
  await writeFile(join(ROOT, "dist", "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
  console.log("→ dist/catalog.json");
}
