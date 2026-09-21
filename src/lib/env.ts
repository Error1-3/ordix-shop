import "server-only";
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  STORE_NAME: z.string().min(1).default("iDevice Store"),
  STORE_CURRENCY: z.literal("UAH").default("UAH"),
  DEFAULT_LOCALE: z.enum(["uk", "en"]).default("uk"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  REQUIRE_EMAIL_VERIFICATION: z.enum(["true", "false", "1", "0", ""]).optional().transform((v) => (v === undefined || v === "" ? true : v === "true" || v === "1")),
  DATA_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex chars").optional(),

  LIQPAY_PUBLIC_KEY: z.string().optional().default(""),
  LIQPAY_PRIVATE_KEY: z.string().optional().default(""),
  LIQPAY_CALLBACK_URL: z.string().optional().default(""),
  LIQPAY_RESULT_URL: z.string().optional().default(""),
  LIQPAY_ALLOW_SANDBOX: bool,

  NOVA_POSHTA_API_KEY: z.string().optional().default(""),
  NOVA_POSHTA_SENDER_REF: z.string().optional().default(""),
  NOVA_POSHTA_SENDER_CONTACT_REF: z.string().optional().default(""),
  NOVA_POSHTA_SENDER_CITY_REF: z.string().optional().default(""),
  NOVA_POSHTA_SENDER_WAREHOUSE_REF: z.string().optional().default(""),
  NOVA_POSHTA_SENDER_PHONE: z.string().optional().default(""),

  EMAIL_PROVIDER: z.enum(["resend", "smtp", "console"]).default("console"),
  EMAIL_FROM: z.string().default("iDevice Store <no-reply@example.com>"),
  RESEND_API_KEY: z.string().optional().default(""),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  ADMIN_EMAIL: z.string().optional().default(""),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),

  UPSTASH_REDIS_REST_URL: z.string().optional().default(""),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(""),
  CRON_SECRET: z.string().optional().default(""),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Validated env. Throws a readable error listing every bad variable. Secrets are only ever read here, server-side. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === "production") {
    if (e.LIQPAY_ALLOW_SANDBOX) console.warn("[env] LIQPAY_ALLOW_SANDBOX=true in production — test payments will be accepted as paid!");
    if (!e.DATA_ENCRYPTION_KEY) console.warn("[env] DATA_ENCRYPTION_KEY is not set — used-device IMEI/serial cannot be stored.");
  }
  cached = e;
  return e;
}

export const siteUrl = () => env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
export const isProd = () => env().NODE_ENV === "production";

export function liqpayConfigured() {
  const e = env();
  return Boolean(e.LIQPAY_PUBLIC_KEY && e.LIQPAY_PRIVATE_KEY);
}
export function novaPoshtaConfigured() {
  return Boolean(env().NOVA_POSHTA_API_KEY);
}
