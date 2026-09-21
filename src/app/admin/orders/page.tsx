import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/authz";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUSES } from "@/lib/order-status";
import { t } from "@/lib/t-static";
import { StatusBadge } from "@/components/order-details";
import { Pagination } from "@/components/pagination";

const PAGE = 30;

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireAdminPage("orders.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim().slice(0, 60);
  const where: Prisma.OrderWhereInput = {
    ...(sp.status && (ORDER_STATUSES as readonly string[]).includes(sp.status) ? { status: sp.status as (typeof ORDER_STATUSES)[number] } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") || "___" } }, { lastName: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [total, rows] = await db.$transaction([
    db.order.count({ where }),
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, select: { id: true, number: true, status: true, paymentMethod: true, paymentStatus: true, total: true, createdAt: true, firstName: true, lastName: true, city: true } }),
  ]);
  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">{t("admin.orders")}</h1>
      <form className="mb-5 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="№, e-mail, телефон, прізвище" className="h-10 min-w-56 flex-1 rounded-md border border-input px-3 text-sm" />
        <select name="status" defaultValue={sp.status ?? ""} className="h-10 rounded-md border border-input px-3 text-sm"><option value="">{t("common.all")}</option>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{t(`orderStatus.${s}`)}</option>)}</select>
        <button className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground">{t("common.search")}</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr>{["№", t("account.date"), "Клієнт", t("account.status"), t("account.payment"), t("account.sum")].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((o) => (
              <tr key={o.id} className="hover:bg-muted/40">
                <td className="px-4 py-3 font-medium tnum"><Link className="hover:underline" href={`/admin/orders/${o.id}`}>{o.number}</Link></td>
                <td className="px-4 py-3 text-muted-foreground">{new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(o.createdAt)}</td>
                <td className="px-4 py-3">{o.firstName} {o.lastName}<span className="block text-xs text-muted-foreground">{o.city}</span></td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-xs">{t(`paymentMethod.${o.paymentMethod}`)}<span className="block text-muted-foreground">{t(`paymentStatus.${o.paymentStatus}`)}</span></td>
                <td className="px-4 py-3 font-medium tnum">{formatMoney(o.total)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">—</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} basePath="/admin/orders" params={{ q: q || undefined, status: sp.status }} />
    </div>
  );
}
