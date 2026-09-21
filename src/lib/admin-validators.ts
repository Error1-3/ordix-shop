import { z } from "zod";
import { parseMoney } from "./money";
import { isValidImei } from "./crypto";

/** UAH text input ("1 299,50") -> minor units. Empty -> null. */
const moneyField = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const s = String(v).trim();
    if (s === "") return null;
    try {
      return parseMoney(s);
    } catch {
      ctx.addIssue({ code: "custom", message: "Некоректна сума" });
      return z.NEVER;
    }
  });
const requiredMoney = moneyField.refine((v): v is number => v !== null, "Вкажіть суму");

const opt = (max: number) => z.string().max(max).optional().transform((s) => (s?.trim() ? s.trim() : null));
const functional = z.enum(["OK", "DEFECT", "NOT_TESTED", "NOT_APPLICABLE"]);
const physical = z.enum(["PERFECT", "MINOR_WEAR", "VISIBLE_WEAR", "HEAVY_WEAR"]);

export const usedDeviceSchema = z.object({
  status: z.enum(["DRAFT", "IN_TESTING", "READY", "RESERVED", "SOLD", "RETURNED"]).default("DRAFT"),
  batteryHealth: z.coerce.number().int().min(0).max(100).nullable().optional().transform((v) => v ?? null),
  cycleCount: z.coerce.number().int().min(0).max(5000).nullable().optional().transform((v) => v ?? null),
  deviceGrade: z.enum(["A_PLUS", "A", "B", "C"]).nullable().optional().transform((v) => v ?? null),
  physicalCondition: physical.nullable().optional().transform((v) => v ?? null),
  screenCondition: physical.nullable().optional().transform((v) => v ?? null),
  cameraCondition: functional.default("NOT_TESTED"),
  faceIdStatus: functional.default("NOT_TESTED"),
  touchIdStatus: functional.default("NOT_APPLICABLE"),
  trueToneStatus: functional.default("NOT_TESTED"),
  speakerStatus: functional.default("NOT_TESTED"),
  microphoneStatus: functional.default("NOT_TESTED"),
  chargingPortStatus: functional.default("NOT_TESTED"),
  wifiStatus: functional.default("NOT_TESTED"),
  bluetoothStatus: functional.default("NOT_TESTED"),
  simStatus: functional.default("NOT_TESTED"),
  accessoriesIncluded: z.array(z.string().max(60)).max(15).default([]),
  warrantyMonths: z.coerce.number().int().min(0).max(60).default(3),
  defects: opt(2000),
  inspectionNotes: opt(2000),
});

export const secretSchema = z.object({
  imei: z.string().trim().optional().transform((s) => (s ? s.replace(/\s/g, "") : null))
    .refine((s) => s === null || isValidImei(s), "Некоректний IMEI (15 цифр, перевірка Luhn)"),
  serial: z.string().trim().max(40).optional().transform((s) => (s ? s.toUpperCase() : null)),
  purchaseCost: moneyField.optional().transform((v) => v ?? null),
  purchaseSource: opt(200),
  supplier: opt(200),
  internalNotes: opt(4000),
  checklist: z.array(z.object({ item: z.string().max(80), passed: z.boolean(), note: z.string().max(200).optional() })).max(40).default([]),
});

export const variantSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1).max(40), // client-side temp id used to link images to not-yet-saved variants
  sku: z.string().trim().min(2).max(60),
  storage: opt(30), color: opt(40), colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("").transform(() => undefined)),
  condition: z.enum(["NEW", "LIKE_NEW", "EXCELLENT", "GOOD", "FAIR"]),
  simType: opt(60), connectivity: opt(60),
  price: requiredMoney, compareAtPrice: moneyField.optional().transform((v) => v ?? null), costPrice: moneyField.optional().transform((v) => v ?? null),
  warrantyMonths: z.coerce.number().int().min(0).max(60).default(12),
  weightGrams: z.coerce.number().int().min(10).max(30000).default(400),
  isActive: z.boolean().default(true),
  stock: z.coerce.number().int().min(0).max(100000).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000).default(2),
  used: usedDeviceSchema.optional(),
  secret: secretSchema.optional(),
});

export const imageSchema = z.object({
  id: z.string().optional(), url: z.string().url().max(600), publicId: z.string().max(200).optional(), alt: z.string().max(200).default(""),
  variantKey: z.string().max(40).nullable().optional(), isPrimary: z.boolean().default(false),
});

export const productPayloadSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2).max(160), slug: z.string().trim().max(120).optional(),
  brand: z.string().trim().min(1).max(40).default("Apple"), model: z.string().trim().min(1).max(80),
  categoryId: z.string().min(1),
  description: z.string().max(20000).default(""), shortDescription: z.string().max(300).default(""),
  sku: z.string().trim().min(2).max(60), barcode: opt(40),
  isActive: z.boolean().default(true), isFeatured: z.boolean().default(false), isNew: z.boolean().default(false),
  specifications: z.array(z.object({ group: z.string().max(80), items: z.array(z.object({ label: z.string().max(80), value: z.string().max(200) })).max(40) })).max(20).default([]),
  faq: z.array(z.object({ q: z.string().max(200), a: z.string().max(1500) })).max(20).default([]),
  seoTitle: opt(120), seoDescription: opt(300),
  variants: z.array(variantSchema).min(1, "Додайте хоча б один варіант").max(60),
  images: z.array(imageSchema).max(60).default([]),
});
export type ProductPayload = z.infer<typeof productPayloadSchema>;
export type ProductPayloadInput = z.input<typeof productPayloadSchema>;

export const couponSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,40}$/, "Лише A–Z, 0–9, _ та -"),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.union([z.string(), z.number()]),
  minOrderAmount: moneyField.optional().transform((v) => v ?? null),
  startsAt: z.string().optional().transform((s) => (s ? new Date(s) : null)),
  expiresAt: z.string().optional().transform((s) => (s ? new Date(s) : null)),
  usageLimit: z.coerce.number().int().min(1).nullable().optional().transform((v) => v ?? null),
  perCustomerLimit: z.coerce.number().int().min(1).nullable().optional().transform((v) => v ?? null),
  productIds: z.array(z.string()).default([]), categoryIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
}).superRefine((v, ctx) => {
  if (v.type === "PERCENT") {
    const n = Number(v.value);
    if (!Number.isInteger(n) || n < 1 || n > 100) ctx.addIssue({ code: "custom", path: ["value"], message: "Відсоток 1–100" });
  } else {
    try { if (parseMoney(String(v.value)) <= 0) throw new Error(); } catch { ctx.addIssue({ code: "custom", path: ["value"], message: "Некоректна сума" }); }
  }
});
