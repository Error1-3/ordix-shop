/**
 * Money utilities. ALL amounts in the system are integers in minor units (kopiykas).
 * Floating point is never used for arithmetic; conversion to a decimal number happens
 * only at provider boundaries (LiqPay expects a number like 1299.5).
 */

export type Minor = number;

const NBSP = "\u00A0";

export function assertMinor(value: number, label = "amount"): asserts value is Minor {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be an integer number of minor units, got ${value}`);
  }
}

/** Parse a user-entered decimal string ("1299", "1 299,50", "1299.5") to minor units. No floats involved. */
export function parseMoney(input: string): Minor {
  const cleaned = input.replace(/[\s\u00A0]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) throw new RangeError(`Invalid money value: "${input}"`);
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** Whole hryvnias -> minor units. */
export function uah(whole: number): Minor {
  assertMinor(whole, "uah");
  return whole * 100;
}

/** Format minor units as "1 299 ₴" (fraction shown only when non-zero: "1 299,50 ₴"). */
export function formatMoney(minor: Minor, opts: { symbol?: string; forceFraction?: boolean } = {}): string {
  assertMinor(minor);
  const symbol = opts.symbol ?? "₴";
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const wholeStr = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const fracStr = frac === 0 && !opts.forceFraction ? "" : `,${String(frac).padStart(2, "0")}`;
  return `${negative ? "−" : ""}${wholeStr}${fracStr}${NBSP}${symbol}`;
}

/** minor -> decimal number for provider APIs (e.g. LiqPay). Exact for any 2-decimal value. */
export function minorToDecimal(minor: Minor): number {
  assertMinor(minor);
  return Number((minor / 100).toFixed(2));
}

/** Provider decimal (number or numeric string) -> minor units, rounding half away from zero. */
export function decimalToMinor(value: number | string): Minor {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) throw new RangeError(`Invalid decimal amount: ${value}`);
  return Math.round(n * 100);
}

export function sumMinor(values: Minor[]): Minor {
  return values.reduce((acc, v) => {
    assertMinor(v);
    return acc + v;
  }, 0);
}

/** Percentage of an amount in integer arithmetic. `percent` may have up to 2 decimals (basis points internally). Rounds half up. */
export function percentOf(amount: Minor, percent: number): Minor {
  assertMinor(amount);
  const bps = Math.round(percent * 100); // 12.5% -> 1250
  return Math.floor((amount * bps + 5000) / 10000);
}

/** Discount percent between compare-at and price, whole number; 0 if not a discount. */
export function discountPercent(compareAt: Minor | null | undefined, price: Minor): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
