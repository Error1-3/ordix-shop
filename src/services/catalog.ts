import "server-only";
import type { Condition, Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import type { CatalogQuery } from "@/lib/validators";
import { toPublicCard, toPublicProduct, type ProductRow, type PublicProductCard } from "@/lib/public-dto";

export const CATALOG_TAG = "catalog";
export const PAGE_SIZE = 24;
export const revalidateCatalog = () => revalidateTag(CATALOG_TAG);

/** A used device is public only after testing is finished: READY (sellable), RESERVED/SOLD (shown as unavailable). DRAFT / IN_TESTING / RETURNED stay hidden. */
const VISIBLE_VARIANT = {
  isActive: true,
  OR: [{ usedDevice: { is: null } }, { usedDevice: { is: { status: { in: ["READY", "RESERVED", "SOLD"] } } } }],
} satisfies Prisma.ProductVariantWhereInput;

/** EXPLICIT selects only. UsedDeviceSecret / costPrice are never selected here, so they cannot reach the client. */
const USED_SELECT = {
  batteryHealth: true, cycleCount: true, deviceGrade: true, physicalCondition: true, screenCondition: true, cameraCondition: true,
  faceIdStatus: true, touchIdStatus: true, trueToneStatus: true, speakerStatus: true, microphoneStatus: true, chargingPortStatus: true,
  wifiStatus: true, bluetoothStatus: true, simStatus: true, accessoriesIncluded: true, warrantyMonths: true, defects: true,
  inspectionNotes: true, status: true,
} satisfies Prisma.UsedDeviceSelect;

const VARIANT_SELECT = {
  id: true, sku: true, storage: true, color: true, colorHex: true, condition: true, simType: true, connectivity: true,
  price: true, compareAtPrice: true, warrantyMonths: true, isActive: true,
  inventory: { select: { stock: true, reservedStock: true } },
  usedDevice: { select: USED_SELECT },
} satisfies Prisma.ProductVariantSelect;

const IMAGE_SELECT = { id: true, url: true, alt: true, variantId: true, isPrimary: true } satisfies Prisma.ProductImageSelect;

const CARD_SELECT = {
  id: true, slug: true, title: true, model: true, brand: true, shortDescription: true, price: true, compareAtPrice: true,
  isNew: true, hasUsed: true, ratingSum: true, ratingCount: true,
  images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }], take: 3, select: IMAGE_SELECT },
  variants: { where: VISIBLE_VARIANT, select: VARIANT_SELECT },
} satisfies Prisma.ProductSelect;

const DETAIL_SELECT = {
  ...CARD_SELECT,
  description: true, specifications: true, faq: true, seoTitle: true, seoDescription: true,
  images: { orderBy: [{ position: "asc" }], select: IMAGE_SELECT },
  category: { select: { slug: true, name: true } },
} satisfies Prisma.ProductSelect;

const LIVE = { isActive: true, deletedAt: null } satisfies Prisma.ProductWhereInput;


const csv = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12) : []);

async function categoryIdsFor(slug: string): Promise<string[]> {
  const cat = await db.category.findUnique({ where: { slug }, select: { id: true, children: { select: { id: true } } } });
  return cat ? [cat.id, ...cat.children.map((c) => c.id)] : [];
}

export async function buildWhere(q: CatalogQuery): Promise<Prisma.ProductWhereInput> {
  const and: Prisma.ProductWhereInput[] = [LIVE];

  if (q.category) {
    const ids = await categoryIdsFor(q.category);
    and.push({ categoryId: { in: ids.length ? ids : ["__none__"] } });
  }
  if (q.q) {
    for (const token of q.q.split(/\s+/).filter(Boolean).slice(0, 6)) {
      and.push({
        OR: [
          { title: { contains: token, mode: "insensitive" } },
          { model: { contains: token, mode: "insensitive" } },
          { brand: { contains: token, mode: "insensitive" } },
          { shortDescription: { contains: token, mode: "insensitive" } },
        ],
      });
    }
  }
  if (q.model) and.push({ model: { equals: q.model, mode: "insensitive" } });
  if (q.brand) and.push({ brand: { equals: q.brand, mode: "insensitive" } });

  const v: Prisma.ProductVariantWhereInput[] = [VISIBLE_VARIANT];
  const conditions = csv(q.condition) as Condition[];
  if (conditions.length) v.push({ condition: { in: conditions } });
  const storage = csv(q.storage);
  if (storage.length) v.push({ storage: { in: storage } });
  const color = csv(q.color);
  if (color.length) v.push({ color: { in: color } });
  if (q.minPrice != null) v.push({ price: { gte: q.minPrice * 100 } });
  if (q.maxPrice != null) v.push({ price: { lte: q.maxPrice * 100 } });
  if (q.minBattery != null) v.push({ usedDevice: { is: { batteryHealth: { gte: q.minBattery } } } });
  if (q.minWarranty != null) {
    v.push({ OR: [{ warrantyMonths: { gte: q.minWarranty }, condition: "NEW" }, { usedDevice: { is: { warrantyMonths: { gte: q.minWarranty } } } }] });
  }
  if (q.inStock === "1") v.push({ inventory: { is: { stock: { gt: 0 } } } });
  and.push({ variants: { some: { AND: v } } });

  return { AND: and };
}

