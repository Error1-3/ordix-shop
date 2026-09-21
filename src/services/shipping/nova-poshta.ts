import "server-only";
import { minorToDecimal } from "@/lib/money";
import {
  formatNpDate, isLocker, mapNpStatusCode, npPhone, parseNpDate, type NpWarehouseKind, type ShipmentUiStatus,
} from "./nova-poshta-core";

const API_URL = "https://api.novaposhta.ua/v2.0/json/";

export class NovaPoshtaError extends Error {
  constructor(message: string, public readonly codes: string[] = []) {
    super(message);
    this.name = "NovaPoshtaError";
  }
}

type NpResponse<T> = { success: boolean; data: T[]; errors: string[]; warnings: unknown[]; info: unknown; errorCodes?: string[] };

export type NpCity = { ref: string; settlementRef: string; name: string; area: string; region: string; present: string };
export type NpWarehouse = { ref: string; number: string; name: string; address: string; kind: NpWarehouseKind; maxWeightKg: number | null };

export type NpSender = { senderRef: string; contactRef: string; cityRef: string; warehouseRef: string; phone: string };

export type CreateShipmentInput = {
  sender: NpSender;
  recipient: { firstName: string; lastName: string; phone: string; email?: string };
  cityRef: string;
  warehouseRef: string;
  /** Declared value, minor units. */
  declaredValue: number;
  weightKg: number;
  description: string;
  /** Minor units the carrier must collect from the recipient (COD). 0 = none. */
  codAmount: number;
  payer: "Recipient" | "Sender";
  seats?: number;
  date?: Date;
};

