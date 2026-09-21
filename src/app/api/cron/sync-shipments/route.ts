import { NextResponse } from "next/server";
import { novaPoshtaConfigured } from "@/lib/env";
import { syncShipments } from "@/services/order-lifecycle";
import { cronAuthorized } from "../release-reservations/route";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!novaPoshtaConfigured()) return NextResponse.json({ skipped: "NOVA_POSHTA_API_KEY not set" });
  return NextResponse.json(await syncShipments());
}
