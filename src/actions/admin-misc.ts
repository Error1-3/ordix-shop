"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission, ForbiddenError } from "@/lib/authz";
import { couponSchema } from "@/lib/admin-validators";
import { parseMoney } from "@/lib/money";
import { fieldErrors } from "@/lib/validators";
import { SETTINGS_SCHEMAS, type SettingsKey } from "@/lib/settings-schema";
import { saveSetting } from "@/lib/settings";
import { revalidateCatalog } from "@/services/catalog";
import type { ActionState } from "@/lib/action-state";

const forbidden: ActionState = { error: "errors.forbidden" };

export async function saveCouponAction(payloadJson: string): Promise<ActionState> {
  let actor;
  try { actor = await requirePermission("coupons.manage"); } catch { return forbidden; }
  let raw: unknown;
  try { raw = JSON.parse(payloadJson); } catch { return { error: "common.genericError" }; }
  const parsed = couponSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const c = parsed.data;
  const value = c.type === "PERCENT" ? Number(c.value) : parseMoney(String(c.value));
  const data = {
    code: c.code, type: c.type, value, minOrderAmount: c.minOrderAmount, startsAt: c.startsAt, expiresAt: c.expiresAt, usageLimit: c.usageLimit,
    perCustomerLimit: c.perCustomerLimit, productIds: c.productIds, categoryIds: c.categoryIds, isActive: c.isActive,
  };
  try {
    const before = c.id ? await db.coupon.findUnique({ where: { id: c.id } }) : null;
    const saved = c.id ? await db.coupon.update({ where: { id: c.id }, data }) : await db.coupon.create({ data });
    await audit({ actor, action: c.id ? "coupon.update" : "coupon.create", entity: "Coupon", entityId: saved.id, oldValue: before, newValue: data });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { fieldErrors: { code: "Такий промокод уже існує" } };
    throw e;
  }
  revalidatePath("/admin/coupons");
  return { ok: true, message: "common.saved" };
}

export async function deleteCouponAction(id: string) {
  const actor = await requirePermission("coupons.manage");
  const used = await db.couponUsage.count({ where: { couponId: id } });
  if (used > 0) await db.coupon.update({ where: { id }, data: { isActive: false } }); // keep history
  else await db.coupon.delete({ where: { id } });
  await audit({ actor, action: used > 0 ? "coupon.deactivate" : "coupon.delete", entity: "Coupon", entityId: id });
  revalidatePath("/admin/coupons");
}

export async function moderateReviewAction(id: string, decision: "APPROVED" | "REJECTED") {
  const actor = await requirePermission("reviews.moderate");
  if (decision !== "APPROVED" && decision !== "REJECTED") throw new Error("bad decision");
  await db.$transaction(async (tx) => {
    const r = await tx.review.update({ where: { id }, data: { status: decision } });
    const agg = await tx.review.aggregate({ where: { productId: r.productId, status: "APPROVED" }, _sum: { rating: true }, _count: true });
    await tx.product.update({ where: { id: r.productId }, data: { ratingSum: agg._sum.rating ?? 0, ratingCount: agg._count } });
    await audit({ actor, action: "review.moderate", entity: "Review", entityId: id, newValue: { decision } }, tx);
  });
  revalidateCatalog();
  revalidatePath("/admin/reviews");
}

export async function saveSettingsAction(key: string, payloadJson: string): Promise<ActionState> {
  let actor: Awaited<ReturnType<typeof requirePermission>>;
  try { actor = await requirePermission("settings.write"); } catch (e) { return e instanceof ForbiddenError ? forbidden : { error: "common.genericError" }; }
  if (!(key in SETTINGS_SCHEMAS)) return { error: "common.genericError" };
  let raw: unknown;
  try { raw = JSON.parse(payloadJson); } catch { return { error: "common.genericError" }; }
  const parsed = SETTINGS_SCHEMAS[key as SettingsKey].safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), error: "common.genericError" };
  const before = await db.siteSettings.findUnique({ where: { key } });
  await saveSetting(key as SettingsKey, parsed.data);
  await audit({ actor, action: "settings.update", entity: "SiteSettings", entityId: key, oldValue: before?.value, newValue: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true, message: "common.saved" };
}

export async function setUserRoleAction(userId: string, role: string): Promise<ActionState> {
  let actor;
  try { actor = await requirePermission("users.manage"); } catch { return forbidden; }
  const r = z.enum(["CUSTOMER", "STAFF", "ADMIN"]).safeParse(role);
  if (!r.success) return { error: "common.genericError" };
  if (userId === actor.id) return { error: "Не можна змінити власну роль" }; // prevents accidental lock-out
  const before = await db.user.findUnique({ where: { id: userId }, select: { role: true, email: true } });
  await db.user.update({ where: { id: userId }, data: { role: r.data } });
  await audit({ actor, action: "user.role_change", entity: "User", entityId: userId, oldValue: before, newValue: { role: r.data } });
  revalidatePath("/admin/customers");
  return { ok: true };
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionState> {
  let actor;
  try { actor = await requirePermission("users.manage"); } catch { return forbidden; }
  if (userId === actor.id) return { error: "Не можна деактивувати себе" };
  await db.user.update({ where: { id: userId }, data: { isActive: active } });
  await audit({ actor, action: active ? "user.activate" : "user.deactivate", entity: "User", entityId: userId });
  revalidatePath("/admin/customers");
  return { ok: true };
}
