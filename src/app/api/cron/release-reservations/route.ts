import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { releaseExpiredReservations } from "@/services/order-lifecycle";

export const dynamic = "force-dynamic";

export function cronAuthorized(req: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await releaseExpiredReservations());
}
