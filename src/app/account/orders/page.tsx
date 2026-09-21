import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/t-static";
import { listOrdersForUser } from "@/services/order-queries";
import { StatusBadge } from "@/components/order-details";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/safe-image";

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const orders = await listOrdersForUser(user.id);
  if (!orders.length) return <EmptyState icon={<PackageOpen className="h-10 w-10" />} title={t("account.noOrders")} action={<Button asChild><Link href="/catalog">{t("cart.goCatalog")}</Link></Button>} />;
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:bg-muted/40">
            <span className="flex -space-x-2">{o.items.slice(0, 3).map((i, k) => <span key={k} className="relative h-12 w-12 overflow-hidden rounded-lg bg-muted ring-2 ring-background"><SafeImage src={i.image} alt="" fill sizes="48px" className="object-contain p-1.5" /></span>)}</span>
            <span className="min-w-0 flex-1"><span className="block font-medium tnum">{o.number}</span><span className="block text-xs text-muted-foreground">{new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium" }).format(o.createdAt)}</span></span>
            <StatusBadge status={o.status} /><span className="font-semibold tnum">{formatMoney(o.total)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
