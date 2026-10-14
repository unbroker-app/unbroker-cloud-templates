// The template.yaml contract. This mirrors the schema Unbroker Cloud applies to
// every catalog entry (apps/api/src/modules/templates/templates.schema.ts): a
// template that passes here deploys; one that does not is dropped from the
// gallery, so keep the two in step.
import { z } from "zod";

export const CATEGORIES = [
  "ai",
  "automation",
  "analytics",
  "backend",
  "cms",
  "database",
  "devtools",
  "monitoring",
  "productivity",
  "storage",
  "other",
];
export const PRESETS = ["postgres", "redis", "mongodb", "mysql"];

export const SECRET_TOKEN_RE = /\$\{\{\s*secret(?:\((\d+)\))?\s*\}\}/g;
export const VAR_TOKEN_RE = /\$\{\{\s*vars\.([A-Z_][A-Z0-9_]*)\s*\}\}/g;
export const SERVICE_TOKEN_RE =
  /\$\{\{\s*services\.([a-z0-9][a-z0-9-]*)\.(env\.[A-Z_][A-Z0-9_]*|url|host|port|slug)\s*\}\}/g;

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits and dashes");
const envKey = z.string().regex(/^[A-Z_][A-Z0-9_]*$/, "UPPER_SNAKE_CASE");
const env = z.record(envKey, z.string().max(4000));
const serviceName = z.string().min(1).max(51);
const absPath = z
  .string()
  .max(200)
  .regex(/^\/[A-Za-z0-9._/-]+$/, "an absolute path")
  .refine((v) => !v.split("/").includes(".."), "no '..'");
const httpPath = z
  .string()
  .max(200)
  .regex(/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/, "an absolute URL path");
// Pinned on purpose: `latest` (or no tag) silently changes what a template
// deploys and breaks the "it was verified" promise.
const image = z
  .string()
  .max(255)
  .regex(
    /^(?:[a-z0-9.-]+(?::\d+)?\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*:[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/,
    "an image reference with an explicit tag, e.g. n8nio/n8n:2.44.1",
  )
  .refine((v) => !/:latest$/.test(v), "pin a version instead of :latest");
const sizeGb = z.number().int().min(1).max(50);

const presetService = z
  .object({
    preset: z.enum(PRESETS),
    name: serviceName.optional(),
    volumeSizeGb: sizeGb.default(1),
    env: env.default({}),
  })
  .strict();

const imageService = z
  .object({
    name: serviceName.optional(),
    image,
    port: z.number().int().positive().max(65535),
    public: z.boolean().default(false),
    startCommand: z
      .string()
      .min(1)
      .max(2000)
      .refine((v) => !/[\r\n]/.test(v), "one line")
      .optional(),
    healthcheck: httpPath.optional(),
    volume: z.object({ path: absPath, sizeGb: sizeGb.default(1) }).strict().optional(),
    env: env.default({}),
  })
  .strict();

const httpsUrl = z.string().url().startsWith("https://");

export const templateSchema = z
  .object({
    name: z.string().min(1).max(60),
    tagline: z.string().min(1).max(120),
    category: z.enum(CATEGORIES),
    tags: z.array(z.string().min(1).max(30)).max(10).default([]),
    maintainer: z.string().min(1).max(60).default("Community"),
    official: z.boolean().default(false),
    links: z
      .object({ website: httpsUrl.optional(), source: httpsUrl.optional(), docs: httpsUrl.optional() })
      .strict()
      .default({}),
    variables: z
      .record(
        envKey,
        z
          .object({
            description: z.string().min(1).max(500),
            required: z.boolean().default(true),
            default: z.string().max(4000).optional(),
          })
          .strict(),
      )
      .default({}),
    services: z
      .record(slug.max(30), z.union([presetService, imageService]))
      .refine((s) => Object.keys(s).length >= 1, "a template needs a service")
      .refine((s) => Object.keys(s).length <= 8, "at most 8 services"),
  })
  .strict()
  .superRefine((t, ctx) => {
    const slugs = new Set(Object.keys(t.services));
    const used = new Set();
    for (const [name, svc] of Object.entries(t.services))
      for (const [key, value] of Object.entries(svc.env)) {
        const path = ["services", name, "env", key];
        const issue = (message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
        for (const m of value.matchAll(VAR_TOKEN_RE)) {
          used.add(m[1]);
          if (!(m[1] in t.variables)) issue(`unknown variable "${m[1]}"`);
        }
        for (const m of value.matchAll(SECRET_TOKEN_RE)) {
          const len = m[1] ? Number(m[1]) : 32;
          if (len < 8 || len > 128) issue("a secret is 8 to 128 characters");
        }
        for (const m of value.matchAll(SERVICE_TOKEN_RE)) {
          if (!slugs.has(m[1])) issue(`unknown service "${m[1]}"`);
          if (m[1] === name && m[2].startsWith("env."))
            issue("a service can't read its own variables");
        }
        const stray = value
          .replace(VAR_TOKEN_RE, "")
          .replace(SECRET_TOKEN_RE, "")
          .replace(SERVICE_TOKEN_RE, "");
        if (stray.includes("${{")) issue("unrecognised ${{…}} token");
      }
    for (const key of Object.keys(t.variables))
      if (!used.has(key))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variables", key],
          message: "declared but never used",
        });
    if (!Object.values(t.services).some((s) => s.public))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["services"],
        message: "at least one service must be public (the app the user opens)",
      });
  });
