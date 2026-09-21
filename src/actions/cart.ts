"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/authz";
import { getClientIp } from "@/lib/request";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { cartAddSchema, cartUpdateSchema, couponCodeSchema } from "@/lib/validators";
import { addToCart, cartCount, setCartCoupon, setCartQuantity, getCartView } from "@/services/cart";

type R = { ok: boolean; error?: string; count?: number };

async function guard(): Promise<{ userId: string | null } | null> {
  const ip = await getClientIp();
  const rl = await rateLimit(`cart:${ip}`, LIMITS.cart.limit, LIMITS.cart.windowSec);
  if (!rl.ok) return null;
  return { userId: (await getCurrentUser())?.id ?? null };
}

export async function addToCartAction(variantId: string, quantity = 1): Promise<R> {
  const g = await guard();
  if (!g) return { ok: false, error: "checkout.error.RATE_LIMIT" };
  const parsed = cartAddSchema.safeParse({ variantId, quantity });
  if (!parsed.success) return { ok: false, error: "cart.error.NOT_FOUND" };
  const res = await addToCart(g.userId, parsed.data.variantId, parsed.data.quantity);
  revalidatePath("/cart");
  return res.ok ? { ok: true, count: await cartCount(g.userId) } : { ok: false, error: `cart.error.${res.error}` };
}

export async function updateCartQuantityAction(variantId: string, quantity: number): Promise<R> {
  const g = await guard();
  if (!g) return { ok: false, error: "checkout.error.RATE_LIMIT" };
  const parsed = cartUpdateSchema.safeParse({ variantId, quantity });
  if (!parsed.success) return { ok: false, error: "cart.error.NOT_FOUND" };
  const res = await setCartQuantity(g.userId, parsed.data.variantId, parsed.data.quantity);
  revalidatePath("/cart");
  return res.ok ? { ok: true, count: await cartCount(g.userId) } : { ok: false, error: `cart.error.${res.error}` };
}

export async function applyCouponAction(code: string): Promise<R> {
  const rl = await rateLimit(`coupon:${await getClientIp()}`, LIMITS.coupon.limit, LIMITS.coupon.windowSec);
  if (!rl.ok) return { ok: false, error: "checkout.error.RATE_LIMIT" };
  const parsed = couponCodeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, error: "cart.couponError.UNKNOWN" };
  const userId = (await getCurrentUser())?.id ?? null;
  await setCartCoupon(userId, parsed.data);
  const view = await getCartView(userId);
  revalidatePath("/cart");
  if (view.couponError) {
    await setCartCoupon(userId, null); // do not keep an invalid code
    return { ok: false, error: `cart.couponError.${view.couponError}` };
  }
  return { ok: true };
}

export async function removeCouponAction(): Promise<R> {
  await setCartCoupon((await getCurrentUser())?.id ?? null, null);
  revalidatePath("/cart");
  return { ok: true };
}

export async function getCartCountAction(): Promise<number> {
  return cartCount((await getCurrentUser())?.id ?? null);
}
