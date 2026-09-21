/**
 * PUBLIC data transfer objects. Everything that reaches the browser (RSC props, JSON APIs, JSON-LD) goes
 * through these mappers, which copy an explicit WHITELIST of fields. Anything else on the DB row —
 * costPrice, purchase data, IMEI/serial, supplier, internal notes — is dropped by construction.
 * Belt and braces: assertNoSecrets() scans an outgoing object for forbidden keys (used in tests + API layer).
 */
import { availableStock } from "./pricing";

export const FORBIDDEN_PUBLIC_KEYS = [
  "imei", "imeiEncrypted", "imeiHash", "serial", "serialNumber", "serialEncrypted", "serialHash",
  "purchaseCost", "purchaseSource", "supplier", "internalNotes", "testingChecklist", "costPrice", "secret",
  "passwordHash", "reservedStock",
] as const;

export function assertNoSecrets(value: unknown, path = "$"): void {
  if (Array.isArray(value)) return value.forEach((v, i) => assertNoSecrets(v, `${path}[${i}]`));
  if (value && typeof value === "object" && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value)) {
      if ((FORBIDDEN_PUBLIC_KEYS as readonly string[]).includes(k)) throw new Error(`Secret field "${k}" leaked into public payload at ${path}`);
      assertNoSecrets(v, `${path}.${k}`);
    }
  }
}

export type PublicImage = { id: string; url: string; alt: string; variantId: string | null };

export type PublicUsedDevice = {
  batteryHealth: number | null;
  cycleCount: number | null;
  deviceGrade: string | null;
  physicalCondition: string | null;
  screenCondition: string | null;
  cameraCondition: string;
  faceIdStatus: string;
  touchIdStatus: string;
  trueToneStatus: string;
  speakerStatus: string;
  microphoneStatus: string;
  chargingPortStatus: string;
  wifiStatus: string;
  bluetoothStatus: string;
  simStatus: string;
  accessoriesIncluded: string[];
  warrantyMonths: number;
  defects: string | null;
  inspectionNotes: string | null;
};

export type PublicVariant = {
  id: string;
  sku: string;
  storage: string | null;
  color: string | null;
  colorHex: string | null;
  condition: string;
  simType: string | null;
  connectivity: string | null;
  price: number;
  compareAtPrice: number | null;
  warrantyMonths: number;
  /** Capped so exact warehouse counts are not exposed. */
  available: number;
  usedDevice: PublicUsedDevice | null;
};

export type PublicProductCard = {
  id: string;
  slug: string;
  title: string;
  model: string;
  brand: string;
  shortDescription: string;
  price: number;
  compareAtPrice: number | null;
  isNew: boolean;
  hasUsed: boolean;
  inStock: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  image: PublicImage | null;
  conditions: string[];
  bestBatteryHealth: number | null;
};

export type PublicProduct = PublicProductCard & {
  description: string;
  categorySlug: string;
  categoryName: string;
  specifications: { group: string; items: { label: string; value: string }[] }[];
  faq: { q: string; a: string }[];
  seoTitle: string | null;
  seoDescription: string | null;
  images: PublicImage[];
  variants: PublicVariant[];
};

// Structural row types (a superset of what the Prisma select returns).
type Row<T> = T;
export type UsedDeviceRow = Row<PublicUsedDevice & Record<string, unknown>>;
export type VariantRow = {
  id: string; sku: string; storage: string | null; color: string | null; colorHex: string | null; condition: string;
  simType: string | null; connectivity: string | null; price: number; compareAtPrice: number | null; warrantyMonths: number;
  isActive: boolean;
  inventory: { stock: number; reservedStock: number } | null;
  usedDevice: (UsedDeviceRow & { status?: string }) | null;
} & Record<string, unknown>;
export type ImageRow = { id: string; url: string; alt: string; variantId: string | null; isPrimary?: boolean } & Record<string, unknown>;
export type ProductRow = {
  id: string; slug: string; title: string; model: string; brand: string; shortDescription: string; description?: string;
  price: number; compareAtPrice: number | null; isNew: boolean; hasUsed: boolean; ratingSum: number; ratingCount: number;
  images: ImageRow[]; variants: VariantRow[];
  category?: { slug: string; name: string };
  specifications?: unknown; faq?: unknown; seoTitle?: string | null; seoDescription?: string | null;
} & Record<string, unknown>;

