import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/authz";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/t-static";
import { CouponForm, emptyCoupon, type CouponRow } from "@/components/admin-widgets";

const local = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export default async function AdminCoupons() {
  await requireAdminPage("coupons.manage");
  const [coupons, categories] = await Promise.all([db.coupon.findMany({ orderBy: { createdAt: "desc" } }), db.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  const rows: CouponRow[] = coupons.map((c) => ({
    id: c.id, code: c.code, type: c.type, value: c.type === "PERCENT" ? String(c.value) : String(c.value / 100), minOrderAmount: c.minOrderAmount ? String(c.minOrderAmount / 100) : "",
    startsAt: local(c.startsAt), expiresAt: local(c.expiresAt), usageLimit: c.usageLimit ? String(c.usageLimit) : "", perCustomerLimit: c.perCustomerLimit ? String(c.perCustomerLimit) : "",
    productIds: c.productIds.join(","), categoryIds: c.categoryIds.join(","), isActive: c.isActive,
  }));
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.coupons")}</h1>
      <section><h2 className="mb-3 font-semibold">{t("admin.create")}</h2><CouponForm initial={emptyCoupon} categories={categories} /></section>
      <section className="space-y-4">{rows.map((r, i) => (
        <details key={r.id} className="rounded-xl border border-border"><summary className="flex cursor-pointer flex-wrap items-center gap-3 p-4 text-sm"><b className="font-mono">{r.code}</b><span>{r.type === "PERCENT" ? `${r.value}%` : formatMoney(Math.round(Number(r.value) * 100))}</span><span className="text-muted-foreground tnum">використано: {coupons[i]?.usedCount}{r.usageLimit ? ` / ${r.usageLimit}` : ""}</span>{!r.isActive && <span className="text-warning">вимкнено</span>}</summary><div className="p-4 pt-0"><CouponForm initial={r} categories={categories} /></div></details>
      ))}</section>
    </div>
  );
}
