import "server-only";
import { env } from "./env";

type Result = { ok: boolean; remaining: number; retryAfterSec: number };

/**
 * Fixed-window rate limiter.
 *  - Upstash Redis REST when UPSTASH_REDIS_REST_URL/TOKEN are set (correct for multi-instance / serverless).
 *  - In-memory fallback otherwise (per-process only — fine for a single Docker container / local dev).
 */
const memory = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, limit: number, windowSec: number): Result {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    if (memory.size > 10_000) for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  entry.count += 1;
  return { ok: entry.count <= limit, remaining: Math.max(0, limit - entry.count), retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
}

async function upstashLimit(key: string, limit: number, windowSec: number): Promise<Result> {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = env();
  const bucket = `rl:${key}:${Math.floor(Date.now() / (windowSec * 1000))}`;
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([["INCR", bucket], ["EXPIRE", bucket, String(windowSec)]]),
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const json = (await res.json()) as { result: number }[];
  const count = Number(json[0]?.result ?? 1);
  return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfterSec: windowSec };
}

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<Result> {
  const e = env();
  if (e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await upstashLimit(key, limit, windowSec);
    } catch (err) {
      console.error("[rate-limit] Upstash failed, falling back to memory", err);
    }
  }
  return memoryLimit(key, limit, windowSec);
}

export const LIMITS = {
  login: { limit: 8, windowSec: 15 * 60 },
  register: { limit: 5, windowSec: 60 * 60 },
  forgotPassword: { limit: 4, windowSec: 60 * 60 },
  checkout: { limit: 10, windowSec: 10 * 60 },
  cart: { limit: 60, windowSec: 60 },
  search: { limit: 60, windowSec: 60 },
  newsletter: { limit: 5, windowSec: 60 * 60 },
  review: { limit: 5, windowSec: 60 * 60 },
  npLookup: { limit: 60, windowSec: 60 },
  coupon: { limit: 15, windowSec: 10 * 60 },
} as const;