const MAX_PUBLIC_AVAILABLE = 5;

export function toPublicImage(i: ImageRow): PublicImage {
  return { id: i.id, url: i.url, alt: i.alt, variantId: i.variantId };
}

export function toPublicUsedDevice(u: UsedDeviceRow): PublicUsedDevice {
  return {
    batteryHealth: u.batteryHealth, cycleCount: u.cycleCount, deviceGrade: u.deviceGrade, physicalCondition: u.physicalCondition,
    screenCondition: u.screenCondition, cameraCondition: u.cameraCondition, faceIdStatus: u.faceIdStatus, touchIdStatus: u.touchIdStatus,
    trueToneStatus: u.trueToneStatus, speakerStatus: u.speakerStatus, microphoneStatus: u.microphoneStatus,
    chargingPortStatus: u.chargingPortStatus, wifiStatus: u.wifiStatus, bluetoothStatus: u.bluetoothStatus, simStatus: u.simStatus,
    accessoriesIncluded: [...u.accessoriesIncluded], warrantyMonths: u.warrantyMonths, defects: u.defects, inspectionNotes: u.inspectionNotes,
  };
}

export function toPublicVariant(v: VariantRow): PublicVariant {
  const avail = v.inventory ? availableStock(v.inventory) : 0;
  return {
    id: v.id, sku: v.sku, storage: v.storage, color: v.color, colorHex: v.colorHex, condition: v.condition, simType: v.simType,
    connectivity: v.connectivity, price: v.price, compareAtPrice: v.compareAtPrice,
    warrantyMonths: v.usedDevice?.warrantyMonths ?? v.warrantyMonths,
    available: Math.min(avail, MAX_PUBLIC_AVAILABLE),
    usedDevice: v.usedDevice ? toPublicUsedDevice(v.usedDevice) : null,
  };
}

export function toPublicCard(p: ProductRow): PublicProductCard {
  const active = p.variants.filter((v) => v.isActive);
  const sellable = active.filter((v) => v.inventory && availableStock(v.inventory) > 0);
  const primary = p.images.find((i) => i.isPrimary && !i.variantId) ?? p.images.find((i) => !i.variantId) ?? p.images[0] ?? null;
  const batteries = sellable.map((v) => v.usedDevice?.batteryHealth).filter((b): b is number => typeof b === "number");
  const pool = sellable.length ? sellable : active;
  return {
    id: p.id, slug: p.slug, title: p.title, model: p.model, brand: p.brand, shortDescription: p.shortDescription,
    price: pool.length ? Math.min(...pool.map((v) => v.price)) : p.price,
    compareAtPrice: p.compareAtPrice, isNew: p.isNew, hasUsed: p.hasUsed, inStock: sellable.length > 0,
    ratingAvg: p.ratingCount > 0 ? Math.round((p.ratingSum / p.ratingCount) * 10) / 10 : null, ratingCount: p.ratingCount,
    image: primary ? toPublicImage(primary) : null,
    conditions: [...new Set(pool.map((v) => v.condition))],
    bestBatteryHealth: batteries.length ? Math.max(...batteries) : null,
  };
}

export function toPublicProduct(p: ProductRow): PublicProduct {
  const dto: PublicProduct = {
    ...toPublicCard(p),
    description: p.description ?? "",
    categorySlug: p.category?.slug ?? "",
    categoryName: p.category?.name ?? "",
    specifications: Array.isArray(p.specifications) ? (p.specifications as PublicProduct["specifications"]) : [],
    faq: Array.isArray(p.faq) ? (p.faq as PublicProduct["faq"]) : [],
    seoTitle: p.seoTitle ?? null,
    seoDescription: p.seoDescription ?? null,
    images: p.images.map(toPublicImage),
    variants: p.variants.filter((v) => v.isActive).map(toPublicVariant),
  };
  assertNoSecrets(dto);
  return dto;
}
