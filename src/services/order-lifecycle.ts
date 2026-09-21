import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { runAfter } from "@/lib/after";
import type { SessionUser } from "@/lib/authz";
import { canTransition, type OrderStatusName } from "@/lib/order-status";
import { getSettings } from "@/lib/settings";
import { confirmSale, productIdsOfVariants, releaseStock, syncProductStock, type StockItem } from "./inventory";
import { sendOrderEmail } from "./email";
import { revalidateCatalog } from "./catalog";
import { getPaymentProvider } from "./payments";
import { applyPaymentEvent, reconcileOrderPayment } from "./payment-events";
import { novaPoshta, senderFromEnv } from "./shipping";
import { NovaPoshtaError } from "./shipping/nova-poshta";

export class OrderActionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "OrderActionError";
  }
}

const stockItems = (items: { variantId: string | null; quantity: number }[]): StockItem[] =>
  items.filter((i) => i.variantId).map((i) => ({ variantId: i.variantId as string, quantity: i.quantity }));

/** Put physical units back on the shelf (sale was already confirmed, then order cancelled / returned). */
async function restock(tx: Prisma.TransactionClient, items: StockItem[]) {
  for (const { variantId, quantity } of items) {
    await tx.$executeRaw`UPDATE "Inventory" SET "stock" = "stock" + ${quantity}, "updatedAt" = NOW() WHERE "variantId" = ${variantId}`;
  }
  const ids = items.map((i) => i.variantId);
  await tx.$executeRaw`UPDATE "UsedDevice" SET "status" = 'READY', "updatedAt" = NOW() WHERE "variantId" = ANY(${ids}::text[]) AND "status" = 'SOLD'`;
}

/**
 * Staff-driven (or system-driven) status change with full side effects. The state machine in lib/order-status
 * is enforced here — the UI merely offers the allowed next statuses.
 */
export async function changeOrderStatus(orderId: string, to: OrderStatusName, actor: SessionUser | null, note?: string) {
  const before = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!before) throw new OrderActionError("NOT_FOUND", "Замовлення не знайдено");
  const from = before.status as OrderStatusName;
  if (!canTransition(from, to)) throw new OrderActionError("BAD_TRANSITION", `Перехід ${from} → ${to} неможливий`);
  if (to === "PAID" && before.paymentMethod === "LIQPAY_CARD" && before.paymentStatus !== "PAID")
    throw new OrderActionError("NOT_PAID", "Онлайн-оплату може підтвердити лише платіжна система");
  if (to === "REFUNDED") throw new OrderActionError("USE_REFUND", "Використайте дію «Повернути кошти»");

  const items = stockItems(before.items);
  await db.$transaction(async (tx) => {
    const patch: Prisma.OrderUpdateInput = { status: to };

    if (to === "PROCESSING" && !before.stockConfirmedAt && !before.stockReleasedAt) {
      await confirmSale(tx, items); // COD / pay-on-receive: the sale becomes real when staff accept the order
      for (const it of before.items) await tx.product.update({ where: { id: it.productId }, data: { salesCount: { increment: it.quantity } } });
      patch.stockConfirmedAt = new Date();
      patch.reservationExpiresAt = null;
    }
    if (to === "CANCELLED") {
      patch.cancelledAt = new Date();
      patch.reservationExpiresAt = null;
      if (!before.stockReleasedAt) {
        if (before.stockConfirmedAt) await restock(tx, items);
        else await releaseStock(tx, items);
        patch.stockReleasedAt = new Date();
      }
      await tx.payment.updateMany({ where: { orderId, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "EXPIRED" } });
      if (before.paymentStatus === "PENDING" || before.paymentStatus === "COD_PENDING") patch.paymentStatus = "EXPIRED";
    }
    if (to === "RETURNED" && before.stockConfirmedAt) await restock(tx, items);
    if (to === "DELIVERED" && (before.paymentMethod === "NP_COD" || before.paymentMethod === "PAY_ON_RECEIVE")) {
      patch.paymentStatus = "COD_COLLECTED";
      patch.paidAt = new Date();
    }

    await tx.order.update({ where: { id: orderId }, data: patch });
    await tx.orderEvent.create({
      data: { orderId, type: "status_changed", message: `Статус: ${from} → ${to}${note ? ` (${note})` : ""}`, actorId: actor?.id ?? null },
    });
    await syncProductStock(tx, await productIdsOfVariants(tx, items.map((i) => i.variantId)));
    await audit({ actor, action: "order.status_change", entity: "Order", entityId: orderId, oldValue: { status: from }, newValue: { status: to, note } }, tx);
  });

  revalidateCatalog();
  const mailKind = ({ PROCESSING: "order_processing", SHIPPED: "order_shipped", DELIVERED: "order_delivered", CANCELLED: "order_cancelled" } as const)[to as "PROCESSING"];
  if (mailKind) runAfter(() => sendOrderEmail(orderId, mailKind, { note }), "order-status-email");
}

