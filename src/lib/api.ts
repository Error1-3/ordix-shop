import "server-only";
import { NextResponse } from "next/server";
import { rateLimit } from "./rate-limit";
import { clientIpFromRequest } from "./request";

export async function limited(req: Request, bucket: string, cfg: { limit: number; windowSec: number }): Promise<NextResponse | null> {
  const r = await rateLimit(`${bucket}:${clientIpFromRequest(req)}`, cfg.limit, cfg.windowSec);
  return r.ok ? null : NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } });
}

export const json = <T,>(data: T, cacheSec = 0) =>
  NextResponse.json(data, { headers: cacheSec ? { "Cache-Control": `public, s-maxage=${cacheSec}, stale-while-revalidate=${cacheSec * 5}` } : { "Cache-Control": "no-store" } });