function orderBy(sort: CatalogQuery["sort"]): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "newest": return [{ createdAt: "desc" }];
    case "price_asc": return [{ price: "asc" }, { id: "asc" }];
    case "price_desc": return [{ price: "desc" }, { id: "asc" }];
    case "popular": return [{ salesCount: "desc" }, { createdAt: "desc" }];
    default: return [{ isFeatured: "desc" }, { salesCount: "desc" }, { createdAt: "desc" }];
  }
}

export type CatalogPage = { items: PublicProductCard[]; total: number; page: number; pages: number };

export async function searchProducts(q: CatalogQuery): Promise<CatalogPage> {
  const where = await buildWhere(q);
  const [total, rows] = await db.$transaction([
    db.product.count({ where }),
    db.product.findMany({ where, orderBy: orderBy(q.sort), skip: (q.page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: CARD_SELECT }),
  ]);
  return { items: rows.map((r) => toPublicCard(r as unknown as ProductRow)), total, page: q.page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getProductBySlug(slug: string) {
  const row = await db.product.findFirst({ where: { slug, ...LIVE }, select: DETAIL_SELECT });
  return row ? toPublicProduct(row as unknown as ProductRow) : null;
}

export async function getRelated(productId: string, categorySlug: string, model: string, limit = 4) {
  const ids = await categoryIdsFor(categorySlug);
  const rows = await db.product.findMany({
    where: { ...LIVE, id: { not: productId }, categoryId: { in: ids } },
    orderBy: [{ salesCount: "desc" }],
    take: limit * 3,
    select: CARD_SELECT,
  });
  // Prefer same model family, then popular.
  const cards = rows.map((r) => toPublicCard(r as unknown as ProductRow));
  return [...cards.filter((c) => c.model === model), ...cards.filter((c) => c.model !== model)].slice(0, limit);
}

export async function suggest(query: string) {
  const tokens = query.split(/\s+/).filter(Boolean).slice(0, 5);
  if (!tokens.length) return { products: [] as PublicProductCard[], models: [] as string[] };
  const where: Prisma.ProductWhereInput = {
    ...LIVE,
    AND: tokens.map((t) => ({ OR: [{ title: { contains: t, mode: "insensitive" as const } }, { model: { contains: t, mode: "insensitive" as const } }] })),
  };
  const [rows, models] = await Promise.all([
    db.product.findMany({ where, orderBy: [{ salesCount: "desc" }], take: 6, select: CARD_SELECT }),
    db.product.findMany({ where, distinct: ["model"], select: { model: true }, take: 5 }),
  ]);
  return { products: rows.map((r) => toPublicCard(r as unknown as ProductRow)), models: models.map((m) => m.model) };
}

export const getFacets = unstable_cache(
  async (categorySlug?: string) => {
    const categoryIds = categorySlug ? await categoryIdsFor(categorySlug) : null;
    const productWhere: Prisma.ProductWhereInput = { ...LIVE, ...(categoryIds ? { categoryId: { in: categoryIds } } : {}) };
    const variantWhere: Prisma.ProductVariantWhereInput = { ...VISIBLE_VARIANT, product: productWhere };
    const [models, storages, colors, conditions, price] = await Promise.all([
      db.product.findMany({ where: productWhere, distinct: ["model"], select: { model: true }, orderBy: { model: "asc" } }),
      db.productVariant.findMany({ where: { ...variantWhere, storage: { not: null } }, distinct: ["storage"], select: { storage: true } }),
      db.productVariant.findMany({ where: { ...variantWhere, color: { not: null } }, distinct: ["color"], select: { color: true } }),
      db.productVariant.findMany({ where: variantWhere, distinct: ["condition"], select: { condition: true } }),
      db.productVariant.aggregate({ where: variantWhere, _min: { price: true }, _max: { price: true } }),
    ]);
    const num = (s: string) => parseInt(s, 10) * (/TB/i.test(s) ? 1024 : 1);
    return {
      models: models.map((m) => m.model),
      storages: storages.map((s) => s.storage as string).sort((a, b) => num(a) - num(b)),
      colors: colors.map((c) => c.color as string).sort(),
      conditions: conditions.map((c) => c.condition),
      minPrice: Math.floor((price._min.price ?? 0) / 100),
      maxPrice: Math.ceil((price._max.price ?? 0) / 100),
    };
  },
  ["facets-v1"],
  { tags: [CATALOG_TAG], revalidate: 600 },
);

async function cards(where: Prisma.ProductWhereInput, order: Prisma.ProductOrderByWithRelationInput[], take = 8) {
  const rows = await db.product.findMany({ where: { AND: [LIVE, where] }, orderBy: order, take, select: CARD_SELECT });
  return rows.map((r) => toPublicCard(r as unknown as ProductRow));
}

export const getHomeSections = unstable_cache(
  async () => {
    const iphone = await categoryIdsFor("iphone");
    const cat = (slug: string) => categoryIdsFor(slug).then((ids) => ({ categoryId: { in: ids.length ? ids : ["__none__"] } }));
    const [popularIphone, newIphone, usedIphone, refurbished, macbook, ipad, watch, airpods, accessories] = await Promise.all([
      cards({ categoryId: { in: iphone }, isFeatured: true }, [{ salesCount: "desc" }]),
      cards({ categoryId: { in: iphone }, isNew: true, variants: { some: { condition: "NEW", isActive: true } } }, [{ createdAt: "desc" }]),
      cards({ categoryId: { in: iphone }, variants: { some: { condition: { in: ["GOOD", "FAIR", "EXCELLENT"] }, isActive: true, usedDevice: { is: { status: "READY" } }, inventory: { is: { stock: { gt: 0 } } } } } }, [{ createdAt: "desc" }]),
      cards({ categoryId: { in: iphone }, variants: { some: { condition: "LIKE_NEW", isActive: true, usedDevice: { is: { status: "READY" } }, inventory: { is: { stock: { gt: 0 } } } } } }, [{ createdAt: "desc" }]),
      cat("macbook").then((w) => cards(w, [{ salesCount: "desc" }], 4)),
      cat("ipad").then((w) => cards(w, [{ salesCount: "desc" }], 4)),
      cat("apple-watch").then((w) => cards(w, [{ salesCount: "desc" }], 4)),
      cat("airpods").then((w) => cards(w, [{ salesCount: "desc" }], 4)),
      cat("accessories").then((w) => cards(w, [{ salesCount: "desc" }], 4)),
    ]);
    return { popularIphone, newIphone, usedIphone, refurbished, macbook, ipad, watch, airpods, accessories };
  },
  ["home-sections-v1"],
  { tags: [CATALOG_TAG], revalidate: 300 },
);

export const getCategories = unstable_cache(
  async () =>
    db.category.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, nameEn: true, parentId: true, description: true, seoTitle: true, seoDescription: true },
    }),
  ["categories-v1"],
  { tags: [CATALOG_TAG], revalidate: 600 },
);

export async function getApprovedReviews(productId: string, take = 20) {
  const rows = await db.review.findMany({
    where: { productId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, rating: true, title: true, body: true, createdAt: true, isVerifiedPurchase: true, user: { select: { firstName: true } }, images: { select: { id: true, url: true, alt: true } } },
  });
  return rows.map((r) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, createdAt: r.createdAt, isVerifiedPurchase: r.isVerifiedPurchase, author: r.user.firstName ?? "Покупець", images: r.images }));
}

/** For sitemap. */
export async function getAllProductSlugs() {
  return db.product.findMany({ where: LIVE, select: { slug: true, updatedAt: true } });
}

export async function getLatestReviews(take = 6) {
  const rows = await db.review.findMany({
    where: { status: "APPROVED", rating: { gte: 4 } },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, rating: true, title: true, body: true, user: { select: { firstName: true } }, product: { select: { title: true, slug: true } } },
  });
  return rows.map((r) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, author: r.user.firstName ?? "Покупець", product: r.product }));
}

export async function getProductCardsByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.product.findMany({ where: { AND: [LIVE, { id: { in: ids } }] }, select: CARD_SELECT });
  return rows.map((r) => toPublicCard(r as unknown as ProductRow));
}
