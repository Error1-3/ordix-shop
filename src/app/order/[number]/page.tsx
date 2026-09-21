import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { t } from "@/lib/t-static";
import { getOrderByNumberForViewer } from "@/services/order-queries";
import { OrderDetails, StatusBadge } from "@/components/order-details";
import { PayAgainButton, RefundTracker } from "@/components/order-client-bits";

export const metadata: Metadata = { title: "Замовлення", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Guest-accessible order page (HMAC link from the confirmation e-mail). Owners can also open it while signed in. */
export default async function GuestOrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const order = await getOrderByNumberForViewer(decodeURIComponent(number), sp.t);
  if (!order) notFound();
  const canPay = order.status === "PAYMENT_PENDING" && order.paymentMethod !== "PAY_ON_RECEIVE" && order.paymentStatus !== "PAID" && order.payments.length > 0;
  return (
    <div className="container max-w-5xl py-10 md:py-16">
      <div className="mb-10 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">{t("checkout.result.title", { number: order.number })}</h1><StatusBadge status={order.status} /></div>
      {canPay && <div className="mb-8"><PayAgainButton orderId={order.id} token={sp.t} /></div>}
      <RefundTracker number={order.number} value={order.total} active={order.status === "REFUNDED"} />
      <OrderDetails o={order} />
    </div>
  );
}
