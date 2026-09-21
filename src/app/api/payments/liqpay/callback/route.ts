import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getPaymentProvider } from "@/services/payments";
import { InvalidSignatureError } from "@/services/payments/types";
import { applyPaymentEvent } from "@/services/payment-events";
import { clientIpFromRequest } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LiqPay server_url callback. LiqPay POSTs application/x-www-form-urlencoded with `data` and `signature`.
 * Flow: verify signature (constant-time) -> decode -> applyPaymentEvent (idempotent, transactional).
 * Response policy:
 *   - bad/missing signature      -> 400 (never processed)
 *   - processed/duplicate/ignored -> 200 (LiqPay stops retrying)
 *   - business rejection (unknown order / mismatch) -> 200 (retrying would not help; logged + alerted)
 *   - internal error             -> 500 (LiqPay retries later)
 */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  let data = "";
  let signature = "";
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const j = (await req.json()) as { data?: string; signature?: string };
      data = j.data ?? "";
      signature = j.signature ?? "";
    } else {
      const form = await req.formData();
      data = String(form.get("data") ?? "");
      signature = String(form.get("signature") ?? "");
    }
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!data || !signature || data.length > 20_000) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  let event;
  try {
    event = getPaymentProvider("LIQPAY").parseCallback({ data, signature });
  } catch (e) {
    if (e instanceof InvalidSignatureError) {
      console.warn("[liqpay-callback] INVALID SIGNATURE", { ip });
      return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    }
    console.error("[liqpay-callback] cannot parse payload", e);
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }

  try {
    const outcome = await applyPaymentEvent(event);
    console.info("[liqpay-callback]", { order: event.providerOrderId, status: event.rawStatus, outcome: outcome.result, sandbox: event.isSandbox, prod: env().NODE_ENV });
    return NextResponse.json({ ok: true, result: outcome.result });
  } catch (e) {
    console.error("[liqpay-callback] processing failed", event.providerOrderId, e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// Browsers/health probes hitting the URL should not see anything useful.
export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
