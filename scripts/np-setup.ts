/**
 * One-time helper: prints the Nova Poshta sender refs you must put into .env.
 *   NOVA_POSHTA_API_KEY=... npx tsx scripts/np-setup.ts
 * Calls the real NP API (Counterparty.getCounterparties / getCounterpartyContactPersons / getCounterpartyAddresses).
 */
const KEY = process.env.NOVA_POSHTA_API_KEY;
if (!KEY) { console.error("Set NOVA_POSHTA_API_KEY first."); process.exit(1); }

async function call<T>(modelName: string, calledMethod: string, methodProperties: object = {}): Promise<T[]> {
  const res = await fetch("https://api.novaposhta.ua/v2.0/json/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: KEY, modelName, calledMethod, methodProperties }) });
  const j = (await res.json()) as { success: boolean; data: T[]; errors: string[] };
  if (!j.success) throw new Error(j.errors.join("; "));
  return j.data;
}

(async () => {
  const senders = await call<{ Ref: string; Description: string }>("Counterparty", "getCounterparties", { CounterpartyProperty: "Sender", Page: "1" });
  if (!senders.length) throw new Error("No sender counterparties found in this NP account.");
  for (const s of senders) {
    console.log(`\n# Sender: ${s.Description}\nNOVA_POSHTA_SENDER_REF=${s.Ref}`);
    const contacts = await call<{ Ref: string; Description: string; Phones: string }>("Counterparty", "getCounterpartyContactPersons", { Ref: s.Ref, Page: "1" });
    for (const c of contacts) console.log(`# contact: ${c.Description} (${c.Phones})\nNOVA_POSHTA_SENDER_CONTACT_REF=${c.Ref}\nNOVA_POSHTA_SENDER_PHONE=${c.Phones}`);
    const addrs = await call<{ Ref: string; Description: string; CityRef: string }>("Counterparty", "getCounterpartyAddresses", { Ref: s.Ref, CounterpartyProperty: "Sender" });
    for (const a of addrs) console.log(`# address: ${a.Description}\nNOVA_POSHTA_SENDER_WAREHOUSE_REF=${a.Ref}\nNOVA_POSHTA_SENDER_CITY_REF=${a.CityRef}`);
  }
  console.log("\nCopy the lines you need (one set) into .env / hosting environment variables.");
})().catch((e) => { console.error("Failed:", e.message); process.exit(1); });
