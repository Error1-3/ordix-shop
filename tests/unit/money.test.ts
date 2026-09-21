import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, parseMoney, percentOf, minorToDecimal, decimalToMinor, discountPercent, uah, sumMinor } from "@/lib/money";

test("formatMoney groups thousands with NBSP and appends ₴", () => {
  assert.equal(formatMoney(129900), "1\u00A0299\u00A0₴");
  assert.equal(formatMoney(129950), "1\u00A0299,50\u00A0₴");
  assert.equal(formatMoney(0), "0\u00A0₴");
  assert.equal(formatMoney(7599900), "75\u00A0999\u00A0₴");
});

test("parseMoney is exact (no float drift)", () => {
  assert.equal(parseMoney("1299"), 129900);
  assert.equal(parseMoney("1 299,5"), 129950);
  assert.equal(parseMoney("0.29"), 29);
  assert.equal(parseMoney("19.99"), 1999);
  assert.throws(() => parseMoney("12.345"));
  assert.throws(() => parseMoney("abc"));
});

test("the classic 0.1 + 0.2 problem does not exist in minor units", () => {
  assert.equal(sumMinor([10, 20]), 30);
  assert.equal(minorToDecimal(30), 0.3);
});

test("non-integer minor amounts are rejected", () => {
  assert.throws(() => formatMoney(10.5));
  assert.throws(() => sumMinor([1, 2.5]));
});

test("percentOf rounds half up in integer arithmetic", () => {
  assert.equal(percentOf(10000, 10), 1000);
  assert.equal(percentOf(999, 10), 100); // 99.9 -> 100
  assert.equal(percentOf(12345, 12.5), 1543); // 1543.125 -> 1543
  assert.equal(percentOf(1, 50), 1); // 0.5 -> 1
});

test("decimal <-> minor round-trips for provider amounts", () => {
  for (const minor of [1, 99, 100, 12345, 7599900, 129950]) {
    assert.equal(decimalToMinor(minorToDecimal(minor)), minor);
  }
  assert.equal(decimalToMinor("1299.50"), 129950);
});

test("discountPercent", () => {
  assert.equal(discountPercent(uah(1000), uah(800)), 20);
  assert.equal(discountPercent(null, uah(800)), 0);
  assert.equal(discountPercent(uah(700), uah(800)), 0);
});
