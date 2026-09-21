import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/authz";
import { can } from "@/lib/rbac";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/t-static";
import { RoleSelect } from "@/components/admin-widgets";

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireAdminPage("customers.read");
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const users = await db.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" }, take: 100,
    select: { id: true, email: true, name: true, phone: true, role: true, isActive: true, emailVerified: true, createdAt: true, orders: { where: { status: { in: ["PAID", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"] } }, select: { total: true } } },
  });
  const manage = can(actor.role, "users.manage");
  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">{t("admin.customers")}</h1>
      <form className="mb-5"><input name="q" defaultValue={q} placeholder="E-mail або ім'я" className="h-10 w-full max-w-sm rounded-md border border-input px-3 text-sm" /></form>
      <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Клієнт</th><th className="px-4 py-3">Замовлень / сума</th><th className="px-4 py-3">Реєстрація</th><th className="px-4 py-3">Роль</th></tr></thead>
        <tbody className="divide-y divide-border">{users.map((u) => (
          <tr key={u.id}><td className="px-4 py-3"><p className="font-medium">{u.name ?? "—"} {!u.emailVerified && <span className="text-xs text-warning">(e-mail не підтверджено)</span>}</p><p className="text-xs text-muted-foreground">{u.email} {u.phone}</p></td>
            <td className="px-4 py-3 tnum">{u.orders.length} · {formatMoney(u.orders.reduce((s, o) => s + o.total, 0))}</td>
            <td className="px-4 py-3 text-muted-foreground">{new Intl.DateTimeFormat("uk-UA").format(u.createdAt)}</td>
            <td className="px-4 py-3">{manage ? <RoleSelect userId={u.id} role={u.role} active={u.isActive} disabled={u.id === actor.id} /> : u.role}</td></tr>))}</tbody></table></div>
    </div>
  );
}
