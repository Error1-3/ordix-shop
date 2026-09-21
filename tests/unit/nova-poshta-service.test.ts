import { test } from "node:test";
import assert from "node:assert/strict";
import { NovaPoshtaError, NovaPoshtaService } from "@/services/shipping/nova-poshta";

type Call = { modelName: string; calledMethod: string; methodProperties: Record<string, unknown>; apiKey: string };
function mock(responses: Record<string, unknown[] | { error: string }>) {
  const calls: Call[] = [];
  const f = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Call;
    calls.push(body);
    const r = responses[`${body.modelName}.${body.calledMethod}`];
    if (!r) return new Response(JSON.stringify({ success: false, data: [], errors: ["unexpected"] }));
    if (!Array.isArray(r)) return new Response(JSON.stringify({ success: false, data: [], errors: [r.error], errorCodes: ["20000200068"] }));
    return new Response(JSON.stringify({ success: true, data: r, errors: [], warnings: [], info: [] }));
  }) as unknown as typeof fetch;
  return { svc: new NovaPoshtaService("TEST_KEY", f), calls };
}

test("searchCities maps settlements and returns DeliveryCity as the ref", async () => {
  const { svc, calls } = mock({ "Address.searchSettlements": [{ TotalCount: "1", Addresses: [{ Ref: "S1", DeliveryCity: "C1", MainDescription: "Київ", Area: "Київська", Region: "", Present: "м. Київ, Київська обл." }] }] });
  const cities = await svc.searchCities("Київ");
  assert.deepEqual(cities[0], { ref: "C1", settlementRef: "S1", name: "Київ", area: "Київська", region: "", present: "м. Київ, Київська обл." });
  assert.equal(calls[0]!.apiKey, "TEST_KEY");
  assert.equal(calls[0]!.methodProperties.CityName, "Київ");
});

test("searchCities ignores 1-char queries without calling the API", async () => {
  const { svc, calls } = mock({});
  assert.deepEqual(await svc.searchCities("К"), []);
  assert.equal(calls.length, 0);
});

test("getWarehouses separates branches from parcel lockers", async () => {
  const rows = [
    { Ref: "W1", Number: "1", Description: "Відділення №1", ShortAddress: "Київ, Хрещатик 1", CategoryOfWarehouse: "Branch", TotalMaxWeightAllowed: "1000" },
    { Ref: "W2", Number: "2", Description: "Поштомат №2", ShortAddress: "Київ, Січових 2", CategoryOfWarehouse: "Postomat", PlaceMaxWeightAllowed: "20" },
  ];
  const { svc } = mock({ "Address.getWarehouses": rows });
  assert.deepEqual((await svc.getWarehouses({ cityRef: "C1", kind: "locker" })).map((w) => w.ref), ["W2"]);
  assert.deepEqual((await svc.getWarehouses({ cityRef: "C1", kind: "warehouse" })).map((w) => w.ref), ["W1"]);
});

test("getWarehouses falls back to AddressGeneral when the first model name is rejected", async () => {
  const { svc, calls } = mock({ "Address.getWarehouses": { error: "Model not found" }, "AddressGeneral.getWarehouses": [{ Ref: "W1", Number: "1", Description: "Відділення №1" }] });
  const w = await svc.getWarehouses({ cityRef: "C1" });
  assert.equal(w.length, 1);
  assert.deepEqual(calls.map((c) => c.modelName), ["Address", "AddressGeneral"]);
});

test("createShipment: creates recipient, builds waybill with COD (BackwardDeliveryData) and returns the tracking number", async () => {
  const { svc, calls } = mock({
    "Counterparty.save": [{ Ref: "CP1", ContactPerson: { data: [{ Ref: "CT1" }] } }],
    "InternetDocument.save": [{ Ref: "DOC1", IntDocNumber: "20450000000001", CostOnSite: "85", EstimatedDeliveryDate: "2026-09-25" }],
  });
  const r = await svc.createShipment({
    sender: { senderRef: "S", contactRef: "SC", cityRef: "SCITY", warehouseRef: "SWH", phone: "380671112233" },
    recipient: { firstName: "Іван", lastName: "Петренко", phone: "+380 67 123 45 67" }, cityRef: "C1", warehouseRef: "W1",
    declaredValue: 3000000, weightKg: 0.6, description: "Техніка Apple, замовлення IDS-1", codAmount: 1500000, payer: "Recipient", date: new Date("2026-09-21T09:00:00Z"),
  });
  assert.equal(r.trackingNumber, "20450000000001");
  assert.equal(r.cost, 8500);
  const doc = calls.find((c) => c.calledMethod === "save" && c.modelName === "InternetDocument")!.methodProperties;
  assert.equal(doc.RecipientsPhone, "380671234567");
  assert.equal(doc.Cost, "30000");
  assert.equal(doc.ServiceType, "WarehouseWarehouse");
  assert.equal(doc.DateTime, "21.09.2026");
  assert.deepEqual(doc.BackwardDeliveryData, [{ PayerType: "Recipient", CargoType: "Money", RedeliveryString: "15000" }]);
});

test("createShipment without COD sends no BackwardDeliveryData", async () => {
  const { svc, calls } = mock({ "Counterparty.save": [{ Ref: "CP1", ContactPerson: { data: [{ Ref: "CT1" }] } }], "InternetDocument.save": [{ Ref: "D", IntDocNumber: "1" }] });
  await svc.createShipment({ sender: { senderRef: "S", contactRef: "SC", cityRef: "SCITY", warehouseRef: "SWH", phone: "380671112233" }, recipient: { firstName: "А", lastName: "Б", phone: "380671234567" }, cityRef: "C", warehouseRef: "W", declaredValue: 100000, weightKg: 0.5, description: "x", codAmount: 0, payer: "Sender" });
  assert.equal("BackwardDeliveryData" in calls.at(-1)!.methodProperties, false);
});

test("track maps status codes", async () => {
  const { svc } = mock({ "TrackingDocument.getStatusDocuments": [{ Number: "2045", StatusCode: "9", Status: "Відправлення отримано", ScheduledDeliveryDate: "2026-09-25 00:00:00" }] });
  const [t] = await svc.track([{ trackingNumber: "2045", phone: "380671234567" }]);
  assert.equal(t!.ui, "DELIVERED");
});

test("API errors are thrown as NovaPoshtaError (never swallowed)", async () => {
  const { svc } = mock({ "Address.searchSettlements": { error: "API key is invalid" } });
  await assert.rejects(svc.searchCities("Київ"), (e: unknown) => e instanceof NovaPoshtaError && /invalid/.test((e as Error).message));
});

test("missing API key is a hard error (no fake mode)", () => assert.throws(() => new NovaPoshtaService("")));
