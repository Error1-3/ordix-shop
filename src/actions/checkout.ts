"use server";

import { getCurrentUser } from "@/lib/authz";
import { getLocale } from "@/lib/i18n";
import { getClientIp } from "@/lib/request";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { checkoutSchema, fieldErrors } from "@/lib/validators";
import { createOrder, retryPayment } from "@/services/orders";
import { db } from "@/lib/db";
import { verifyOrderAccess } from "@/lib/order-access";
import type { ActionState } from "@/lib/action-state";
import type { PaymentRedirect } from "@/services/payments/types";

export type CheckoutState = ActionState<{ redirect: PaymentRedirect | null; nextUrl: string; number: string }>;

export async function placeOrderAction(_: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const ip = await getClientIp();
  const rl = await rateLimit(`checkout:${ip}`, LIMITS.checkout.limit, LIMITS.checkout.windowSec);
  if (!rl.ok) return { error: "checkout.error.RATE_LIMIT" };

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  raw.acceptOffer = formData.get("acceptOffer") === "on" ? true : false;
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const user = await getCurrentUser();
  const res = await createOrder({ user, input: parsed.data, locale: await getLocale(), ip });
  if (!res.ok) return { error: `checkout.error.${res.error}` };
  return { ok: true, data: { redirect: res.redirect, nextUrl: res.nextUrl, number: res.number } };
}

/** New payment attempt. Allowed for the order's owner (session) or the holder of the HMAC guest link. */
export async function retryPaymentAction(orderId: string, guestToken?: string): Promise<{ ok: boolean; redirect?: PaymentRedirect; error?: string }> {
  const ip = await getClientIp();
  const rl = await rateLimit(`retry:${ip}`, 8, 600);
  if (!rl.ok) return { ok: false, error: "checkout.error.RATE_LIMIT" };
  const user = await getCurrentUser();
  const order = await db.order.findUnique({ where: { id: orderId }, select: { userId: true, number: true } });
  if (!order) return { ok: false, error: "errors.notFoundTitle" };
  const owner = (user && order.userId === user.id) || verifyOrderAccess(order.number, guestToken);
  if (!owner) return { ok: false, error: "errors.forbidden" };
  const redirect = await retryPayment(orderId, () => true, await getLocale());
  return redirect ? { ok: true, redirect } : { ok: false, error: "checkout.error.PAYMENT_INIT_FAILED" };
}
