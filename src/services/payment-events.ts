import "server-only";
import { Prisma, type OrderStatus, type PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { runAfter } from "@/lib/after";
import { canTransition, type OrderStatusName } from "@/lib/order-status";
import { confirmSale, OutOfStockError, productIdsOfVariants, releaseStock, reserveStock, syncProductStock, type StockItem } from "./inventory";
import { sendOrderEmail } from "./email";
import { revalidateCatalog } from "./catalog";
import type { ParsedPaymentEvent } from "./payments/types";

export type EventOutcome =
  | { result: "processed"; orderId: string; effect: string }
  | { result: "duplicate" }
  | { result: "ignored"; reason: string }
  | { result: "rejected"; reason: string };

const REVERSED_ORDER_STATES: OrderStatus[] = ["PAID", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED", "PENDING", "PAYMENT_PENDING", "RETURN_REQUESTED", "RETURNED"];

/**
 * THE ONLY place where an online payment can change an order's payment state.
 * Inputs are provider events whose signature has ALREADY been verified (callback) or that came from the provider's
 * own status API over TLS (reconciliation). The browser redirect never reaches this function.
 *
 * Guarantees:
 *  - idempotent: identical notifications (eventKey) are processed once;
 *  - serialised per payment (SELECT … FOR UPDATE) so concurrent callbacks cannot double-confirm stock;
 *  - monotonic: PAID never regresses to FAILED/PROCESSING (only REFUNDED);
 *  - amount, currency and merchant are verified before marking anything paid;
 *  - sandbox payments are not real money unless LIQPAY_ALLOW_SANDBOX=true.
 */
export async function applyPaymentEvent(event: ParsedPaymentEvent): Promise<EventOutcome> {
  const e = env();
  if (event.merchantId && e.LIQPAY_PUBLIC_KEY && event.merchantId !== e.LIQPAY_PUBLIC_KEY) {
    console.error("[payments] merchant mismatch", { got: event.merchantId });
    return { result: "rejected", reason: "merchant_mismatch" };
  }

  type Effects = { paid?: boolean; failed?: boolean; refunded?: boolean; needsAttention?: string };
  const effects: Effects = {};
  let orderId = "";
  let effectLabel = "recorded";

  try {
    const outcome = await db.$transaction(
      async (tx): Promise<EventOutcome> => {
        const payment = await tx.payment.findUnique({ where: { providerOrderId: event.providerOrderId } });
        if (!payment) return { result: "rejected", reason: "unknown_order" };
        orderId = payment.orderId;

        // Serialise all events for this payment.
        await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${payment.id} FOR UPDATE`;

        if (await tx.paymentTransaction.findUnique({ where: { eventKey: event.eventKey }, select: { id: true } })) return { result: "duplicate" };

        const p = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
        const order = await tx.order.findUniqueOrThrow({ where: { id: p.orderId }, include: { items: true } });
        const items: StockItem[] = order.items.filter((i) => i.variantId).map((i) => ({ variantId: i.variantId as string, quantity: i.quantity }));

        const record = (status: string) =>
          tx.paymentTransaction.create({
            data: { paymentId: p.id, provider: "LIQPAY", externalId: event.transactionId, eventKey: event.eventKey, status, amount: event.amount, rawResponse: event.raw as Prisma.InputJsonValue },
          });
        const log = (type: string, message: string, data?: Prisma.InputJsonValue) =>
          tx.orderEvent.create({ data: { orderId: order.id, type, message, data } });

        let state = event.state;
        if (state === "PAID_SANDBOX") {
          if (e.LIQPAY_ALLOW_SANDBOX) state = "PAID";
          else {
            await record(`${event.rawStatus}:sandbox_ignored`);
            await log("payment", "Отримано тестовий (sandbox) платіж — проігноровано");
            return { result: "ignored", reason: "sandbox_not_allowed" };
          }
        }

        switch (state) {
          case "PAID": {
            if (event.amount !== p.amount || event.currency !== p.currency) {
              await record(`${event.rawStatus}:amount_mismatch`);
              await log("payment_alert", `Сума/валюта платежу не збігається: очікували ${p.amount}/${p.currency}, отримали ${event.amount}/${event.currency}`);
              effects.needsAttention = "Сума платежу не збігається з очікуваною";
              return { result: "rejected", reason: "amount_mismatch" };
            }
            await record(event.rawStatus);
            if (p.status === "PAID") return { result: "processed", orderId: order.id, effect: "already_paid" };

            await tx.payment.update({
              where: { id: p.id },
              data: { status: "PAID", rawStatus: event.rawStatus, providerPaymentId: event.providerPaymentId, transactionId: event.transactionId, paidAt: new Date(), failureReason: null },
            });

            const isPrepay = order.paymentMethod === "NP_COD";
            const paymentStatus: PaymentStatus = isPrepay ? "PARTIALLY_PAID" : "PAID";
            let stockOk = true;

            if (order.status === "CANCELLED" || (order.stockReleasedAt && !order.stockConfirmedAt)) {
              // Money arrived after the reservation was released (expired/cancelled). Try to take the stock back.
              try {
                await reserveStock(tx, items);
                await tx.order.update({ where: { id: order.id }, data: { stockReleasedAt: null } });
                order.stockReleasedAt = null;
                order.status = "PAYMENT_PENDING";
                await log("payment", "Оплата надійшла після скасування — резерв поновлено");
              } catch (err) {
                if (!(err instanceof OutOfStockError)) throw err;
                stockOk = false;
              }
            }

            if (!stockOk) {
              await tx.order.update({ where: { id: order.id }, data: { paymentStatus, paidAt: new Date() } });
              await log("payment_alert", "Оплата надійшла, але товару вже немає в наявності. Потрібне ручне повернення коштів.");
              effects.needsAttention = "Оплата після скасування; товару немає — потрібне повернення коштів";
              return { result: "processed", orderId: order.id, effect: "paid_but_out_of_stock" };
            }

            if (!order.stockConfirmedAt && !order.stockReleasedAt) {
              await confirmSale(tx, items);
              for (const it of order.items) await tx.product.update({ where: { id: it.productId }, data: { salesCount: { increment: it.quantity } } });
              await syncProductStock(tx, await productIdsOfVariants(tx, items.map((i) => i.variantId)));
            }
            const target: OrderStatusName = "PAID";
            const patch: Prisma.OrderUpdateInput = { paymentStatus, paidAt: new Date(), stockConfirmedAt: order.stockConfirmedAt ?? new Date(), reservationExpiresAt: null };
            if (canTransition(order.status as OrderStatusName, target)) patch.status = target;
            await tx.order.update({ where: { id: order.id }, data: patch });
            await log("payment", "Оплату підтверджено платіжною системою", { transactionId: event.transactionId, rawStatus: event.rawStatus });
            effects.paid = true;
            effectLabel = "paid";
            return { result: "processed", orderId: order.id, effect: "paid" };
          }

          case "FAILED": {
            await record(event.rawStatus);
            if (p.status === "PAID" || p.status === "REFUNDED") return { result: "processed", orderId: order.id, effect: "ignored_after_paid" };
            await tx.payment.update({ where: { id: p.id }, data: { status: "FAILED", rawStatus: event.rawStatus, failureReason: event.failureReason } });
            await log("payment", `Оплата не пройшла (${event.rawStatus}${event.failureReason ? `: ${event.failureReason}` : ""})`);
            effects.failed = true;
            effectLabel = "failed";
            return { result: "processed", orderId: order.id, effect: "failed" };
          }

          case "REFUNDED": {
            await record(event.rawStatus);
            if (p.status === "REFUNDED") return { result: "processed", orderId: order.id, effect: "already_refunded" };
            await tx.payment.update({ where: { id: p.id }, data: { status: "REFUNDED", rawStatus: event.rawStatus } });
            const patch: Prisma.OrderUpdateInput = { paymentStatus: "REFUNDED" };
            if (REVERSED_ORDER_STATES.includes(order.status) && canTransition(order.status as OrderStatusName, "REFUNDED")) patch.status = "REFUNDED";
            await tx.order.update({ where: { id: order.id }, data: patch });
            await log("payment", "Платіж повернено (reversed)");
            effects.refunded = true;
            effectLabel = "refunded";
            return { result: "processed", orderId: order.id, effect: "refunded" };
          }

          case "PROCESSING": {
            await record(event.rawStatus);
            if (p.status === "PENDING") await tx.payment.update({ where: { id: p.id }, data: { status: "PROCESSING", rawStatus: event.rawStatus } });
            else await tx.payment.update({ where: { id: p.id }, data: { rawStatus: event.rawStatus } });
            return { result: "processed", orderId: order.id, effect: "processing" };
          }

          default:
            await record(event.rawStatus);
            return { result: "ignored", reason: "irrelevant_status" };
        }
      },
      { timeout: 20_000, maxWait: 10_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    if (outcome.result === "processed" && orderId) {
      runAfter(async () => {
        if (effects.paid) {
          revalidateCatalog();
          await sendOrderEmail(orderId, "payment_successful");
        }
        if (effects.failed) await sendOrderEmail(orderId, "payment_failed");
        if (effects.refunded) await sendOrderEmail(orderId, "refund");
        if (effects.needsAttention) await sendOrderEmail(orderId, "admin_payment_problem", { note: effects.needsAttention });
      }, "payment-emails");
    } else if (effects.needsAttention && orderId) {
      runAfter(() => sendOrderEmail(orderId, "admin_payment_problem", { note: effects.needsAttention }), "payment-alert-email");
    }
    return outcome;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { result: "duplicate" }; // lost a race on eventKey
    throw err;
  } finally {
    void effectLabel;
  }
}

/** Pull-based reconciliation: ask the provider for the authoritative status of an unfinished payment. */
export async function reconcileOrderPayment(orderNumber: string) {
  const { getPaymentProvider } = await import("./payments");
  const payment = await db.payment.findFirst({
    where: { order: { number: orderNumber }, status: { in: ["PENDING", "PROCESSING"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) return null;
  const event = await getPaymentProvider(payment.provider === "LIQPAY" ? "LIQPAY" : "LIQPAY").fetchStatus(payment.providerOrderId);
  return applyPaymentEvent(event);
}

export { releaseStock };
