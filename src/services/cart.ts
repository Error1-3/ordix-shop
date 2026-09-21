import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Condition } from "@prisma/client";
import { db } from "@/lib/db";
import { isProd } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { availableStock, computeOrderTotals, evaluateCoupon, type CouponRejection, type PricedLine } from "@/lib/pricing";
import { createT, type Locale } from "@/lib/i18n";

const CART_COOKIE = "cart_token";
const CART_TTL_S = 60 * 60 * 24 * 60;

export type CartLineView = {
  variantId: string; productId: string; categoryId: string; slug: string; title: string; variantLabel: string; condition: Condition;
  image: string | null; unitPrice: number; compareAt: number | null; quantity: number; available: number; warrantyMonths: number;
  problem: "OUT_OF_STOCK" | "QUANTITY_ADJUSTED" | "UNAVAILABLE" | null;
};

export type CartView = {
  cartId: string | null;
  lines: CartLineView[];
  itemCount: number;
  subtotal: number; discount: number; deliveryCost: number; total: number;
  couponCode: string | null;
  couponError: CouponRejection | "UNKNOWN" | null;
  hasProblems: boolean;
};

export const EMPTY_CART: CartView = {
  cartId: null, lines: [], itemCount: 0, subtotal: 0, discount: 0, deliveryCost: 0, total: 0, couponCode: null, couponError: null, hasProblems: false,
};

// ───────── cart identity ─────────

async function readToken(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE)?.value ?? null;
}

async function setToken(token: string) {
  (await cookies()).set(CART_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: isProd(), path: "/", maxAge: CART_TTL_S });
}

export async function findCart(userId?: string | null) {
  if (userId) {
    const c = await db.cart.findUnique({ where: { userId } });
    if (c) return c;
  }
  const token = await readToken();
  return token ? db.cart.findUnique({ where: { token } }) : null;
}

export async function getOrCreateCart(userId?: string | null) {
  const existing = await findCart(userId);
  if (existing) return existing;
  if (userId) return db.cart.create({ data: { userId } });
  const token = randomBytes(24).toString("base64url");
  const cart = await db.cart.create({ data: { token } });
  await setToken(token);
  return cart;
}

/** Called right after login: guest items move into the customer's persistent cart. */
export async function mergeGuestCart(userId: string): Promise<void> {
  const token = await readToken();
  if (!token) return;
  const guest = await db.cart.findUnique({ where: { token }, include: { items: true } });
  if (!guest || guest.userId) return;
  const mine = await db.cart.upsert({ where: { userId }, create: { userId }, update: {} });
  await db.$transaction(async (tx) => {
    for (const it of guest.items) {
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: mine.id, variantId: it.variantId } },
        create: { cartId: mine.id, variantId: it.variantId, quantity: it.quantity },
        update: { quantity: { increment: it.quantity } },
      });
    }
    if (guest.couponCode && !mine.couponCode) await tx.cart.update({ where: { id: mine.id }, data: { couponCode: guest.couponCode } });
    await tx.cart.delete({ where: { id: guest.id } });
  });
  (await cookies()).delete(CART_COOKIE);
}

// ───────── pricing (server truth) ─────────

export const VARIANT_FOR_CART = {
  id: true, sku: true, storage: true, color: true, condition: true, price: true, compareAtPrice: true, warrantyMonths: true, isActive: true, weightGrams: true,
  inventory: { select: { stock: true, reservedStock: true } },
  usedDevice: { select: { warrantyMonths: true, status: true } },
  images: { orderBy: { position: "asc" as const }, take: 1, select: { url: true } },
  product: {
    select: {
      id: true, slug: true, title: true, categoryId: true, isActive: true, deletedAt: true,
      images: { where: { variantId: null }, orderBy: [{ isPrimary: "desc" as const }, { position: "asc" as const }], take: 1, select: { url: true } },
    },
  },
} as const;

export function variantLabel(v: { storage: string | null; color: string | null; condition: Condition }, locale: Locale = "uk"): string {
  const t = createT(locale);
  return [v.storage, v.color, v.condition === "NEW" ? null : t(`condition.${v.condition}`)].filter(Boolean).join(" · ");
}

