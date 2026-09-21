import "server-only";
import { headers } from "next/headers";
import { siteUrl } from "./env";

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown").slice(0, 64);
}

export async function getUserAgent(): Promise<string | null> {
  return (await headers()).get("user-agent")?.slice(0, 300) ?? null;
}

/** CSRF defence for state-changing route handlers: Origin (or Referer) must be our own site. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") ?? (req.headers.get("referer") ? new URL(req.headers.get("referer")!).origin : null);
  if (!origin) return false;
  return origin === siteUrl() || origin === new URL(req.url).origin;
}

export function clientIpFromRequest(req: Request): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}
