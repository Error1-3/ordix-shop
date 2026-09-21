"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission, ForbiddenError } from "@/lib/authz";
import { ORDER_STATUSES, type OrderStatusName } from "@/lib/order-status";
import { sanitizeText } from "@/lib/sanitize";
import { attachTrackingNumber, changeOrderStatus, createNovaPoshtaShipment, OrderActionError, refundOrder } from "@/services/order-lifecycle";

type R = { ok: boolean; error?: string; message?: string };

async function run(permission: Parameters<typeof requirePermission>[0], fn: (actor: Awaited<ReturnType<typeof requirePermission>>) => Promise<string | void>, orderId: string): Promise<R> {
  try {
    const actor = await requirePermission(permission);
    const message = await fn(actor);
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { ok: true, message: message ?? undefined };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "Недостатньо прав" };
    if (e instanceof OrderActionError) return { ok: false, error: e.message };
    console.error("[admin-orders]", e);
    return { ok: false, error: "Внутрішня помилка" };
  }
}

export async function adminChangeStatusAction(orderId: string, status: string, note?: string): Promise<R> {
  const to = z.enum(ORDER_STATUSES).safeParse(status);
  if (!to.success) return { ok: false, error: "Невідомий статус" };
  return run("orders.update", (actor) => changeOrderStatus(orderId, to.data as OrderStatusName, actor, note ? sanitizeText(note, 300) : undefined), orderId);
}

export async function adminCreateShipmentAction(orderId: string): Promise<R> {
  return run("orders.update", async (actor) => `ТТН ${await createNovaPoshtaShipment(orderId, actor)} створено`, orderId);
}

export async function adminAttachTtnAction(orderId: string, ttn: string): Promise<R> {
  return run("orders.update", (actor) => attachTrackingNumber(orderId, ttn, actor), orderId);
}

export async function adminRefundAction(orderId: string): Promise<R> {
  return run("orders.refund", async (actor) => {
    await refundOrder(orderId, actor);
    return "Повернення виконано";
  }, orderId);
}

export async function adminAddNoteAction(orderId: string, note: string): Promise<R> {
  return run("orders.update", async (actor) => {
    const text = sanitizeText(note, 500);
    if (!text) return;
    await db.orderEvent.create({ data: { orderId, type: "note", message: text, actorId: actor.id } });
    await audit({ actor, action: "order.note", entity: "Order", entityId: orderId, newValue: { note: text } });
  }, orderId);
}
