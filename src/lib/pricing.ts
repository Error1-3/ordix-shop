/**
 * Pure pricing logic: line totals, coupon validation/discount, delivery, COD commission, order totals.
 * No I/O here so it can be unit-tested and reused by cart preview AND order creation.
 * The server ALWAYS recomputes with this module; client-side numbers are display-only.
 */
import { type Minor, assertMinor, percentOf } from "./money";

export type CouponInput = {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minOrderAmount?: number | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  usageLimit?: number | null;
  usedCount: number;
  perCustomerLimit?: number | null;
  productIds: string[];
  categoryIds: string[];
  isActive: boolean;
};

export type PricedLine = {
  variantId: string;
  productId: string;
  categoryId: string;
  unitPrice: Minor;
  quantity: number;
};

export type CouponCheck =
  | { ok: true; discount: Minor; eligibleSubtotal: Minor }
  | { ok: false; reason: CouponRejection };

export type CouponRejection =
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "USAGE_LIMIT"
  | "CUSTOMER_LIMIT"
  | "MIN_ORDER"
  | "NOT_APPLICABLE";

export function lineTotal(unitPrice: Minor, quantity: number): Minor {
  assertMinor(unitPrice, "unitPrice");
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError("quantity must be a positive integer");
  return unitPrice * quantity;
}

export function subtotalOf(lines: Pick<PricedLine, "unitPrice" | "quantity">[]): Minor {
  return lines.reduce((s, l) => s + lineTotal(l.unitPrice, l.quantity), 0);
}

export function evaluateCoupon(
  coupon: CouponInput,
  lines: PricedLine[],
  ctx: { now?: Date; customerUsageCount?: number } = {},
): CouponCheck {
  const now = ctx.now ?? new Date();
  if (!coupon.isActive) return { ok: false, reason: "INACTIVE" };
  if (coupon.startsAt && now < coupon.startsAt) return { ok: false, reason: "NOT_STARTED" };
  if (coupon.expiresAt && now > coupon.expiresAt) return { ok: false, reason: "EXPIRED" };
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return { ok: false, reason: "USAGE_LIMIT" };
  if (coupon.perCustomerLimit != null && (ctx.customerUsageCount ?? 0) >= coupon.perCustomerLimit)
    return { ok: false, reason: "CUSTOMER_LIMIT" };

  const restricted = coupon.productIds.length > 0 || coupon.categoryIds.length > 0;
  const eligible = restricted
    ? lines.filter((l) => coupon.productIds.includes(l.productId) || coupon.categoryIds.includes(l.categoryId))
    : lines;
  if (eligible.length === 0) return { ok: false, reason: "NOT_APPLICABLE" };

  const total = subtotalOf(lines);
  if (coupon.minOrderAmount != null && total < coupon.minOrderAmount) return { ok: false, reason: "MIN_ORDER" };

  const eligibleSubtotal = subtotalOf(eligible);
  const raw = coupon.type === "PERCENT" ? percentOf(eligibleSubtotal, Math.min(100, Math.max(0, coupon.value))) : coupon.value;
  const discount = Math.max(0, Math.min(raw, eligibleSubtotal)); // never below zero
  return { ok: true, discount, eligibleSubtotal };
}

export type DeliverySettings = {
  flatFee: Minor; // charged online when > 0 (default 0: carrier tariffs are paid at the branch)
  freeShippingThreshold: Minor | null;
};

export function deliveryCost(subtotalAfterDiscount: Minor, s: DeliverySettings): Minor {
  if (s.freeShippingThreshold != null && subtotalAfterDiscount >= s.freeShippingThreshold) return 0;
  return s.flatFee;
}

export type CodSettings = {
  prepaymentAmount: Minor; // required online prepayment for COD orders (0 = none)
  commissionPercent: number; // configured from the carrier's tariff; 0 by default
  commissionFixed: Minor;
};

export function codCommission(codAmount: Minor, s: CodSettings): Minor {
  if (codAmount <= 0) return 0;
  return percentOf(codAmount, s.commissionPercent) + s.commissionFixed;
}

export type OrderTotals = {
  subtotal: Minor;
  discountTotal: Minor;
  deliveryCost: Minor;
  commission: Minor;
  total: Minor;
  /** Amount to charge online right now (LiqPay). */
  onlineAmount: Minor;
  /** Amount the customer pays on receipt / carrier collects. */
  codAmount: Minor;
  prepaymentAmount: Minor;
};

export type PaymentMethodKind = "LIQPAY_CARD" | "NP_COD" | "PAY_ON_RECEIVE";

export function computeOrderTotals(input: {
  lines: Pick<PricedLine, "unitPrice" | "quantity">[];
  discount: Minor;
  delivery: DeliverySettings;
  method: PaymentMethodKind;
  cod: CodSettings;
}): OrderTotals {
  const subtotal = subtotalOf(input.lines);
  const discountTotal = Math.min(Math.max(0, input.discount), subtotal);
  const afterDiscount = subtotal - discountTotal;
  const delivery = deliveryCost(afterDiscount, input.delivery);
  const goods = afterDiscount + delivery;

  if (input.method === "LIQPAY_CARD") {
    return { subtotal, discountTotal, deliveryCost: delivery, commission: 0, total: goods, onlineAmount: goods, codAmount: 0, prepaymentAmount: 0 };
  }
  if (input.method === "PAY_ON_RECEIVE") {
    return { subtotal, discountTotal, deliveryCost: delivery, commission: 0, total: goods, onlineAmount: 0, codAmount: goods, prepaymentAmount: 0 };
  }
  // NP_COD
  const prepayment = Math.min(input.cod.prepaymentAmount, goods);
  const codBase = goods - prepayment;
  const commission = codCommission(codBase, input.cod);
  return {
    subtotal,
    discountTotal,
    deliveryCost: delivery,
    commission,
    total: goods + commission,
    onlineAmount: prepayment,
    codAmount: codBase + commission,
    prepaymentAmount: prepayment,
  };
}

/** Stock availability arithmetic used everywhere (there is no separately stored availableStock to drift). */
export function availableStock(inv: { stock: number; reservedStock: number }): number {
  return Math.max(0, inv.stock - inv.reservedStock);
}
