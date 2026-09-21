import { test } from "node:test";
import assert from "node:assert/strict";
import { HAS_DB, checkoutInput, makeVariant, setupEnv } from "./helpers";
import { setTestCookie } from "../stubs/next-headers";
import { encodeLiqPayData, signLiqPay } from "@/services/payments/liqpay-core";

const PRIV = "sandbox_private_key_for_tests";
const PUB = "sandbox_i00000000";

async function placeOrder(price = 1_000_000, stock = 3, over: Record<string, unknown> = {}) {
  const { db, variant } = await makeVariant({ price, stock });
  const token = `guest-${variant.id}`;
  setTestCookie("cart_token", token);
  const cart = await db.cart.create({ data: { token, items: { create: { variantId: variant.id, quantity: 1 } } } });
  const { createOrder } = await import("@/services/orders");
  const res = await createOrder({ user: null, input: checkoutInput(over) as never, locale: "uk", ip: "203.0.113.7" });
  return { db, variant, cart, res };
}

const callbackFor = (providerOrderId: string, amountUah: number, status = "success", extra: Record<string, unknown> = {}) => {
  const data = encodeLiqPayData({ public_key: PUB, status, order_id: providerOrderId, amount: amountUah, currency: "UAH", payment_id: 555, transaction_id: 777, ...extra });
  return { data, signature: signLiqPay(PRIV, data) };
};

test("createOrder: server computes price, reserves stock, creates Order+Payment and a signed LiqPay request", { skip: !HAS_DB }, async () => {
  const { db, variant, res } = await placeOrder(1_299_900, 3);
  assert.ok(res.ok);
  if (!res.ok) return;
  const order = await db.order.findUniqueOrThrow({ where: { id: res.orderId }, include: { payments: true, items: true } });
  assert.equal(order.total, 1_299_900);
  assert.equal(order.status, "PAYMENT_PENDING");
  assert.equal(order.payments[0]!.amount, 1_299_900);
  assert.equal(order.payments[0]!.providerOrderId, `${order.number}-1`);
  assert.equal((await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).reservedStock, 1);
  assert.ok(res.redirect && Object.keys(res.redirect.fields).sort().join() === "data,signature");
  assert.ok(!JSON.stringify(res.redirect).includes(PRIV));
});

test("createOrder: last unit cannot be sold twice", { skip: !HAS_DB }, async () => {
  const { db, variant, res } = await placeOrder(500_000, 1);
  assert.ok(res.ok);
  const token = "second-buyer";
  setTestCookie("cart_token", token);
  await db.cart.create({ data: { token, items: { create: { variantId: variant.id, quantity: 1 } } } });
  const { createOrder } = await import("@/services/orders");
  const second = await createOrder({ user: null, input: checkoutInput() as never, locale: "uk", ip: "203.0.113.8" });
  assert.deepEqual(second.ok ? null : second.error, "OUT_OF_STOCK");
});

test("LiqPay callback: valid success confirms sale exactly once; duplicates and replays are ignored", { skip: !HAS_DB }, async () => {
  const { db, variant, res } = await placeOrder(1_000_000, 2);
  assert.ok(res.ok); if (!res.ok) return;
  const payment = await db.payment.findFirstOrThrow({ where: { orderId: res.orderId } });
  const { getPaymentProvider } = await import("@/services/payments");
  const { applyPaymentEvent } = await import("@/services/payment-events");
  const body = callbackFor(payment.providerOrderId, 10_000);

  const first = await applyPaymentEvent(getPaymentProvider("LIQPAY").parseCallback(body));
  assert.equal(first.result, "processed");
  const dup = await applyPaymentEvent(getPaymentProvider("LIQPAY").parseCallback(body));
  assert.equal(dup.result, "duplicate");

  const order = await db.order.findUniqueOrThrow({ where: { id: res.orderId } });
  assert.equal(order.status, "PAID");
  assert.equal(order.paymentStatus, "PAID");
  assert.ok(order.stockConfirmedAt);
  const inv = await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
  assert.deepEqual([inv.stock, inv.reservedStock], [1, 0]); // decremented ONCE

  // A later, different "failure" notification must not un-pay the order.
  const late = await applyPaymentEvent(getPaymentProvider("LIQPAY").parseCallback(callbackFor(payment.providerOrderId, 10_000, "failure", { err_code: "x" })));
  assert.equal(late.result, "processed");
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: res.orderId } })).paymentStatus, "PAID");
});

