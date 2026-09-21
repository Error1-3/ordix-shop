import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { t } from "@/lib/t-static";
import { getOrderByIdForUser } from "@/services/order-queries";
import { OrderDetails, StatusBadge } from "@/components/order-details";
import { CancelOrderButton, PayAgainButton } from "@/components/order-client-bits";
import { Button } from "@/components/ui/button";

export default async function AccountOrder({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("/account/orders");
  const order = await getOrderByIdForUser((await params).id, user.id); // scoped by owner => no IDOR
  if (!order) notFound();
  const unpaid = order.paymentStatus !== "PAID" && order.paymentStatus !== "PARTIALLY_PAID";
  const canPay = order.status === "PAYMENT_PENDING" && unpaid && (order as any).payments?.length > 0;
  const canCancel = (order.status === "PENDING" || order.status === "PAYMENT_PENDING") && unpaid;
  const first = order.items[0];
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center gap-3"><h2 className="text-2xl font-semibold tracking-tight">{t("account.order", { number: order.number })}</h2><StatusBadge status={order.status} /></div>
      <div className="mb-8 flex flex-wrap gap-3">
        {canPay && <PayAgainButton orderId={order.id} />}
        {canCancel && <CancelOrderButton orderId={order.id} />}
        {order.status === "DELIVERED" && first && <Button asChild variant="outline"><Link href={`/catalog?q=${encodeURIComponent(first.title)}`}>{t("account.leaveReview")}</Link></Button>}
      </div>
      <OrderDetails o={order} />
    </div>
  );
}
