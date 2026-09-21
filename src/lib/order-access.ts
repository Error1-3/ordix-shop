import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env, siteUrl } from "./env";

/** Guests have no account, so order pages are protected by an unguessable HMAC link (sent by e-mail and used for the payment return). */
export function signOrderAccess(orderNumber: string): string {
  return createHmac("sha256", env().AUTH_SECRET).update(`order:${orderNumber}`).digest("base64url").slice(0, 32);
}

export function verifyOrderAccess(orderNumber: string, token: string | undefined | null): boolean {
  if (!token) return false;
  const a = Buffer.from(signOrderAccess(orderNumber));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function guestOrderUrl(orderNumber: string): string {
  return `${siteUrl()}/order/${encodeURIComponent(orderNumber)}?t=${signOrderAccess(orderNumber)}`;
}
