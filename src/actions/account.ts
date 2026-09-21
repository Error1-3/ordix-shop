"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { addressSchema, fieldErrors, newsletterSchema, profileSchema, reviewSchema } from "@/lib/validators";
import type { ActionState } from "@/lib/action-state";
import { getClientIp } from "@/lib/request";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { changeOrderStatus, OrderActionError } from "@/services/order-lifecycle";
import { issueToken } from "@/lib/tokens";
import { env, siteUrl } from "@/lib/env";
import { emailProvider } from "@/services/email/provider";

export async function updateProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/account/profile");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  await db.user.update({
    where: { id: user.id },
    data: { firstName: parsed.data.firstName, lastName: parsed.data.lastName, name: `${parsed.data.firstName} ${parsed.data.lastName}`, phone: parsed.data.phone ?? null },
  });
  revalidatePath("/account", "layout");
  return { ok: true, message: "common.saved" };
}

export async function saveAddressAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/account/addresses");
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  raw.isDefault = formData.get("isDefault") === "on";
  const parsed = addressSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const count = await db.address.count({ where: { userId: user.id } });
  if (count >= 10) return { error: "common.genericError" };
  await db.$transaction(async (tx) => {
    if (parsed.data.isDefault) await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    await tx.address.create({ data: { ...parsed.data, userId: user.id, isDefault: parsed.data.isDefault || count === 0 } });
  });
  revalidatePath("/account/addresses");
  return { ok: true, message: "common.saved" };
}

export async function deleteAddressAction(id: string) {
  const user = await requireUser("/account/addresses");
  await db.address.deleteMany({ where: { id, userId: user.id } }); // scoped by owner: no IDOR
  revalidatePath("/account/addresses");
}

export async function toggleWishlistAction(productId: string): Promise<{ ok: boolean; wished?: boolean; error?: string }> {
  const user = await requireUser("/account/wishlist").catch(() => null);
  if (!user) return { ok: false, error: "auth" };
  const wl = await db.wishlist.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
  const existing = await db.wishlistItem.findUnique({ where: { wishlistId_productId: { wishlistId: wl.id, productId } } });
  if (existing) {
    await db.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/account/wishlist");
    return { ok: true, wished: false };
  }
  const exists = await db.product.findFirst({ where: { id: productId, isActive: true, deletedAt: null }, select: { id: true } });
  if (!exists) return { ok: false, error: "cart.error.NOT_FOUND" };
  await db.wishlistItem.create({ data: { wishlistId: wl.id, productId } });
  revalidatePath("/account/wishlist");
  return { ok: true, wished: true };
}

export async function submitReviewAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const rl = await rateLimit(`review:${user.id}`, LIMITS.review.limit, LIMITS.review.windowSec);
  if (!rl.ok) return { error: "checkout.error.RATE_LIMIT" };
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  // Verified purchase: a DELIVERED order of this customer containing the product. Checked server-side.
  const purchased = await db.orderItem.findFirst({ where: { productId: parsed.data.productId, order: { userId: user.id, status: "DELIVERED" } }, select: { id: true } });
  if (!purchased) return { error: "reviews.onlyBuyers" };
  const already = await db.review.findUnique({ where: { productId_userId: { productId: parsed.data.productId, userId: user.id } }, select: { id: true } });
  if (already) return { error: "reviews.already" };

  await db.review.create({
    data: { productId: parsed.data.productId, userId: user.id, rating: parsed.data.rating, title: parsed.data.title, body: parsed.data.body, isVerifiedPurchase: true, status: "PENDING" },
  });
  return { ok: true, message: "reviews.moderation" };
}

export async function cancelOwnOrderAction(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser("/account/orders");
  const order = await db.order.findFirst({ where: { id: orderId, userId: user.id }, select: { status: true, paymentStatus: true } });
  if (!order) return { ok: false, error: "errors.notFoundTitle" };
  // Customers may cancel only before money moved / before staff started processing.
  if (!(order.status === "PENDING" || order.status === "PAYMENT_PENDING") || order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_PAID")
    return { ok: false, error: "errors.forbidden" };
  try {
    await changeOrderStatus(orderId, "CANCELLED", user, "Скасовано клієнтом");
  } catch (e) {
    if (e instanceof OrderActionError) return { ok: false, error: "common.genericError" };
    throw e;
  }
  revalidatePath("/account/orders");
  return { ok: true };
}

export async function subscribeNewsletterAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const rl = await rateLimit(`nl:${await getClientIp()}`, LIMITS.newsletter.limit, LIMITS.newsletter.windowSec);
  if (!rl.ok) return { error: "checkout.error.RATE_LIMIT" };
  const parsed = newsletterSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const existing = await db.newsletterSubscriber.findUnique({ where: { email: parsed.data.email } });
  if (existing?.confirmedAt && !existing.unsubscribedAt) return { ok: true, message: "newsletter.already" };
  await db.newsletterSubscriber.upsert({ where: { email: parsed.data.email }, create: { email: parsed.data.email, source: "footer" }, update: { unsubscribedAt: null } });
  try {
    const token = await issueToken(parsed.data.email, "NEWSLETTER_CONFIRM");
    const url = `${siteUrl()}/newsletter/confirm?token=${token}`;
    await emailProvider().send({
      to: parsed.data.email, subject: `Підтвердіть підписку — ${env().STORE_NAME}`,
      html: `<p>Підтвердіть підписку: <a href="${url}">${url}</a></p>`, text: `Підтвердіть підписку: ${url}`,
    });
  } catch (e) {
    console.error("[newsletter] confirm e-mail failed", e);
  }
  return { ok: true, message: "newsletter.thanks" };
}
