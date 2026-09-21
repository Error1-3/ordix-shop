import "server-only";
import { minorToDecimal } from "@/lib/money";
import {
  LIQPAY_API_URL,
  LIQPAY_CHECKOUT_URL,
  decodeLiqPayData,
  encodeLiqPayData,
  formatLiqPayExpiry,
  normalizeLiqPayPayload,
  signLiqPay,
  verifyLiqPaySignature,
} from "./liqpay-core";
import {
  InvalidSignatureError,
  type CreatePaymentInput,
  type ParsedPaymentEvent,
  type PaymentProvider,
  type PaymentRedirect,
} from "./types";

export class LiqPayProvider implements PaymentProvider {
  readonly name = "LIQPAY" as const;

  constructor(
    private readonly publicKey: string,
    private readonly privateKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!publicKey || !privateKey) throw new Error("LiqPay keys are not configured (LIQPAY_PUBLIC_KEY / LIQPAY_PRIVATE_KEY)");
  }

  /** Builds signed `data` + `signature`. The private key never leaves the server; only data+signature go to the browser. */
  createPayment(input: CreatePaymentInput): PaymentRedirect {
    const params: Record<string, unknown> = {
      version: 3,
      public_key: this.publicKey,
      action: "pay",
      amount: minorToDecimal(input.amount),
      currency: input.currency,
      description: input.description.slice(0, 200),
      order_id: input.providerOrderId,
      language: input.language,
      result_url: input.resultUrl,
      server_url: input.callbackUrl,
    };
    if (input.expiresAt) params.expired_date = formatLiqPayExpiry(input.expiresAt);
    const data = encodeLiqPayData(params);
    return { method: "POST_FORM", url: LIQPAY_CHECKOUT_URL, fields: { data, signature: signLiqPay(this.privateKey, data) } };
  }

  parseCallback(body: { data: string; signature: string }): ParsedPaymentEvent {
    if (!body.data || !body.signature || !verifyLiqPaySignature(this.privateKey, body.data, body.signature)) {
      throw new InvalidSignatureError();
    }
    return normalizeLiqPayPayload(decodeLiqPayData(body.data), body.data);
  }

  private async apiRequest(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const data = encodeLiqPayData({ version: 3, public_key: this.publicKey, ...params });
    const form = new URLSearchParams({ data, signature: signLiqPay(this.privateKey, data) });
    const res = await this.fetchImpl(LIQPAY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`LiqPay API HTTP ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  }

  /** Payment Status API (action=status). Response is JSON from LiqPay over TLS; we still re-check merchant/amount downstream. */
  async fetchStatus(providerOrderId: string): Promise<ParsedPaymentEvent> {
    const json = await this.apiRequest({ action: "status", order_id: providerOrderId });
    if (json.result === "error") throw new Error(`LiqPay status error: ${String(json.err_description ?? json.err_code ?? "unknown")}`);
    return normalizeLiqPayPayload({ public_key: this.publicKey, ...json }, JSON.stringify(json));
  }

  async refund(input: { providerOrderId: string; amount: number }) {
    const json = await this.apiRequest({ action: "refund", order_id: input.providerOrderId, amount: minorToDecimal(input.amount) });
    const rawStatus = String(json.status ?? json.result ?? "");
    return { ok: json.result !== "error" && (rawStatus === "reversed" || json.result === "ok"), rawStatus, raw: json };
  }
}
