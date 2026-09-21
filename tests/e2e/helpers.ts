import { createHash } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";

/** Sends a correctly SIGNED LiqPay callback (same algorithm LiqPay uses) — the only legitimate way to "pay" in E2E without LiqPay's hosted page. */
export async function sendLiqPayCallback(request: APIRequest | APIRequestContext, opts: { orderId: string; amountUah: number; status?: string }) {
  const pub = process.env.LIQPAY_PUBLIC_KEY!;
  const priv = process.env.LIQPAY_PRIVATE_KEY!;
  const data = Buffer.from(JSON.stringify({ public_key: pub, status: opts.status ?? "success", order_id: opts.orderId, amount: opts.amountUah, currency: "UAH", payment_id: Date.now() })).toString("base64");
  const signature = createHash("sha1").update(priv + data + priv).digest("base64");
  return (request as APIRequestContext).post("/api/payments/liqpay/callback", { form: { data, signature } });
}
type APIRequest = APIRequestContext;
