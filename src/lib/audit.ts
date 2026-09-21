import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { getClientIp, getUserAgent } from "./request";

/** Keys never written to the audit log, at any depth. */
const REDACT = new Set(["passwordHash", "imei", "imeiEncrypted", "serial", "serialEncrypted", "token", "privateKey", "apiKey"]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, REDACT.has(k) ? "[redacted]" : redact(v)]));
  }
  return value;
}

export type AuditInput = {
  actor: { id: string; email: string } | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
};

export async function audit(input: AuditInput, tx: Prisma.TransactionClient | typeof db = db): Promise<void> {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    ip = await getClientIp();
    userAgent = await getUserAgent();
  } catch {
    /* outside a request context (cron, seed) */
  }
  await tx.auditLog.create({
    data: {
      actorId: input.actor?.id ?? null,
      actorEmail: input.actor?.email ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      oldValue: input.oldValue === undefined ? undefined : (redact(input.oldValue) as Prisma.InputJsonValue),
      newValue: input.newValue === undefined ? undefined : (redact(input.newValue) as Prisma.InputJsonValue),
      ip,
      userAgent,
    },
  });
}
