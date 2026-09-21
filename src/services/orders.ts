import "server-only";
import { randomInt } from "node:crypto";
import { Prisma, type PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { env, siteUrl } from "@/lib/env";
import { runAfter } from "@/lib/after";
import { getSettings } from "@/lib/settings";
import { availableStock, computeOrderTotals, type PricedLine } from "@/lib/pricing";
import type { CheckoutInput } from "@/lib/validators";
import type { SessionUser } from "@/lib/authz";
import { findCart, resolveCoupon, variantLabel, VARIANT_FOR_CART } from "./cart";
import { OutOfStockError, productIdsOfVariants, reserveStock, syncProductStock } from "./inventory";
import { getPaymentProvider } from "./payments";
import { sendOrderEmail } from "./email";
import { revalidateCatalog } from "./catalog";
import type { PaymentRedirect } from "./payments/types";
import { signOrderAccess } from "@/lib/order-access";
import type { Locale } from "@/lib/i18n";

export type CreateOrderResult =
  | { ok: true; orderId: string; number: string; redirect: PaymentRedirect | null; nextUrl: string }
  | { ok: false; error: "EMPTY_CART" | "OUT_OF_STOCK" | "PAYMENT_METHOD_UNAVAILABLE" | "COD_LIMIT" | "COUPON_INVALID" | "UNAVAILABLE_ITEM" | "PAYMENT_INIT_FAILED"; variantId?: string };

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I/L
function makeOrderNumber(now = new Date()): string {
  const d = now.toISOString().slice(2, 10).replace(/-/g, "");
  let rnd = "";
  for (let i = 0; i < 5; i++) rnd += ALPHABET[randomInt(ALPHABET.length)];
  return `IDS-${d}-${rnd}`;
}

export async function createOrder(args: { user: SessionUser | null; input: CheckoutInput; locale: Locale; ip: string }): Promise<CreateOrderResult> {
  const { user, input, locale, ip } = args;
  const settings = await getSettings();

  // 1. Payment method must be enabled by the merchant AND technically available.
  const methodOk: Record<PaymentMethod, boolean> = {
    LIQPAY_CARD: settings.payments.liqpayEnabled && Boolean(env().LIQPAY_PUBLIC_KEY && env().LIQPAY_PRIVATE_KEY),
    NP_COD: settings.payments.codEnabled,
    PAY_ON_RECEIVE: settings.payments.payOnReceiveEnabled,
  };
  if (!methodOk[input.paymentMethod]) return { ok: false, error: "PAYMENT_METHOD_UNAVAILABLE" };

  const cart = await findCart(user?.id);
  if (!cart) return { ok: false, error: "EMPTY_CART" };

  let created: { orderId: string; number: string; onlineAmount: number; providerOrderId: string | null; expiresAt: Date | null } | null = null;

  for (let attempt = 0; attempt < 4 && !created; attempt++) {
    try {
      created = await db.$transaction(
        async (tx) => {
          // 2. Fresh server-side read of items, prices and availability. NOTHING from the browser is trusted for money.
          const items = await tx.cartItem.findMany({ where: { cartId: cart.id }, include: { variant: { select: VARIANT_FOR_CART } } });
          if (!items.length) throw new CheckoutError("EMPTY_CART");

          const priced: (PricedLine & { row: (typeof items)[number]["variant"] })[] = [];
          for (const it of items) {
            const v = it.variant;
            const live = v.isActive && v.product.isActive && !v.product.deletedAt && (!v.usedDevice || v.usedDevice.status === "READY");
            if (!live) throw new CheckoutError("UNAVAILABLE_ITEM", v.id);
            const cap = v.condition === "NEW" ? settings.orders.maxQuantityPerItem : 1;
            const qty = Math.min(it.quantity, cap);
            if (!v.inventory || availableStock(v.inventory) < qty) throw new CheckoutError("OUT_OF_STOCK", v.id);
            priced.push({ variantId: v.id, productId: v.product.id, categoryId: v.product.categoryId, unitPrice: v.price, quantity: qty, row: v });
          }

          // 3. Coupon (re-validated now; usage counter incremented atomically).
          let discount = 0;
          let couponId: string | null = null;
          if (cart.couponCode) {
            const r = await resolveCoupon(cart.couponCode, priced, user?.id ?? null, input.email);
            if (!r.ok || !r.coupon) throw new CheckoutError("COUPON_INVALID");
            discount = r.discount;
            couponId = r.coupon.id;
            const n = await tx.$executeRaw`
              UPDATE "Coupon" SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
              WHERE id = ${couponId} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
            if (n !== 1) throw new CheckoutError("COUPON_INVALID");
          }

          // 4. Totals — computed by the same pure function the cart preview uses.
          const totals = computeOrderTotals({
            lines: priced, discount, method: input.paymentMethod,
            delivery: { flatFee: settings.shipping.flatFee, freeShippingThreshold: settings.shipping.freeShippingThreshold },
            cod: { prepaymentAmount: settings.payments.codPrepaymentAmount, commissionPercent: settings.payments.codCommissionPercent, commissionFixed: settings.payments.codCommissionFixed },
          });
          if (input.paymentMethod === "NP_COD" && settings.payments.codMaxTotal > 0 && totals.total > settings.payments.codMaxTotal) throw new CheckoutError("COD_LIMIT");

          // 5. Reserve stock atomically (throws OutOfStockError if someone else got the last unit).
          await reserveStock(tx, priced.map((p) => ({ variantId: p.variantId, quantity: p.quantity })));

          const online = totals.onlineAmount > 0;
          const now = new Date();
          const expiresAt = online ? new Date(now.getTime() + settings.orders.reservationMinutes * 60_000) : null;
          const number = makeOrderNumber(now);

          const order = await tx.order.create({
            data: {
              number, userId: user?.id ?? null, email: input.email, phone: input.phone, firstName: input.firstName, lastName: input.lastName,
              status: online ? "PAYMENT_PENDING" : "PENDING",
              paymentMethod: input.paymentMethod,
              paymentStatus: input.paymentMethod === "LIQPAY_CARD" ? "PENDING" : online ? "PENDING" : "COD_PENDING",
              deliveryMethod: input.deliveryMethod,
              subtotal: totals.subtotal, discountTotal: totals.discountTotal, deliveryCost: totals.deliveryCost, commission: totals.commission,
              total: totals.total, codAmount: totals.codAmount, prepaymentAmount: totals.prepaymentAmount,
              couponId, couponCode: cart.couponCode, comment: input.comment ?? null,
              city: input.city, cityRef: input.cityRef, warehouseRef: input.warehouseRef, warehouseName: input.warehouseName, address: input.address,
              locale, ipAddress: ip, reservationExpiresAt: expiresAt,
              items: {
                create: priced.map((p) => ({
                  productId: p.productId, variantId: p.variantId, title: p.row.product.title, variantLabel: variantLabel(p.row, locale), sku: p.row.sku,
                  condition: p.row.condition, image: p.row.images[0]?.url ?? p.row.product.images[0]?.url ?? null,
                  unitPrice: p.unitPrice, quantity: p.quantity, lineTotal: p.unitPrice * p.quantity,
                  warrantyMonths: p.row.usedDevice?.warrantyMonths ?? p.row.warrantyMonths,
                })),
              },
              events: { create: { type: "created", message: "Замовлення створено" } },
            },
          });

          let providerOrderId: string | null = null;
          if (online) {
            providerOrderId = `${number}-1`;
            await tx.payment.create({
              data: { orderId: order.id, provider: "LIQPAY", providerOrderId, amount: totals.onlineAmount, currency: "UAH", status: "PENDING" },
            });
          }
          if (couponId) await tx.couponUsage.create({ data: { couponId, userId: user?.id ?? null, email: input.email, orderId: order.id, amount: totals.discountTotal } });

          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
          await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
          await syncProductStock(tx, await productIdsOfVariants(tx, priced.map((p) => p.variantId)));

          return { orderId: order.id, number, onlineAmount: totals.onlineAmount, providerOrderId, expiresAt };
        },
        { timeout: 20_000, maxWait: 10_000 },
      );
    } catch (e) {
      if (e instanceof CheckoutError) return { ok: false, error: e.code, variantId: e.variantId };
      if (e instanceof OutOfStockError) return { ok: false, error: "OUT_OF_STOCK", variantId: e.variantId };
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // order number collision -> retry
      throw e;
    }
  }
  if (!created) throw new Error("Could not allocate a unique order number");

  revalidateCatalog();

  // 6. Online payment: build the signed request server-side. Only data+signature go to the browser.
  let redirect: PaymentRedirect | null = null;
  if (created.providerOrderId) {
    try {
      const base = siteUrl();
      const e = env();
      redirect = getPaymentProvider("LIQPAY").createPayment({
        providerOrderId: created.providerOrderId, amount: created.onlineAmount, currency: "UAH",
        description: `Замовлення ${created.number}`, language: locale,
        resultUrl: `${e.LIQPAY_RESULT_URL || `${base}/checkout/result`}?order=${encodeURIComponent(created.number)}&t=${encodeURIComponent(signOrderAccess(created.number))}`,
        callbackUrl: e.LIQPAY_CALLBACK_URL || `${base}/api/payments/liqpay/callback`,
        expiresAt: created.expiresAt ?? undefined,
      });
    } catch (err) {
      console.error("[checkout] could not build payment request", err);
      return { ok: false, error: "PAYMENT_INIT_FAILED" };
    }
  }

  runAfter(async () => {
    await sendOrderEmail(created!.orderId, "order_created");
    if (settings.orders.notifyAdminEmail) await sendOrderEmail(created!.orderId, "admin_new_order");
  }, "order-created-emails");

  return {
    ok: true, orderId: created.orderId, number: created.number, redirect,
    nextUrl: `/checkout/result?order=${encodeURIComponent(created.number)}&t=${signOrderAccess(created.number)}`,
  };
}

class CheckoutError extends Error {
  constructor(public readonly code: Extract<CreateOrderResult, { ok: false }>["error"], public readonly variantId?: string) {
    super(code);
  }
}

/** New payment attempt for an unpaid order (after a failed/abandoned payment). New unique provider order id per attempt. */
export async function retryPayment(orderId: string, ownerCheck: (o: { userId: string | null; number: string }) => boolean, locale: Locale) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { payments: { orderBy: { createdAt: "desc" } } } });
  if (!order || !ownerCheck(order)) return null;
  if (order.status !== "PAYMENT_PENDING" || order.paymentStatus === "PAID") return null;
  if (order.reservationExpiresAt && order.reservationExpiresAt < new Date()) return null;
  const last = order.payments[0];
  if (!last || last.status === "PAID" || last.status === "PROCESSING") return null;
  const attemptNo = order.payments.length + 1;
  const providerOrderId = `${order.number}-${attemptNo}`;
  await db.payment.create({ data: { orderId: order.id, provider: "LIQPAY", providerOrderId, amount: last.amount, currency: "UAH", status: "PENDING" } });
  const base = siteUrl();
  const e = env();
  return getPaymentProvider("LIQPAY").createPayment({
    providerOrderId, amount: last.amount, currency: "UAH", description: `Замовлення ${order.number}`, language: locale,
    resultUrl: `${e.LIQPAY_RESULT_URL || `${base}/checkout/result`}?order=${encodeURIComponent(order.number)}&t=${encodeURIComponent(signOrderAccess(order.number))}`,
    callbackUrl: e.LIQPAY_CALLBACK_URL || `${base}/api/payments/liqpay/callback`,
    expiresAt: order.reservationExpiresAt ?? undefined,
  });
}
