import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.string().default("debug"),
  SENTRY_DSN: z.string().url().optional(),
  ADMIN_USER_IDS: z.string().optional().transform((s) => s ? s.split(",").map((id) => id.trim()).filter(Boolean) : []),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid server environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

export function parseCorsOrigins(): string[] {
  return env.CORS_ORIGIN.split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
}
