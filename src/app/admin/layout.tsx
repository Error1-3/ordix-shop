import Link from "next/link";
import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/authz";
import { can, type Permission } from "@/lib/rbac";
import { t } from "@/lib/t-static";

export const metadata: Metadata = { title: "Адмін-панель", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV: { href: string; key: string; perm: Permission }[] = [
  { href: "/admin", key: "admin.dashboard", perm: "admin.access" },
  { href: "/admin/orders", key: "admin.orders", perm: "orders.read" },
  { href: "/admin/products", key: "admin.products", perm: "products.read" },
  { href: "/admin/customers", key: "admin.customers", perm: "customers.read" },
  { href: "/admin/coupons", key: "admin.coupons", perm: "coupons.manage" },
  { href: "/admin/reviews", key: "admin.reviews", perm: "reviews.moderate" },
  { href: "/admin/settings", key: "admin.settings", perm: "settings.read" },
  { href: "/admin/audit", key: "admin.audit", perm: "audit.read" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage(); // server-side gate (middleware is only the first line of defence)
  return (
    <div className="container py-6 md:py-10">
      <div className="grid gap-6 md:grid-cols-[210px_1fr] md:gap-10">
        <nav aria-label={t("admin.title")} className="flex gap-1 overflow-x-auto scrollbar-none md:flex-col">
          <p className="hidden px-3 pb-2 text-xs uppercase tracking-wider text-muted-foreground md:block">{user.role}</p>
          {NAV.filter((n) => can(user.role, n.perm)).map((n) => <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3.5 py-2.5 text-sm hover:bg-muted">{t(n.key)}</Link>)}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
