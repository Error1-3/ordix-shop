import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { AuthTokenType } from "@prisma/client";
import { db } from "./db";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

const TTL_MS: Record<AuthTokenType, number> = {
  EMAIL_VERIFY: 24 * 3600_000,
  PASSWORD_RESET: 60 * 60_000,
  NEWSLETTER_CONFIRM: 7 * 24 * 3600_000,
};

/** Returns the raw token (goes into the e-mail link). Only its SHA-256 is stored. Older unused tokens of the same type are invalidated. */
export async function issueToken(email: string, type: AuthTokenType, userId?: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await db.authToken.deleteMany({ where: { email, type, usedAt: null } });
  await db.authToken.create({
    data: { email, type, userId: userId ?? null, tokenHash: hash(raw), expiresAt: new Date(Date.now() + TTL_MS[type]) },
  });
  return raw;
}

/** Atomically consumes a token (single use). Returns the email or null. */
export async function consumeToken(raw: string, type: AuthTokenType): Promise<{ email: string; userId: string | null } | null> {
  const tokenHash = hash(raw);
  const res = await db.authToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (res.count !== 1) return null;
  const t = await db.authToken.findUnique({ where: { tokenHash } });
  return t ? { email: t.email, userId: t.userId } : null;
}

export async function peekToken(raw: string, type: AuthTokenType): Promise<boolean> {
  const t = await db.authToken.findUnique({ where: { tokenHash: hash(raw) } });
  return Boolean(t && t.type === type && !t.usedAt && t.expiresAt > new Date());
}
