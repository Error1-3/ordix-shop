import { z } from "zod";
import { normalizeUaPhone, sanitizeMultiline, sanitizeText } from "./sanitize";

const cleanText = (max: number, min = 1) => z.string().transform((s) => sanitizeText(s, max)).pipe(z.string().min(min).max(max));
export const emailSchema = z.string().trim().toLowerCase().email("Некоректний e-mail").max(254);
export const phoneSchema = z
  .string()
  .transform((s, ctx) => {
    const n = normalizeUaPhone(s);
    if (!n) ctx.addIssue({ code: "custom", message: "Введіть номер у форматі +380XXXXXXXXX" });
    return n ?? "";
  });

// Password policy: length matters more than composition (NIST 800-63B). 10+ chars, not trivially weak.
export const passwordSchema = z
  .string()
  .min(10, "Мінімум 10 символів")
  .max(128, "Максимум 128 символів")
  .refine((p) => !/^(.)\1+$/.test(p), "Пароль занадто простий")
  .refine((p) => !["1234567890", "password12", "qwerty1234", "0987654321"].includes(p.toLowerCase()), "Пароль занадто простий");

export const registerSchema = z.object({
  firstName: cleanText(60),
  lastName: cleanText(60),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
  password: passwordSchema,
  acceptTerms: z.literal("on", { errorMap: () => ({ message: "Потрібна згода з умовами" }) }),
});

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });

export const checkoutSchema = z
  .object({
    firstName: cleanText(60),
    lastName: cleanText(60),
    phone: phoneSchema,
    email: emailSchema,
    deliveryMethod: z.enum(["NP_WAREHOUSE", "NP_LOCKER", "NP_COURIER"]),
    city: cleanText(120),
    cityRef: z.string().max(64).optional(),
    warehouseRef: z.string().max(64).optional(),
    warehouseName: z.string().transform((s) => sanitizeText(s, 250)).optional(),
    address: z.string().transform((s) => sanitizeText(s, 250)).optional(),
    comment: z.string().transform((s) => sanitizeMultiline(s, 500)).optional(),
    paymentMethod: z.enum(["LIQPAY_CARD", "NP_COD", "PAY_ON_RECEIVE"]),
    acceptOffer: z.literal(true, { errorMap: () => ({ message: "Потрібна згода з публічною офертою" }) }),
  })
  .superRefine((v, ctx) => {
    if (v.deliveryMethod === "NP_COURIER") {
      if (!v.address || v.address.length < 5) ctx.addIssue({ code: "custom", path: ["address"], message: "Вкажіть адресу доставки" });
    } else if (!v.warehouseRef) {
      ctx.addIssue({ code: "custom", path: ["warehouseRef"], message: "Оберіть відділення або поштомат" });
    }
    if (!v.cityRef) ctx.addIssue({ code: "custom", path: ["cityRef"], message: "Оберіть місто зі списку" });
  });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const cartAddSchema = z.object({ variantId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(20).default(1) });
export const cartUpdateSchema = z.object({ variantId: z.string().min(1).max(40), quantity: z.number().int().min(0).max(20) });
export const couponCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,40}$/, "Некоректний код");

export const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  title: cleanText(100, 3),
  body: z.string().transform((s) => sanitizeMultiline(s, 3000)).pipe(z.string().min(10, "Мінімум 10 символів")),
});

export const newsletterSchema = z.object({ email: emailSchema });

export const addressSchema = z.object({
  label: cleanText(40).default("Основна"),
  firstName: cleanText(60),
  lastName: cleanText(60),
  phone: phoneSchema,
  city: cleanText(120),
  cityRef: z.string().max(64).optional(),
  warehouseRef: z.string().max(64).optional(),
  warehouseName: z.string().transform((s) => sanitizeText(s, 250)).optional(),
  street: z.string().transform((s) => sanitizeText(s, 120)).optional(),
  house: z.string().transform((s) => sanitizeText(s, 20)).optional(),
  apartment: z.string().transform((s) => sanitizeText(s, 20)).optional(),
  isDefault: z.boolean().default(false),
});

export const profileSchema = z.object({
  firstName: cleanText(60),
  lastName: cleanText(60),
  phone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
});

export const catalogQuerySchema = z.object({
  q: z.string().transform((s) => sanitizeText(s, 80)).optional(),
  category: z.string().max(60).optional(),
  model: z.string().max(80).optional(),
  condition: z.string().optional(), // comma separated
  storage: z.string().optional(),
  color: z.string().optional(),
  brand: z.string().max(40).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  minBattery: z.coerce.number().int().min(0).max(100).optional(),
  minWarranty: z.coerce.number().int().min(0).max(60).optional(),
  inStock: z.enum(["1", "0"]).optional(),
  sort: z.enum(["recommended", "newest", "price_asc", "price_desc", "popular"]).default("recommended"),
  page: z.coerce.number().int().min(1).max(500).default(1),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
