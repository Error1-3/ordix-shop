/**
 * LiqPay protocol primitives — pure functions (node:crypto only), unit-tested against the
 * official example in https://www.liqpay.ua/documentation/en/data_signature :
 *
 *   data      = base64( JSON )
 *   signature = base64( sha1_binary( private_key + data + private_key ) )
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { decimalToMinor, minorToDecimal } from "@/lib/money";
import type { NormalizedPaymentState, ParsedPaymentEvent } from "./types";

export const LIQPAY_CHECKOUT_URL = "https://www.liqpay.ua/api/3/checkout";
export const LIQPAY_API_URL = "https://www.liqpay.ua/api/request";

export function signLiqPay(privateKey: string, data: string): string {
  return createHash("sha1").update(privateKey + data + privateKey).digest("base64");
}

export function encodeLiqPayData(params: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(params), "utf8").toString("base64");
}

export function decodeLiqPayData(data: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("LiqPay payload is not an object");
  return parsed as Record<string, unknown>;
}

/** Constant-time signature comparison. */
export function verifyLiqPaySignature(privateKey: string, data: string, signature: string): boolean {
  const expected = Buffer.from(signLiqPay(privateKey, data));
  const got = Buffer.from(signature ?? "");
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** LiqPay `expired_date` format, UTC: "2016-04-24 00:00:00". */
export function formatLiqPayExpiry(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Status mapping. Source: https://www.liqpay.ua/documentation/en/api/information/status/doc
 *  final:            success, failure, error, reversed, subscribed, unsubscribed
 *  needs confirmation: 3ds_verify, captcha_verify, cvv_verify, ivr_verify, otp_verify, password_verify,
 *                    phone_verify, pin_verify, receiver_verify, sender_verify
 *  other:            wait_secure, wait_accept, wait_lc, wait_hold?, wait_reserve, wait_compensation,
 *                    processing, prepared, invoice_wait, cash_wait, hold_wait, try_again, sandbox
 *
 * Conservative rule: ONLY `success` and `wait_compensation` (documented as "payment is successful, it will be
 * transferred in daily settlement") confirm a sale. `wait_secure` ("payment is verified" — under anti-fraud
 * check) and everything else stays PROCESSING until a final callback arrives. Unknown statuses never mark paid.
 */
export function mapLiqPayStatus(status: string): NormalizedPaymentState {
  switch (status) {
    case "success":
    case "wait_compensation":
      return "PAID";
    case "sandbox":
      return "PAID_SANDBOX";
    case "failure":
    case "error":
    case "try_again":
      return "FAILED";
    case "reversed":
      return "REFUNDED";
    case "subscribed":
    case "unsubscribed":
      return "IGNORED";
    default:
      return "PROCESSING";
  }
}

const str = (v: unknown): string | null => (v === undefined || v === null || v === "" ? null : String(v));

export function normalizeLiqPayPayload(payload: Record<string, unknown>, rawData: string): ParsedPaymentEvent {
  const rawStatus = String(payload.status ?? "");
  const amountRaw = payload.amount as number | string | undefined;
  const isSandboxFlag = payload.sandbox === 1 || payload.sandbox === "1" || rawStatus === "sandbox";
  let state = mapLiqPayStatus(rawStatus);
  // Test payments in newer API versions come as status=success + sandbox=1. Never treat those as real money.
  if (state === "PAID" && isSandboxFlag) state = "PAID_SANDBOX";

  return {
    provider: "LIQPAY",
    providerOrderId: String(payload.order_id ?? ""),
    providerPaymentId: str(payload.payment_id),
    transactionId: str(payload.transaction_id),
    rawStatus,
    state,
    amount: amountRaw === undefined ? 0 : decimalToMinor(amountRaw),
    currency: String(payload.currency ?? ""),
    failureReason: str(payload.err_description) ?? str(payload.err_code),
    isSandbox: isSandboxFlag,
    merchantId: str(payload.public_key),
    raw: payload,
    // Same signed payload delivered twice => same key => processed once.
    eventKey: createHmac("sha256", "liqpay-event").update(rawData).digest("hex"),
  };
}

export { minorToDecimal };
