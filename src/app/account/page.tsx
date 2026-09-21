import Link from "next/link";
import { getCurrentUser } from "@/lib/authz";
import { formatMoney } from "@/lib/money";
import { t } from "@/lib/t-static";
import { listOrdersForUser } from "@/services/order-queries";
import { StatusBadge } from "@/components/order-details";

export default async function AccountHome() {
  const user = (await getCurrentUser())!;
  const orders = (await listOrdersForUser(user.id)).slice(0, 3);
  return (
    <div>
      <p className="text-lg">{t("account.hello", { name: user.name ?? user.email })}</p>
      <h2 className="mb-4 mt-8 text-xl font-semibold">{t("account.orders")}</h2>
      {orders.length === 0 ? <p className="text-muted-foreground">{t("account.noOrders")}</p> : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {orders.map((o) => <li key={o.id}><Link href={`/account/orders/${o.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50"><span className="font-medium tnum">{o.number}</span><StatusBadge status={o.status} /><span className="tnum">{formatMoney(o.total)}</span></Link></li>)}
        </ul>
      )}
    </div>
  );
}