/** Full refund through the payment provider. The provider's "reversed" callback then arrives and is a no-op. */
export async function refundOrder(orderId: string, actor: SessionUser) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { payments: true, items: true } });
  if (!order) throw new OrderActionError("NOT_FOUND", "Замовлення не знайдено");
  const paid = order.payments.find((p) => p.status === "PAID");
  if (!paid) throw new OrderActionError("NO_PAYMENT", "Немає успішного онлайн-платежу для повернення");

  const res = await getPaymentProvider(paid.provider === "LIQPAY" ? "LIQPAY" : "LIQPAY").refund({ providerOrderId: paid.providerOrderId, amount: paid.amount });
  await audit({ actor, action: "order.refund_requested", entity: "Order", entityId: orderId, newValue: { ok: res.ok, rawStatus: res.rawStatus, amount: paid.amount } });
  if (!res.ok) throw new OrderActionError("REFUND_FAILED", `Платіжна система не виконала повернення (${res.rawStatus || "невідомо"})`);

  await db.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: paid.id }, data: { status: "REFUNDED", rawStatus: res.rawStatus } });
    const from = order.status as OrderStatusName;
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "REFUNDED", ...(canTransition(from, "REFUNDED") ? { status: "REFUNDED" } : {}) } });
    await tx.orderEvent.create({ data: { orderId, type: "refund", message: "Кошти повернено через LiqPay", actorId: actor.id } });
  });
  runAfter(() => sendOrderEmail(orderId, "refund"), "refund-email");
}

/** Create the Nova Poshta waybill (ЕН) for an order. Warehouse/locker delivery; COD amount included when applicable. */
export async function createNovaPoshtaShipment(orderId: string, actor: SessionUser) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: { include: { variant: { select: { weightGrams: true } } } }, shipment: true } });
  if (!order) throw new OrderActionError("NOT_FOUND", "Замовлення не знайдено");
  if (order.shipment) throw new OrderActionError("EXISTS", "ТТН уже створено");
  if (order.deliveryMethod === "NP_COURIER") throw new OrderActionError("COURIER", "Для кур'єрської доставки створіть ЕН у кабінеті Нової пошти й додайте номер вручну");
  if (!order.cityRef || !order.warehouseRef) throw new OrderActionError("NO_ADDRESS", "У замовленні немає відділення / поштомату");
  if (order.paymentMethod === "LIQPAY_CARD" && order.paymentStatus !== "PAID") throw new OrderActionError("NOT_PAID", "Онлайн-оплата ще не підтверджена");

  const settings = await getSettings();
  const grams = order.items.reduce((s, i) => s + (i.variant?.weightGrams ?? settings.shipping.defaultWeightGrams) * i.quantity, 0);
  try {
    const r = await novaPoshta().createShipment({
      sender: senderFromEnv(),
      recipient: { firstName: order.firstName, lastName: order.lastName, phone: order.phone, email: order.email },
      cityRef: order.cityRef, warehouseRef: order.warehouseRef, declaredValue: order.total, weightKg: grams / 1000,
      description: `Техніка Apple, замовлення ${order.number}`.slice(0, 100),
      codAmount: order.paymentMethod === "LIQPAY_CARD" ? 0 : order.codAmount, payer: settings.shipping.payer,
    });
    await db.$transaction(async (tx) => {
      await tx.novaPoshtaShipment.create({
        data: { orderId, trackingNumber: r.trackingNumber, documentRef: r.documentRef, status: "Створено", statusCode: "1", cost: r.cost, estimatedDelivery: r.estimatedDelivery, rawResponse: r.raw as Prisma.InputJsonValue },
      });
      await tx.orderEvent.create({ data: { orderId, type: "shipment", message: `Створено ТТН ${r.trackingNumber}`, actorId: actor.id } });
      await audit({ actor, action: "shipment.create", entity: "Order", entityId: orderId, newValue: { trackingNumber: r.trackingNumber } }, tx);
    });
    return r.trackingNumber;
  } catch (e) {
    if (e instanceof NovaPoshtaError) throw new OrderActionError("NP_ERROR", `Нова пошта: ${e.message}`);
    throw e;
  }
}

