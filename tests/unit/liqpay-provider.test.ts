import { test } from "node:test";
import assert from "node:assert/strict";
import { LiqPayProvider } from "@/services/payments/liqpay";
import { decodeLiqPayData, encodeLiqPayData, signLiqPay } from "@/services/payments/liqpay-core";
import { InvalidSignatureError } from "@/services/payments/types";

const PUB = "sandbox_i00000000";
const PRIV = "sandbox_private_key_for_tests";
const provider = (f?: typeof fetch) => new LiqPayProvider(PUB, PRIV, f);
const signed = (payload: Record<string, unknown>) => { const data = encodeLiqPayData(payload); return { data, signature: signLiqPay(PRIV, data) }; };

test("createPayment builds a signed hosted-checkout request WITHOUT leaking the private key", () => {
  const r = provider().createPayment({
    providerOrderId: "IDS-260921-ABCDE-1", amount: 129950, currency: "UAH", description: "Замовлення IDS-260921-ABCDE", language: "uk",
    resultUrl: "https://shop.example/checkout/result", callbackUrl: "https://shop.example/api/payments/liqpay/callback", expiresAt: new Date("2026-09-21T12:00:00Z"),
  });
  assert.equal(r.url, "https://www.liqpay.ua/api/3/checkout");
  assert.deepEqual(Object.keys(r.fields).sort(), ["data", "signature"]);
  const p = decodeLiqPayData(r.fields.data!);
  assert.equal(p.public_key, PUB);
  assert.equal(p.version, 3);
  assert.equal(p.action, "pay");
  assert.equal(p.amount, 1299.5);
  assert.equal(p.currency, "UAH");
  assert.equal(p.order_id, "IDS-260921-ABCDE-1");
  assert.equal(p.server_url, "https://shop.example/api/payments/liqpay/callback");
  assert.equal(p.result_url, "https://shop.example/checkout/result");
  assert.equal(p.expired_date, "2026-09-21 12:00:00");
  assert.equal(r.fields.signature, signLiqPay(PRIV, r.fields.data!));
  assert.ok(!JSON.stringify(r).includes(PRIV));
});

test("parseCallback accepts a correctly signed success payload", () => {
  const e = provider().parseCallback(signed({ public_key: PUB, status: "success", order_id: "X-1", amount: 10, currency: "UAH", payment_id: 42, transaction_id: 7 }));
  assert.equal(e.state, "PAID");
  assert.equal(e.amount, 1000);
  assert.equal(e.providerPaymentId, "42");
});

test("parseCallback rejects forged / tampered / unsigned payloads", () => {
  const good = signed({ public_key: PUB, status: "success", order_id: "X-1", amount: 10, currency: "UAH" });
  assert.throws(() => provider().parseCallback({ ...good, signature: "AAAA" }), InvalidSignatureError);
  const forged = { data: encodeLiqPayData({ public_key: PUB, status: "success", order_id: "X-1", amount: 0.01, currency: "UAH" }), signature: good.signature };
  assert.throws(() => provider().parseCallback(forged), InvalidSignatureError);
  assert.throws(() => provider().parseCallback({ data: good.data, signature: "" }), InvalidSignatureError);
  // signed with a different private key
  const other = encodeLiqPayData({ status: "success" });
  assert.throws(() => provider().parseCallback({ data: other, signature: signLiqPay("attacker-key", other) }), InvalidSignatureError);
});

test("fetchStatus signs its request, posts form-encoded data and normalises the answer", async () => {
  let seen: { url: string; body: URLSearchParams } | null = null;
  const fake = (async (url: string, init: RequestInit) => {
    seen = { url, body: init.body as URLSearchParams };
    return new Response(JSON.stringify({ result: "ok", status: "success", order_id: "X-1", amount: 5, currency: "UAH", payment_id: 1 }), { status: 200 });
  }) as unknown as typeof fetch;
  const e = await provider(fake).fetchStatus("X-1");
  assert.equal(seen!.url, "https://www.liqpay.ua/api/request");
  const data = seen!.body.get("data")!;
  assert.equal(seen!.body.get("signature"), signLiqPay(PRIV, data));
  assert.deepEqual(decodeLiqPayData(data), { version: 3, public_key: PUB, action: "status", order_id: "X-1" });
  assert.equal(e.state, "PAID");
  assert.equal(e.merchantId, PUB);
});

test("fetchStatus surfaces provider errors instead of pretending success", async () => {
  const fake = (async () => new Response(JSON.stringify({ result: "error", err_description: "payment_not_found" }), { status: 200 })) as unknown as typeof fetch;
  await assert.rejects(provider(fake).fetchStatus("NOPE-1"), /payment_not_found/);
});

test("refund sends action=refund with exact decimal amount", async () => {
  let payload: Record<string, unknown> = {};
  const fake = (async (_u: string, init: RequestInit) => { payload = decodeLiqPayData((init.body as URLSearchParams).get("data")!); return new Response(JSON.stringify({ result: "ok", status: "reversed" })); }) as unknown as typeof fetch;
  const r = await provider(fake).refund({ providerOrderId: "X-1", amount: 129950 });
  assert.equal(payload.action, "refund");
  assert.equal(payload.amount, 1299.5);
  assert.ok(r.ok);
});

test("constructing the provider without keys is a hard error (no silent fake mode)", () => {
  assert.throws(() => new LiqPayProvider("", ""));
});
