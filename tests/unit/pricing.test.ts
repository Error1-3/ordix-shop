import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOrderTotals, evaluateCoupon, availableStock, type CouponInput, type PricedLine } from "@/lib/pricing";
import { uah } from "@/lib/money";

const lines: PricedLine[] = [
  { variantId: "v1", productId: "p1", categoryId: "iphone", unitPrice: uah(30000), quantity: 1 },
  { variantId: "v2", productId: "p2", categoryId: "cases", unitPrice: uah(500), quantity: 2 },
];
const baseCoupon: CouponInput = {
  code: "TEST", type: "PERCENT", value: 10, usedCount: 0, productIds: [], categoryIds: [], isActive: true,
};
const delivery = { flatFee: 0, freeShippingThreshold: null };
const noCod = { prepaymentAmount: 0, commissionPercent: 0, commissionFixed: 0 };

test("percent coupon applies to whole cart", () => {
  const r = evaluateCoupon(baseCoupon, lines);
  assert.ok(r.ok);
  assert.equal(r.discount, uah(3100)); // 10% of 31 000
});

test("fixed coupon never exceeds subtotal", () => {
  const r = evaluateCoupon({ ...baseCoupon, type: "FIXED", value: uah(999999) }, lines);
  assert.ok(r.ok);
  assert.equal(r.discount, uah(31000));
});

test("category-restricted coupon discounts only eligible lines", () => {
  const r = evaluateCoupon({ ...baseCoupon, categoryIds: ["cases"] }, lines);
  assert.ok(r.ok);
  assert.equal(r.discount, uah(100)); // 10% of 1 000
});

test("product-restricted coupon not applicable to other products", () => {
  const r = evaluateCoupon({ ...baseCoupon, productIds: ["nope"] }, lines);
  assert.deepEqual(r, { ok: false, reason: "NOT_APPLICABLE" });
});

test("coupon rejections: expired, not started, limit, per-customer, min order, inactive", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  assert.equal((evaluateCoupon({ ...baseCoupon, expiresAt: new Date("2026-05-01") }, lines, { now }) as any).reason, "EXPIRED");
  assert.equal((evaluateCoupon({ ...baseCoupon, startsAt: new Date("2026-07-01") }, lines, { now }) as any).reason, "NOT_STARTED");
  assert.equal((evaluateCoupon({ ...baseCoupon, usageLimit: 5, usedCount: 5 }, lines) as any).reason, "USAGE_LIMIT");
  assert.equal((evaluateCoupon({ ...baseCoupon, perCustomerLimit: 1 }, lines, { customerUsageCount: 1 }) as any).reason, "CUSTOMER_LIMIT");
  assert.equal((evaluateCoupon({ ...baseCoupon, minOrderAmount: uah(50000) }, lines) as any).reason, "MIN_ORDER");
  assert.equal((evaluateCoupon({ ...baseCoupon, isActive: false }, lines) as any).reason, "INACTIVE");
});

test("online payment totals", () => {
  const t = computeOrderTotals({ lines, discount: uah(1000), delivery, method: "LIQPAY_CARD", cod: noCod });
  assert.equal(t.subtotal, uah(31000));
  assert.equal(t.total, uah(30000));
  assert.equal(t.onlineAmount, uah(30000));
  assert.equal(t.codAmount, 0);
});

test("free shipping threshold and flat fee", () => {
  const d = { flatFee: uah(100), freeShippingThreshold: uah(20000) };
  assert.equal(computeOrderTotals({ lines, discount: 0, delivery: d, method: "LIQPAY_CARD", cod: noCod }).deliveryCost, 0);
  const small = [{ unitPrice: uah(500), quantity: 1 }];
  assert.equal(computeOrderTotals({ lines: small, discount: 0, delivery: d, method: "LIQPAY_CARD", cod: noCod }).deliveryCost, uah(100));
});

test("COD with prepayment and commission", () => {
  const t = computeOrderTotals({
    lines, discount: 0, delivery, method: "NP_COD",
    cod: { prepaymentAmount: uah(200), commissionPercent: 2, commissionFixed: uah(20) },
  });
  // goods 31 000; prepay 200; cod base 30 800; commission 2% = 616 + 20 = 636
  assert.equal(t.prepaymentAmount, uah(200));
  assert.equal(t.onlineAmount, uah(200));
  assert.equal(t.commission, uah(636));
  assert.equal(t.codAmount, uah(31436));
  assert.equal(t.total, uah(31000) + uah(636));
});

test("pay on receive charges nothing online", () => {
  const t = computeOrderTotals({ lines, discount: 0, delivery, method: "PAY_ON_RECEIVE", cod: noCod });
  assert.equal(t.onlineAmount, 0);
  assert.equal(t.codAmount, uah(31000));
});

test("discount can never push total below zero", () => {
  const t = computeOrderTotals({ lines, discount: uah(10_000_000), delivery, method: "LIQPAY_CARD", cod: noCod });
  assert.equal(t.total, 0);
});

test("availableStock derives from stock - reserved and never negative", () => {
  assert.equal(availableStock({ stock: 5, reservedStock: 2 }), 3);
  assert.equal(availableStock({ stock: 1, reservedStock: 3 }), 0);
});