export async function getCartView(userId?: string | null, locale: Locale = "uk"): Promise<CartView> {
  const cart = await findCart(userId);
  if (!cart) return EMPTY_CART;
  const items = await db.cartItem.findMany({ where: { cartId: cart.id }, orderBy: { createdAt: "asc" }, include: { variant: { select: VARIANT_FOR_CART } } });
  const settings = await getSettings();
  const maxQty = settings.orders.maxQuantityPerItem;

  const lines: CartLineView[] = items.map((it) => {
    const v = it.variant;
    const sellable = v.isActive && v.product.isActive && !v.product.deletedAt && (!v.usedDevice || v.usedDevice.status === "READY");
    const available = sellable && v.inventory ? availableStock(v.inventory) : 0;
    const cap = Math.min(available, v.condition === "NEW" ? maxQty : 1);
    const quantity = Math.max(0, Math.min(it.quantity, cap));
    return {
      variantId: v.id, productId: v.product.id, categoryId: v.product.categoryId, slug: v.product.slug, title: v.product.title,
      variantLabel: variantLabel(v, locale), condition: v.condition,
      image: v.images[0]?.url ?? v.product.images[0]?.url ?? null,
      unitPrice: v.price, compareAt: v.compareAtPrice, quantity: quantity || it.quantity, available,
      warrantyMonths: v.usedDevice?.warrantyMonths ?? v.warrantyMonths,
      problem: !sellable ? "UNAVAILABLE" : available === 0 ? "OUT_OF_STOCK" : quantity < it.quantity ? "QUANTITY_ADJUSTED" : null,
    };
  });

  const billable = lines.filter((l) => !l.problem || l.problem === "QUANTITY_ADJUSTED");
  const priced: PricedLine[] = billable.map((l) => ({ variantId: l.variantId, productId: l.productId, categoryId: l.categoryId, unitPrice: l.unitPrice, quantity: Math.min(l.quantity, l.available) }));

  let discount = 0;
  let couponError: CartView["couponError"] = null;
  if (cart.couponCode && priced.length) {
    const r = await resolveCoupon(cart.couponCode, priced, userId ?? null, null);
    if (r.ok) discount = r.discount;
    else couponError = r.reason;
  }
  const totals = computeOrderTotals({
    lines: priced, discount, method: "LIQPAY_CARD",
    delivery: { flatFee: settings.shipping.flatFee, freeShippingThreshold: settings.shipping.freeShippingThreshold },
    cod: { prepaymentAmount: 0, commissionPercent: 0, commissionFixed: 0 },
  });

  return {
    cartId: cart.id, lines, itemCount: lines.reduce((s, l) => s + (l.problem === "OUT_OF_STOCK" || l.problem === "UNAVAILABLE" ? 0 : l.quantity), 0),
    subtotal: totals.subtotal, discount: totals.discountTotal, deliveryCost: totals.deliveryCost, total: totals.total,
    couponCode: cart.couponCode, couponError, hasProblems: lines.some((l) => l.problem === "OUT_OF_STOCK" || l.problem === "UNAVAILABLE"),
  };
}

export async function resolveCoupon(code: string, lines: PricedLine[], userId: string | null, email: string | null) {
  const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon) return { ok: false as const, reason: "UNKNOWN" as const, coupon: null };
  let customerUsageCount = 0;
  if (coupon.perCustomerLimit != null && (userId || email)) {
    customerUsageCount = await db.couponUsage.count({ where: { couponId: coupon.id, OR: [...(userId ? [{ userId }] : []), ...(email ? [{ email }] : [])] } });
  }
  const r = evaluateCoupon(coupon, lines, { customerUsageCount });
  return r.ok ? { ...r, coupon } : { ...r, coupon };
}

// ───────── mutations (all validated against live stock) ─────────

export type CartResult = { ok: true } | { ok: false; error: "NOT_FOUND" | "OUT_OF_STOCK" | "LIMIT" | "USED_SINGLE" };

export async function addToCart(userId: string | null, variantId: string, quantity: number): Promise<CartResult> {
  const v = await db.productVariant.findUnique({ where: { id: variantId }, select: VARIANT_FOR_CART });
  if (!v || !v.isActive || !v.product.isActive || v.product.deletedAt || (v.usedDevice && v.usedDevice.status !== "READY")) return { ok: false, error: "NOT_FOUND" };
  const settings = await getSettings();
  const avail = v.inventory ? availableStock(v.inventory) : 0;
  if (avail < 1) return { ok: false, error: "OUT_OF_STOCK" };

  const cart = await getOrCreateCart(userId);
  const existing = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId } } });
  const cap = Math.min(avail, v.condition === "NEW" ? settings.orders.maxQuantityPerItem : 1);
  const wanted = (existing?.quantity ?? 0) + quantity;
  const finalQty = Math.min(wanted, cap);
  if (existing && existing.quantity >= cap) return { ok: false, error: v.condition === "NEW" ? "LIMIT" : "USED_SINGLE" };
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    create: { cartId: cart.id, variantId, quantity: finalQty },
    update: { quantity: finalQty },
  });
  return { ok: true };
}

export async function setCartQuantity(userId: string | null, variantId: string, quantity: number): Promise<CartResult> {
  const cart = await findCart(userId);
  if (!cart) return { ok: false, error: "NOT_FOUND" };
  if (quantity <= 0) {
    await db.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
    return { ok: true };
  }
  const v = await db.productVariant.findUnique({ where: { id: variantId }, select: VARIANT_FOR_CART });
  if (!v) return { ok: false, error: "NOT_FOUND" };
  const settings = await getSettings();
  const avail = v.inventory ? availableStock(v.inventory) : 0;
  const cap = Math.min(avail, v.condition === "NEW" ? settings.orders.maxQuantityPerItem : 1);
  if (cap < 1) return { ok: false, error: "OUT_OF_STOCK" };
  await db.cartItem.updateMany({ where: { cartId: cart.id, variantId }, data: { quantity: Math.min(quantity, cap) } });
  return { ok: true };
}

export async function setCartCoupon(userId: string | null, code: string | null) {
  const cart = await getOrCreateCart(userId);
  await db.cart.update({ where: { id: cart.id }, data: { couponCode: code } });
}

export async function clearCart(cartId: string) {
  await db.$transaction([db.cartItem.deleteMany({ where: { cartId } }), db.cart.update({ where: { id: cartId }, data: { couponCode: null } })]);
}

export async function cartCount(userId?: string | null): Promise<number> {
  const cart = await findCart(userId);
  if (!cart) return 0;
  const agg = await db.cartItem.aggregate({ where: { cartId: cart.id }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}
