import "server-only";
import { env } from "@/lib/env";
import { LiqPayProvider } from "./liqpay";
import type { PaymentProvider, ProviderName } from "./types";

const providers = new Map<ProviderName, PaymentProvider>();

/** Provider registry. To add WayForPay/MonoPay: implement PaymentProvider and register it here. */
export function getPaymentProvider(name: ProviderName = "LIQPAY"): PaymentProvider {
  const existing = providers.get(name);
  if (existing) return existing;
  let p: PaymentProvider;
  switch (name) {
    case "LIQPAY":
      p = new LiqPayProvider(env().LIQPAY_PUBLIC_KEY, env().LIQPAY_PRIVATE_KEY);
      break;
    default:
      throw new Error(`Payment provider ${name} is not implemented`);
  }
  providers.set(name, p);
  return p;
}
