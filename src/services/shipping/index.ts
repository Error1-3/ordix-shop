import "server-only";
import { env } from "@/lib/env";
import { NovaPoshtaService, NovaPoshtaError } from "./nova-poshta";

let instance: NovaPoshtaService | null = null;

export function novaPoshta(): NovaPoshtaService {
  if (!instance) instance = new NovaPoshtaService(env().NOVA_POSHTA_API_KEY);
  return instance;
}

export function senderFromEnv() {
  const e = env();
  const s = {
    senderRef: e.NOVA_POSHTA_SENDER_REF, contactRef: e.NOVA_POSHTA_SENDER_CONTACT_REF, cityRef: e.NOVA_POSHTA_SENDER_CITY_REF,
    warehouseRef: e.NOVA_POSHTA_SENDER_WAREHOUSE_REF, phone: e.NOVA_POSHTA_SENDER_PHONE,
  };
  const missing = Object.entries(s).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new NovaPoshtaError(`Sender data missing in env (${missing.join(", ")}). Run: npx tsx scripts/np-setup.ts`);
  return s;
}
