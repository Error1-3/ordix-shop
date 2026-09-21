import { z } from "zod";

/** Non-secret, admin-editable settings. SECRETS (LiqPay private key, NP API key, …) stay in environment variables only. */

export const storeSettingsSchema = z.object({
  name: z.string().min(1).max(60),
  legalName: z.string().max(200).default(""), // ФОП / ТОВ — fill in
  taxId: z.string().max(30).default(""), // ЄДРПОУ / ІПН
  logoUrl: z.string().max(500).default(""),
  phone: z.string().max(40).default(""),
  email: z.string().max(120).default(""),
  address: z.string().max(300).default(""),
  workingHours: z.string().max(120).default("Пн–Нд 10:00–20:00"),
  social: z.object({
    instagram: z.string().default(""),
    telegram: z.string().default(""),
    facebook: z.string().default(""),
    tiktok: z.string().default(""),
    youtube: z.string().default(""),
  }).default({}),
});

export const paymentSettingsSchema = z.object({
  liqpayEnabled: z.boolean().default(true),
  codEnabled: z.boolean().default(true),
  payOnReceiveEnabled: z.boolean().default(true),
  /** Required online prepayment for NP COD orders, in minor units. 0 = none. */
  codPrepaymentAmount: z.number().int().min(0).default(0),
  /** Fill from the carrier's current COD tariff. Defaults are 0 — this app does not guess carrier fees. */
  codCommissionPercent: z.number().min(0).max(100).default(0),
  codCommissionFixed: z.number().int().min(0).default(0),
  /** Max order total (minor units) allowed for COD; 0 = unlimited. */
  codMaxTotal: z.number().int().min(0).default(0),
});

export const shippingSettingsSchema = z.object({
  flatFee: z.number().int().min(0).default(0),
  freeShippingThreshold: z.number().int().min(0).nullable().default(null),
  /** Text shown at checkout about carrier tariffs. */
  note: z.string().max(300).default("Доставка Новою поштою за тарифами перевізника, оплачується при отриманні."),
  defaultWeightGrams: z.number().int().min(50).default(500),
  /** Who pays the carrier for delivery on the waybill. */
  payer: z.enum(["Recipient", "Sender"]).default("Recipient"),
});

export const orderSettingsSchema = z.object({
  reservationMinutes: z.number().int().min(10).max(24 * 60).default(60),
  maxQuantityPerItem: z.number().int().min(1).max(20).default(5),
  autoConfirmCodOrders: z.boolean().default(false),
  notifyAdminEmail: z.boolean().default(true),
});

export const warrantySettingsSchema = z.object({
  newMonths: z.number().int().min(0).default(12),
  usedMonths: z.number().int().min(0).default(3),
  text: z.string().max(500).default("Гарантія від магазину. Умови — на сторінці «Гарантія»."),
});

export const seoSettingsSchema = z.object({
  titleTemplate: z.string().default("%s | iDevice Store"),
  defaultTitle: z.string().default("iDevice Store — техніка Apple в Україні"),
  defaultDescription: z.string().default("Нові та вживані iPhone, MacBook, iPad, Apple Watch і AirPods з гарантією. Доставка Новою поштою по Україні."),
  ogImage: z.string().default(""),
});

export const analyticsSettingsSchema = z.object({
  ga4Id: z.string().default(""),
  gtmId: z.string().default(""),
  metaPixelId: z.string().default(""),
});

export const homepageSettingsSchema = z.object({
  heroTitle: z.string().default("iPhone, які пройшли перевірку"),
  heroSubtitle: z.string().default("Нові та вживані з гарантією. Кожен вживаний — з результатами діагностики та власними фото."),
  showUsed: z.boolean().default(true),
  showRefurbished: z.boolean().default(true),
  announcement: z.string().max(200).default(""),
});

export const emailSettingsSchema = z.object({
  fromName: z.string().default("iDevice Store"),
  adminNotificationEmail: z.string().default(""),
});

export const SETTINGS_SCHEMAS = {
  store: storeSettingsSchema,
  payments: paymentSettingsSchema,
  shipping: shippingSettingsSchema,
  orders: orderSettingsSchema,
  warranty: warrantySettingsSchema,
  seo: seoSettingsSchema,
  analytics: analyticsSettingsSchema,
  homepage: homepageSettingsSchema,
  email: emailSettingsSchema,
} as const;

export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;
export type SettingsMap = { [K in SettingsKey]: z.infer<(typeof SETTINGS_SCHEMAS)[K]> };
