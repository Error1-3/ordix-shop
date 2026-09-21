"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setUserActiveAction, setUserRoleAction, moderateReviewAction, saveCouponAction, deleteCouponAction } from "@/actions/admin-misc";
import { useT } from "@/components/i18n-provider";
import { Button } from "./ui/button";
import { Field } from "./ui/label";
import { Input, Select } from "./ui/input";

export function RoleSelect({ userId, role, active, disabled }: { userId: string; role: string; active: boolean; disabled: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ ok?: boolean; error?: string }>) => start(async () => { const r = await fn(); if (r.error) toast.error(r.error.includes(".") ? t(r.error) : r.error); router.refresh(); });
  return (
    <div className="flex items-center gap-2">
      <Select className="h-9 w-32 text-xs" defaultValue={role} disabled={disabled || pending} onChange={(e) => act(() => setUserRoleAction(userId, e.target.value))} aria-label="role">{["CUSTOMER", "STAFF", "ADMIN"].map((r) => <option key={r}>{r}</option>)}</Select>
      <Button size="sm" variant="outline" disabled={disabled || pending} onClick={() => act(() => setUserActiveAction(userId, !active))}>{active ? t("admin.deactivate") : t("admin.activate")}</Button>
    </div>
  );
}

export function ReviewButtons({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (d: "APPROVED" | "REJECTED") => start(async () => { await moderateReviewAction(id, d); router.refresh(); });
  return <div className="flex gap-2"><Button size="sm" loading={pending} onClick={() => go("APPROVED")}>{t("admin.approve")}</Button><Button size="sm" variant="outline" disabled={pending} onClick={() => go("REJECTED")}>{t("admin.reject")}</Button></div>;
}

export type CouponRow = { id?: string; code: string; type: "PERCENT" | "FIXED"; value: string; minOrderAmount: string; startsAt: string; expiresAt: string; usageLimit: string; perCustomerLimit: string; productIds: string; categoryIds: string; isActive: boolean };
export const emptyCoupon: CouponRow = { code: "", type: "PERCENT", value: "10", minOrderAmount: "", startsAt: "", expiresAt: "", usageLimit: "", perCustomerLimit: "", productIds: "", categoryIds: "", isActive: true };

export function CouponForm({ initial, categories }: { initial: CouponRow; categories: { id: string; name: string }[] }) {
  const t = useT();
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof CouponRow>(k: K, v: CouponRow[K]) => setC((s) => ({ ...s, [k]: v }));
  const submit = () => start(async () => {
    const payload = { ...c, usageLimit: c.usageLimit ? Number(c.usageLimit) : null, perCustomerLimit: c.perCustomerLimit ? Number(c.perCustomerLimit) : null,
      productIds: c.productIds.split(/[\s,]+/).filter(Boolean), categoryIds: c.categoryIds ? c.categoryIds.split(",") : [] };
    const r = await saveCouponAction(JSON.stringify(payload));
    if (r.ok) { toast.success(t("common.saved")); setErrors({}); if (!c.id) setC(emptyCoupon); router.refresh(); } else { setErrors(r.fieldErrors ?? {}); toast.error(r.error ? t(r.error) : t("common.genericError")); }
  });
  return (
    <div className="grid gap-4 rounded-xl border border-border p-5 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Код" error={errors.code}><Input value={c.code} onChange={(e) => set("code", e.target.value.toUpperCase())} /></Field>
      <Field label="Тип"><Select value={c.type} onChange={(e) => set("type", e.target.value as "PERCENT" | "FIXED")}><option value="PERCENT">%</option><option value="FIXED">₴ (фіксована)</option></Select></Field>
      <Field label={c.type === "PERCENT" ? "Відсоток (1–100)" : "Сума, ₴"} error={errors.value}><Input value={c.value} onChange={(e) => set("value", e.target.value)} inputMode="decimal" /></Field>
      <Field label="Мін. замовлення, ₴"><Input value={c.minOrderAmount} onChange={(e) => set("minOrderAmount", e.target.value)} inputMode="decimal" /></Field>
      <Field label="Діє з"><Input type="datetime-local" value={c.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Field>
      <Field label="Діє до"><Input type="datetime-local" value={c.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} /></Field>
      <Field label="Загальний ліміт"><Input value={c.usageLimit} onChange={(e) => set("usageLimit", e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></Field>
      <Field label="Ліміт на клієнта"><Input value={c.perCustomerLimit} onChange={(e) => set("perCustomerLimit", e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></Field>
      <Field label="ID товарів (через кому, порожньо = усі)"><Input value={c.productIds} onChange={(e) => set("productIds", e.target.value)} /></Field>
      <Field label="Категорії (порожньо = усі)"><Select multiple value={c.categoryIds ? c.categoryIds.split(",") : []} onChange={(e) => set("categoryIds", [...e.target.selectedOptions].map((o) => o.value).join(","))} className="h-28">{categories.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</Select></Field>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" checked={c.isActive} onChange={(e) => set("isActive", e.target.checked)} className="accent-[hsl(var(--accent))]" />Активний</label>
      <div className="flex gap-2 self-end sm:col-span-2 lg:col-span-3"><Button loading={pending} onClick={submit}>{t("common.save")}</Button>{c.id && <Button variant="destructive" onClick={() => start(async () => { if (confirm(t("admin.confirmDelete"))) { await deleteCouponAction(c.id!); router.refresh(); } })}>{t("common.delete")}</Button>}</div>
    </div>
  );
}
