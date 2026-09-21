import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/authz";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/t-static";

const SOLD = ["PAID", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"] as const;

export default async function Dashboard() {
  await requireAdminPage();
  const since = new Date(Date.now() - 30 * 86400_000);
  const since14 = new Date(Date.now() - 14 * 86400_000);
  const [rev, orders, paid, pending, customers, products, usedReady, usedTotal, lowStock, byDay, top] = await Promise.all([
    db.order.aggregate({ where: { createdAt: { gte: since }, status: { in: [...SOLD] } }, _sum: { total: true } }),
    db.order.count({ where: { createdAt: { gte: since } } }),
    db.order.count({ where: { createdAt: { gte: since }, paymentStatus: { in: ["PAID", "PARTIALLY_PAID", "COD_COLLECTED"] } } }),
    db.order.count({ where: { status: { in: ["PENDING", "PAYMENT_PENDING"] } } }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.product.count({ where: { isActive: true, deletedAt: null } }),
    db.usedDevice.count({ where: { status: "READY" } }),
    db.usedDevice.count(),
    db.$queryRaw<{ id: string; title: string; sku: string; available: number }[]>`
      SELECT p.id, p.title, v.sku, (i."stock" - i."reservedStock")::int AS available
      FROM "Inventory" i JOIN "ProductVariant" v ON v.id = i."variantId" JOIN "Product" p ON p.id = v."productId"
      WHERE v."isActive" AND p."isActive" AND p."deletedAt" IS NULL AND (i."stock" - i."reservedStock") <= i."lowStockThreshold"
      ORDER BY available ASC LIMIT 8`,
    db.$queryRaw<{ day: Date; total: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, SUM("total")::bigint AS total FROM "Order"
      WHERE "createdAt" >= ${since14} AND "status" IN ('PAID','PROCESSING','PACKED','SHIPPED','DELIVERED') GROUP BY 1 ORDER BY 1`,
    db.orderItem.groupBy({ by: ["productId", "title"], where: { order: { createdAt: { gte: since }, status: { in: [...SOLD] } } }, _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { lineTotal: "desc" } }, take: 5 }),
  ]);

  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(since14.getTime() + (i + 1) * 86400_000); return d.toISOString().slice(0, 10); });
  const map = new Map<string, number>(byDay.map((r) => [r.day.toISOString().slice(0, 10), Number(r.total)] as const));
  const series = days.map((d) => ({ d, v: map.get(d) ?? 0 }));
  const max = Math.max(1, ...series.map((s) => s.v));

  const stats = [
    { l: t("admin.revenue"), v: formatMoney(rev._sum.total ?? 0) }, { l: t("admin.ordersCount"), v: orders }, { l: t("admin.paidOrders"), v: paid }, { l: t("admin.pendingOrders"), v: pending },
    { l: t("admin.customersCount"), v: customers }, { l: t("admin.productsCount"), v: products }, { l: t("admin.usedDevices"), v: `${usedReady} / ${usedTotal}` }, { l: t("admin.lowStock"), v: lowStock.length },
  ];
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => <div key={s.l} className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">{s.l}</p><p className="mt-1.5 text-2xl font-semibold tracking-tight tnum">{s.v}</p></div>)}
      </div>
      <section>
        <h2 className="mb-4 text-lg font-semibold">{t("admin.sales")}</h2>
        <div className="flex h-44 items-end gap-1.5 rounded-xl border border-border p-4" role="img" aria-label={t("admin.sales")}>
          {series.map((s) => <div key={s.d} className="group relative flex-1"><div className="w-full rounded-t bg-accent/80 transition-colors group-hover:bg-accent" style={{ height: `${Math.max(2, (s.v / max) * 100)}%` }} /><span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 text-[11px] text-primary-foreground group-hover:block">{s.d.slice(5)}: {formatMoney(s.v)}</span></div>)}
        </div>
      </section>
      <div className="grid gap-8 lg:grid-cols-2">
        <section><h2 className="mb-3 text-lg font-semibold">{t("admin.topProducts")}</h2>
          <ul className="divide-y divide-border rounded-xl border border-border">{top.length === 0 && <li className="p-4 text-sm text-muted-foreground">—</li>}{top.map((r) => <li key={r.productId} className="flex justify-between gap-3 p-3.5 text-sm"><span className="truncate">{r.title}</span><span className="tnum text-muted-foreground">{r._sum.quantity} {t("common.pcs")} · {formatMoney(r._sum.lineTotal ?? 0)}</span></li>)}</ul></section>
        <section><h2 className="mb-3 text-lg font-semibold">{t("admin.lowStock")}</h2>
          <ul className="divide-y divide-border rounded-xl border border-border">{lowStock.length === 0 && <li className="p-4 text-sm text-muted-foreground">—</li>}{lowStock.map((r) => <li key={r.sku}><Link href={`/admin/products/${r.id}`} className="flex justify-between gap-3 p-3.5 text-sm hover:bg-muted/50"><span className="truncate">{r.title} <span className="text-muted-foreground">{r.sku}</span></span><span className={`tnum font-medium ${r.available <= 0 ? "text-destructive" : "text-warning"}`}>{r.available}</span></Link></li>)}</ul></section>
      </div>
    </div>
  );
}