export class NovaPoshtaService {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new NovaPoshtaError("NOVA_POSHTA_API_KEY is not configured");
  }

  private async call<T>(modelName: string, calledMethod: string, methodProperties: Record<string, unknown> = {}): Promise<T[]> {
    const res = await this.fetchImpl(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The API key is sent in the JSON body by the carrier's design. It exists only on the server.
      body: JSON.stringify({ apiKey: this.apiKey, modelName, calledMethod, methodProperties }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new NovaPoshtaError(`Nova Poshta HTTP ${res.status}`);
    const json = (await res.json()) as NpResponse<T>;
    if (!json.success) throw new NovaPoshtaError(json.errors?.join("; ") || "Nova Poshta request failed", json.errorCodes ?? []);
    return json.data ?? [];
  }

  /** Address.searchSettlements — city autocomplete. `ref` (DeliveryCity) is what warehouses and waybills need. */
  async searchCities(query: string, limit = 15): Promise<NpCity[]> {
    if (query.trim().length < 2) return [];
    type R = { TotalCount?: string; Addresses: { Ref: string; DeliveryCity: string; MainDescription: string; Area: string; Region: string; Present: string }[] };
    const data = await this.call<R>("Address", "searchSettlements", { CityName: query.trim(), Limit: String(limit), Page: "1" });
    return (data[0]?.Addresses ?? []).map((a) => ({
      ref: a.DeliveryCity, settlementRef: a.Ref, name: a.MainDescription, area: a.Area, region: a.Region, present: a.Present,
    })).filter((c) => Boolean(c.ref));
  }

  /** Address.getWarehouses — branches and parcel lockers of a city. */
  async getWarehouses(opts: { cityRef: string; query?: string; kind?: NpWarehouseKind; limit?: number; page?: number }): Promise<NpWarehouse[]> {
    type W = { Ref: string; Number: string; Description: string; ShortAddress?: string; CategoryOfWarehouse?: string; TypeOfWarehouse?: string; TotalMaxWeightAllowed?: string; PlaceMaxWeightAllowed?: string };
    const props = { CityRef: opts.cityRef, FindByString: opts.query ?? "", Limit: String(opts.limit ?? 60), Page: String(opts.page ?? 1), Language: "UA" };
    let rows: W[];
    try {
      rows = await this.call<W>("Address", "getWarehouses", props);
    } catch (e) {
      // NP documents the method under both model names in different places; fall back once.
      if (!(e instanceof NovaPoshtaError)) throw e;
      rows = await this.call<W>("AddressGeneral", "getWarehouses", props);
    }
    return rows
      .map<NpWarehouse>((w) => ({
        ref: w.Ref, number: w.Number, name: w.Description, address: w.ShortAddress ?? "",
        kind: isLocker(w) ? "locker" : "warehouse",
        maxWeightKg: Number(w.TotalMaxWeightAllowed ?? w.PlaceMaxWeightAllowed) || null,
      }))
      .filter((w) => !opts.kind || w.kind === opts.kind);
  }

  /** Counterparty.save — creates the private-person recipient; returns Counterparty and ContactPerson refs. */
  async createRecipient(r: CreateShipmentInput["recipient"]): Promise<{ counterpartyRef: string; contactRef: string }> {
    type C = { Ref: string; ContactPerson?: { data?: { Ref: string }[] } };
    const data = await this.call<C>("Counterparty", "save", {
      FirstName: r.firstName, LastName: r.lastName, MiddleName: "", Phone: npPhone(r.phone), Email: r.email ?? "",
      CounterpartyType: "PrivatePerson", CounterpartyProperty: "Recipient",
    });
    const c = data[0];
    const contactRef = c?.ContactPerson?.data?.[0]?.Ref;
    if (!c?.Ref || !contactRef) throw new NovaPoshtaError("Nova Poshta did not return recipient refs");
    return { counterpartyRef: c.Ref, contactRef };
  }

  /** InternetDocument.save — creates the waybill (ЕН). Supports warehouse/locker delivery with optional COD. */
  async createShipment(input: CreateShipmentInput): Promise<{ trackingNumber: string; documentRef: string; cost: number | null; estimatedDelivery: Date | null; raw: unknown }> {
    const rec = await this.createRecipient(input.recipient);
    const props: Record<string, unknown> = {
      PayerType: input.payer,
      PaymentMethod: "Cash",
      DateTime: formatNpDate(input.date ?? new Date()),
      CargoType: "Parcel",
      Weight: String(Math.max(0.1, input.weightKg)),
      ServiceType: "WarehouseWarehouse",
      SeatsAmount: String(input.seats ?? 1),
      Description: input.description.slice(0, 100),
      Cost: String(Math.max(1, Math.round(minorToDecimal(input.declaredValue)))),
      CitySender: input.sender.cityRef,
      Sender: input.sender.senderRef,
      SenderAddress: input.sender.warehouseRef,
      ContactSender: input.sender.contactRef,
      SendersPhone: npPhone(input.sender.phone),
      CityRecipient: input.cityRef,
      Recipient: rec.counterpartyRef,
      RecipientAddress: input.warehouseRef,
      ContactRecipient: rec.contactRef,
      RecipientsPhone: npPhone(input.recipient.phone),
    };
    if (input.codAmount > 0) {
      props.BackwardDeliveryData = [{ PayerType: "Recipient", CargoType: "Money", RedeliveryString: String(Math.round(minorToDecimal(input.codAmount))) }];
    }
    type D = { Ref: string; IntDocNumber: string; CostOnSite?: string; EstimatedDeliveryDate?: string };
    const data = await this.call<D>("InternetDocument", "save", props);
    const d = data[0];
    if (!d?.IntDocNumber) throw new NovaPoshtaError("Nova Poshta did not return a tracking number");
    return {
      trackingNumber: d.IntDocNumber, documentRef: d.Ref, cost: d.CostOnSite ? Math.round(Number(d.CostOnSite) * 100) : null,
      estimatedDelivery: parseNpDate(d.EstimatedDeliveryDate), raw: d,
    };
  }

  /** TrackingDocument.getStatusDocuments. Phone is required by NP for most keys; pass the recipient's. */
  async track(items: { trackingNumber: string; phone?: string }[]): Promise<{
    trackingNumber: string; statusCode: string; status: string; ui: ShipmentUiStatus; estimatedDelivery: Date | null; raw: unknown;
  }[]> {
    if (!items.length) return [];
    type T = { Number: string; StatusCode: string; Status: string; ScheduledDeliveryDate?: string };
    const data = await this.call<T>("TrackingDocument", "getStatusDocuments", {
      Documents: items.map((i) => ({ DocumentNumber: i.trackingNumber, Phone: i.phone ? npPhone(i.phone) : "" })),
    });
    return data.map((d) => ({
      trackingNumber: d.Number, statusCode: String(d.StatusCode), status: d.Status, ui: mapNpStatusCode(d.StatusCode),
      estimatedDelivery: parseNpDate(d.ScheduledDeliveryDate), raw: d,
    }));
  }

  // ── One-time setup helpers (used by scripts/np-setup.ts to discover sender refs) ──
  getSenders() {
    return this.call<{ Ref: string; Description: string; CounterpartyType: string }>("Counterparty", "getCounterparties", { CounterpartyProperty: "Sender", Page: "1" });
  }
  getSenderContacts(counterpartyRef: string) {
    return this.call<{ Ref: string; Description: string; Phones: string }>("Counterparty", "getCounterpartyContactPersons", { Ref: counterpartyRef, Page: "1" });
  }
  getSenderAddresses(counterpartyRef: string) {
    return this.call<{ Ref: string; Description: string; CityRef: string }>("Counterparty", "getCounterpartyAddresses", { Ref: counterpartyRef, CounterpartyProperty: "Sender" });
  }
}
