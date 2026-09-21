import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeLiqPayData, encodeLiqPayData, mapLiqPayStatus, normalizeLiqPayPayload, signLiqPay, verifyLiqPaySignature, formatLiqPayExpiry,
} from "@/services/payments/liqpay-core";

// Official example from https://www.liqpay.ua/documentation/en/data_signature
const DOC_PRIVATE_KEY = "a4825234f4bae72a0be04eafe9e8e2bada209255";
const DOC_DATA =
  "eyJwdWJsaWNfa2V5IjoiaTAwMDAwMDAwIiwidmVyc2lvbiI6IjMiLCJhY3Rpb24iOiJwYXkiLCJhbW91bnQiOiIzIiwiY3VycmVuY3kiOiJVQUgiLCJkZXNjcmlwdGlvbiI6InRlc3QiLCJvcmRlcl9pZCI6IjAwMDAwMSJ9";
const DOC_SIGNATURE = "wR+UZDC4jjeL/qUOvIsofIWpZh8=";

test("signature matches the official LiqPay documentation example", () => {
  assert.equal(signLiqPay(DOC_PRIVATE_KEY, DOC_DATA), DOC_SIGNATURE);
  assert.ok(verifyLiqPaySignature(DOC_PRIVATE_KEY, DOC_DATA, DOC_SIGNATURE));
});

test("wrong signature / wrong key / tampered data are rejected", () => {
  assert.equal(verifyLiqPaySignature(DOC_PRIVATE_KEY, DOC_DATA, "AAAA"), false);
  assert.equal(verifyLiqPaySignature("other-key", DOC_DATA, DOC_SIGNATURE), false);
  assert.equal(verifyLiqPaySignature(DOC_PRIVATE_KEY, DOC_DATA + "x", DOC_SIGNATURE), false);
  assert.equal(verifyLiqPaySignature(DOC_PRIVATE_KEY, DOC_DATA, ""), false);
});

test("encode/decode round trip incl. Cyrillic", () => {
  const p = { description: "Замовлення №1", amount: 12.5 };
  assert.deepEqual(decodeLiqPayData(encodeLiqPayData(p)), p);
});

test("decode rejects non-object payloads", () => {
  assert.throws(() => decodeLiqPayData(Buffer.from("[1,2]").toString("base64")));
});

test("status mapping: only success/wait_compensation confirm a sale", () => {
  assert.equal(mapLiqPayStatus("success"), "PAID");
  assert.equal(mapLiqPayStatus("wait_compensation"), "PAID");
  assert.equal(mapLiqPayStatus("sandbox"), "PAID_SANDBOX");
  for (const s of ["failure", "error", "try_again"]) assert.equal(mapLiqPayStatus(s), "FAILED");
  assert.equal(mapLiqPayStatus("reversed"), "REFUNDED");
  for (const s of ["3ds_verify", "otp_verify", "cvv_verify", "processing", "wait_secure", "wait_accept", "hold_wait", "invoice_wait", "something_new"])
    assert.equal(mapLiqPayStatus(s), "PROCESSING", s);
  assert.equal(mapLiqPayStatus("subscribed"), "IGNORED");
});

test("normalize: success + sandbox flag is NOT real money", () => {
  const e = normalizeLiqPayPayload({ status: "success", sandbox: 1, order_id: "A-1", amount: 10, currency: "UAH" }, "x");
  assert.equal(e.state, "PAID_SANDBOX");
  assert.ok(e.isSandbox);
});

test("normalize: amounts become integer minor units, ids are strings", () => {
  const e = normalizeLiqPayPayload(
    { status: "success", order_id: "IDS-1-1", payment_id: 1234567, transaction_id: 99, amount: 1299.5, currency: "UAH", public_key: "i1" }, "raw",
  );
  assert.equal(e.amount, 129950);
  assert.equal(e.providerPaymentId, "1234567");
  assert.equal(e.transactionId, "99");
  assert.equal(e.merchantId, "i1");
  assert.equal(e.state, "PAID");
});

test("identical payloads produce identical event keys, different payloads differ", () => {
  const a = normalizeLiqPayPayload({ status: "success", order_id: "A" }, "payload-1");
  const b = normalizeLiqPayPayload({ status: "success", order_id: "A" }, "payload-1");
  const c = normalizeLiqPayPayload({ status: "success", order_id: "A" }, "payload-2");
  assert.equal(a.eventKey, b.eventKey);
  assert.notEqual(a.eventKey, c.eventKey);
});

test("expired_date format is UTC 'YYYY-MM-DD HH:mm:ss'", () => {
  assert.equal(formatLiqPayExpiry(new Date("2026-04-24T13:05:09.123Z")), "2026-04-24 13:05:09");
});
