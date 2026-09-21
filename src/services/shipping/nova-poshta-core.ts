/** Pure Nova Poshta helpers (no I/O) — unit-tested. API reference: https://developers.novaposhta.ua/documentation */

export type ShipmentUiStatus = "CREATED" | "IN_TRANSIT" | "ARRIVED" | "DELIVERED" | "RETURNING" | "CANCELLED" | "UNKNOWN";

/**
 * NP status codes (TrackingDocument.getStatusDocuments -> StatusCode). Verify against the current list in the
 * official docs before relying on a code not listed here; unknown codes map to UNKNOWN and never change order status.
 */
export function mapNpStatusCode(code: string | number | null | undefined): ShipmentUiStatus {
  const c = String(code ?? "");
  switch (c) {
    case "1": return "CREATED";
    case "2": case "3": return "CANCELLED";
    case "4": case "5": case "6": case "12": case "41": return "IN_TRANSIT";
    case "7": case "8": return "ARRIVED";
    case "9": case "10": case "11": return "DELIVERED";
    case "102": case "103": case "105": case "106": case "111": return "RETURNING";
    default: return "UNKNOWN";
  }
}

/** DD.MM.YYYY, as required by InternetDocument.save (Europe/Kyiv calendar day). */
export function formatNpDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("day")}.${g("month")}.${g("year")}`;
}

/** Parse NP date strings like "2026-09-25 00:00:00" or "25.09.2026 12:00:00". */
export function parseNpDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00Z`);
  const dmy = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(s);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T12:00:00Z`);
  return null;
}

/** NP wants phones as 380XXXXXXXXX. */
export const npPhone = (p: string) => p.replace(/\D/g, "");

export type NpWarehouseKind = "warehouse" | "locker";

export function isLocker(w: { CategoryOfWarehouse?: string; Description?: string; TypeOfWarehouse?: string }): boolean {
  if (w.CategoryOfWarehouse) return w.CategoryOfWarehouse.toLowerCase() === "postomat";
  return /поштомат|postomat/i.test(w.Description ?? "");
}

export function splitFullName(first: string, last: string) {
  return { FirstName: first.trim(), LastName: last.trim(), MiddleName: "" };
}
