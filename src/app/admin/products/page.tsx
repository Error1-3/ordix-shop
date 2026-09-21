import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/authz";
import { can } from "@/lib/rbac";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/t-static";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import { ProductRowActions } from "@/components/product-row-actions";

const PAGE = 30;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; state?: string }> }) {
  const actor = await requireAdminPage("products.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim().slice(0, 60);
  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(sp.state === "inactive" ? { isActive: false } : sp.state === "used" ? { hasUsed: true } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { variants: { some: { sku: { contains: q, mode: "insensitive" } } } }] } : {}),
  };
  const [total, rows] = await db.$transaction([
    db.product.count({ where }),
    db.product.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, select: { id: true, title: true, sku: true, price: true, stock: true, isActive: true, hasUsed: true, category: { select: { name: true } }, _count: { select: { variants: true } } } }),
  ]);
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold tracking-tight">{t("admin.products")}</h1>{can(actor.role, "products.write") && <Button asChild><Link href="/admin/products/new">{t("admin.newProduct")}</Link></Button>}</div>
      <form className="mb-5 flex flex-wrap gap-2"><input name="q" defaultValue={q} placeholder="Назва або артикул" className="h-10 min-w-56 flex-1 rounded-md border border-input px-3 text-sm" /><select name="state" defaultValue={sp.state ?? ""} className="h-10 rounded-md border border-input px-3 text-sm"><option value="">{t("common.all")}</option><option value="inactive">Неактивні</option><option value="used">З вживаними</option></select><button className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground">{t("common.search")}</button></form>
      <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Товар</th><th className="px-4 py-3">Категорія</th><th className="px-4 py-3">від</th><th className="px-4 py-3">Залишок</th><th className="px-4 py-3" /></tr></thead>
        <tbody className="divide-y divide-border">{rows.map((p) => (
          <tr key={p.id} className="hover:bg-muted/40"><td className="px-4 py-3"><Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">{p.title}</Link><div className="mt-0.5 flex gap-1.5 text-xs text-muted-foreground">{p.sku} · {p._count.variants} вар. {!p.isActive && <Badge variant="warning">неактивний</Badge>} {p.hasUsed && <Badge variant="accent">є вживані</Badge>}</div></td>
            <td className="px-4 py-3 text-muted-foreground">{p.category.name}</td><td className="px-4 py-3 tnum">{formatMoney(p.price)}</td><td className={`px-4 py-3 tnum ${p.stock <= 0 ? "text-destructive" : ""}`}>{p.stock}</td>
            <td className="px-4 py-3">{can(actor.role, "products.write") && <ProductRowActions id={p.id} active={p.isActive} canDelete={can(actor.role, "products.delete")} />}</td></tr>))}
          {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">—</td></tr>}</tbody></table></div>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} basePath="/admin/products" params={{ q: q || undefined, state: sp.state }} />
    </div>
  );
}