test("LiqPay callback: 20 concurrent identical callbacks -> stock decremented once", { skip: !HAS_DB }, async () => {
  const { db, variant, res } = await placeOrder(1_000_000, 5);
  assert.ok(res.ok); if (!res.ok) return;
  const payment = await db.payment.findFirstOrThrow({ where: { orderId: res.orderId } });
  const { getPaymentProvider } = await import("@/services/payments");
  const { applyPaymentEvent } = await import("@/services/payment-events");
  const ev = getPaymentProvider("LIQPAY").parseCallback(callbackFor(payment.providerOrderId, 10_000));
  const out = await Promise.all(Array.from({ length: 20 }, () => applyPaymentEvent(ev)));
  assert.equal(out.filter((o) => o.result === "processed").length, 1);
  const inv = await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
  assert.deepEqual([inv.stock, inv.reservedStock], [4, 0]);
});

test("LiqPay callback: wrong amount is rejected and the order stays unpaid", { skip: !HAS_DB }, async () => {
  const { db, res } = await placeOrder(1_000_000, 2);
  assert.ok(res.ok); if (!res.ok) return;
  const payment = await db.payment.findFirstOrThrow({ where: { orderId: res.orderId } });
  const { getPaymentProvider } = await import("@/services/payments");
  const { applyPaymentEvent } = await import("@/services/payment-events");
  const out = await applyPaymentEvent(getPaymentProvider("LIQPAY").parseCallback(callbackFor(payment.providerOrderId, 1)));
  assert.equal(out.result, "rejected");
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: res.orderId } })).paymentStatus, "PENDING");
});

test("LiqPay sandbox payments are NOT real money unless LIQPAY_ALLOW_SANDBOX=true", { skip: !HAS_DB }, async () => {
  const { db, res } = await placeOrder(1_000_000, 2);
  assert.ok(res.ok); if (!res.ok) return;
  const payment = await db.payment.findFirstOrThrow({ where: { orderId: res.orderId } });
  const { getPaymentProvider } = await import("@/services/payments");
  const { applyPaymentEvent } = await import("@/services/payment-events");
  const out = await applyPaymentEvent(getPaymentProvider("LIQPAY").parseCallback(callbackFor(payment.providerOrderId, 10_000, "sandbox")));
  assert.equal(out.result, "ignored");
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: res.orderId } })).paymentStatus, "PENDING");
});

test("failed payment keeps the order retryable; cancelling releases stock", { skip: !HAS_DB }, async () => {
  const { db, variant, res } = await placeOrder(1_000_000, 2);
  assert.ok(res.ok); if (!res.ok) return;
  const payment = await db.payment.findFirstOrThrow({ where: { orderId: res.orderId } });
  const { getPaymentProvider } = await import("@/services/payments");
  const { applyPaymentEvent } = await import("@/services/payment-events");
  await applyPaymentEvent(getPaymentProvider("LIQPAY").parseCallback(callbackFor(payment.providerOrderId, 10_000, "failure", { err_code: "card_declined" })));
  assert.equal((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, "FAILED");
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: res.orderId } })).status, "PAYMENT_PENDING");

  const { changeOrderStatus } = await import("@/services/order-lifecycle");
  await changeOrderStatus(res.orderId, "CANCELLED", null, "test");
  const inv = await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
  assert.deepEqual([inv.stock, inv.reservedStock], [2, 0]);
});

test("COD order: reserves stock, no payment row, sale confirmed when staff move it to PROCESSING", { skip: !HAS_DB }, async () => {
  const { db, variant, res } = await placeOrder(700_000, 2, { paymentMethod: "PAY_ON_RECEIVE" });
  assert.ok(res.ok); if (!res.ok) return;
  assert.equal(res.redirect, null);
  assert.equal(await db.payment.count({ where: { orderId: res.orderId } }), 0);
  const { changeOrderStatus } = await import("@/services/order-lifecycle");
  await changeOrderStatus(res.orderId, "PROCESSING", null);
  const inv = await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
  assert.deepEqual([inv.stock, inv.reservedStock], [1, 0]);
  await assert.rejects(changeOrderStatus(res.orderId, "PENDING", null)); // illegal transition
});

void setupEnv;