export async function attachTrackingNumber(orderId: string, trackingNumber: string, actor: SessionUser) {
  const tn = trackingNumber.replace(/\s/g, "");
  if (!/^\d{14}$/.test(tn)) throw new OrderActionError("BAD_TTN", "ТТН Нової пошти — 14 цифр");
  await db.novaPoshtaShipment.upsert({
    where: { orderId }, create: { orderId, trackingNumber: tn, status: "Додано вручну" }, update: { trackingNumber: tn },
  });
  await audit({ actor, action: "shipment.attach", entity: "Order", entityId: orderId, newValue: { trackingNumber: tn } });
}

/** Cron: refresh tracking; mark orders DELIVERED when NP reports the parcel received. */
export async function syncShipments(limit = 100) {
  const shipments = await db.novaPoshtaShipment.findMany({
    where: { order: { status: { in: ["PROCESSING", "PACKED", "SHIPPED"] } } },
    include: { order: { select: { id: true, phone: true, status: true } } },
    orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
    take: limit,
  });
  if (!shipments.length) return { checked: 0, delivered: 0 };
  const results = await novaPoshta().track(shipments.map((s) => ({ trackingNumber: s.trackingNumber, phone: s.order.phone })));
  let delivered = 0;
  for (const r of results) {
    const s = shipments.find((x) => x.trackingNumber === r.trackingNumber);
    if (!s) continue;
    await db.novaPoshtaShipment.update({
      where: { id: s.id },
      data: { status: r.status, statusCode: r.statusCode, estimatedDelivery: r.estimatedDelivery ?? s.estimatedDelivery, lastCheckedAt: new Date(), rawResponse: r.raw as Prisma.InputJsonValue },
    });
    try {
      if (r.ui === "IN_TRANSIT" && s.order.status === "PACKED") await changeOrderStatus(s.order.id, "SHIPPED", null, "Нова пошта: в дорозі");
      if (r.ui === "DELIVERED") {
        if (s.order.status === "PACKED") await changeOrderStatus(s.order.id, "SHIPPED", null);
        if (s.order.status !== "DELIVERED") {
          await changeOrderStatus(s.order.id, "DELIVERED", null, "Нова пошта: отримано");
          delivered++;
        }
      }
    } catch (e) {
      console.error("[sync-shipments] status change failed", s.order.id, e);
    }
  }
  return { checked: results.length, delivered };
}

/**
 * Cron: cancel unpaid online orders whose reservation expired and free the stock.
 * Before cancelling, ask the provider for the real payment status — a lost callback must never cancel a paid order.
 */
export async function releaseExpiredReservations(limit = 50) {
  const expired = await db.order.findMany({
    where: { status: { in: ["PENDING", "PAYMENT_PENDING"] }, reservationExpiresAt: { lt: new Date() }, paymentStatus: { in: ["PENDING", "PROCESSING"] }, stockReleasedAt: null },
    select: { id: true, number: true },
    take: limit,
  });
  let cancelled = 0;
  for (const o of expired) {
    try {
      await reconcileOrderPayment(o.number).catch((e) => console.warn("[reservations] reconcile skipped", o.number, String(e)));
      const fresh = await db.order.findUnique({ where: { id: o.id }, select: { paymentStatus: true, status: true } });
      if (fresh && (fresh.paymentStatus === "PAID" || fresh.paymentStatus === "PARTIALLY_PAID")) continue;
      await changeOrderStatus(o.id, "CANCELLED", null, "Час на оплату вичерпано");
      cancelled++;
    } catch (e) {
      console.error("[reservations] failed for", o.id, e);
    }
  }
  return { expired: expired.length, cancelled };
}

export { applyPaymentEvent };
