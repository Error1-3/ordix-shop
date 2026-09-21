/** Provider-agnostic payment types. Adding WayForPay / MonoPay = implement PaymentProvider. */

export type ProviderName = "LIQPAY" | "WAYFORPAY" | "MONOPAY";

/** Provider-neutral lifecycle. The order/payment services only understand these. */
export type NormalizedPaymentState =
  | "PAID" // money captured — the ONLY state that confirms a sale
  | "PAID_SANDBOX" // provider test payment: accepted as paid only when sandbox is explicitly allowed
  | "PROCESSING" // in progress / needs customer action / under review
  | "FAILED"
  | "REFUNDED"
  | "IGNORED"; // irrelevant event (e.g. subscription events)

export type CreatePaymentInput = {
  /** Unique per payment ATTEMPT (sent to the provider as order_id). */
  providerOrderId: string;
  /** Minor units. */
  amount: number;
  currency: string;
  description: string;
  language: "uk" | "en";
  resultUrl: string;
  callbackUrl: string;
  /** ISO string; provider-specific expiry for the payment page. */
  expiresAt?: Date;
};

/** What the frontend needs to send the customer to the hosted checkout. No secrets. */
export type PaymentRedirect = {
  method: "POST_FORM";
  url: string;
  fields: Record<string, string>;
};

export type ParsedPaymentEvent = {
  provider: ProviderName;
  providerOrderId: string;
  providerPaymentId: string | null;
  transactionId: string | null;
  rawStatus: string;
  state: NormalizedPaymentState;
  /** Minor units as reported by the provider. */
  amount: number;
  currency: string;
  failureReason: string | null;
  isSandbox: boolean;
  /** Provider public key echoed in the payload (must equal ours). */
  merchantId: string | null;
  /** Exact original payload for auditing. */
  raw: Record<string, unknown>;
  /** Stable key of THIS notification, used for duplicate protection. */
  eventKey: string;
};

export class InvalidSignatureError extends Error {
  constructor() {
    super("Invalid payment signature");
    this.name = "InvalidSignatureError";
  }
}

export interface PaymentProvider {
  readonly name: ProviderName;
  createPayment(input: CreatePaymentInput): PaymentRedirect;
  /** Verifies the signature, decodes the payload. Throws InvalidSignatureError on mismatch. */
  parseCallback(body: { data: string; signature: string }): ParsedPaymentEvent;
  /** Server-to-server status check (source of truth when a callback is delayed/lost). */
  fetchStatus(providerOrderId: string): Promise<ParsedPaymentEvent>;
  refund(input: { providerOrderId: string; amount: number }): Promise<{ ok: boolean; rawStatus: string; raw: Record<string, unknown> }>;
}
