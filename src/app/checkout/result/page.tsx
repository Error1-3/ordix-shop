import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { t } from "@/lib/t-static";
import { reconcileOrderPayment } from "@/services/payment-events";
import { getOrderByNumberForViewer } from "@/services/order-queries";
import { OrderDetails, StatusBadge } from "@/components/order-details";
import { PayAgainButton, PaymentPoller, PurchaseTracker } from "@/components/order-client-bits";
import { Alert } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Замовлення", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * LiqPay `result_url` landing page. IMPORTANT: arriving here proves nothing. Displayed state comes only from our DB,
 * which is updated exclusively by the signed server callback (or a server-side status query made below).
 */
export default async function CheckoutResult({ searchParams }: { searchParams: Promise<{ order?: string; t?: string }> }) {
  const sp = await searchParams;
  if (!sp.order) notFound();
  let order = await getOrderByNumberForViewer(sp.order, sp.t);
  if (!order) notFound();

  // If the callback has not arrived yet, ask LiqPay directly (server-to-server). Errors are non-fatal.
  if (order.paymentMethod === "LIQPAY_CARD" && (order.paymentStatus === "PENDING" || order.paymentStatus === "PROCESSING")) {
    try {
      await reconcileOrderPayment(order.number);
      order = (await getOrderByNumberForViewer(sp.order, sp.t)) ?? order;
    } catch (e) {
      console.warn("[result] status reconcile failed", String(e));
    }
  }

  const online = order.payments.length > 0;
  const paid = order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_PAID";
  const lastPayment = order.payments[0];
  const failed = !paid && lastPayment?.status === "FAILED" && order.status === "PAYMENT_PENDING";
  const waiting = online && !paid && !failed && order.status === "PAYMENT_PENDING";
  const cancelled = order.status === "CANCELLED";

  const Icon = paid || !online ? CheckCircle2 : failed || cancelled ? XCircle : Clock;
  const tone = paid || !online ? "text-accent" : failed || cancelled ? "text-destructive" : "text-amber-600";
  const message = paid ? t("checkout.result.paid") : !online ? t("checkout.result.created") : failed ? t("checkout.result.failed") : waiting ? t("checkout.result.pending") : t("checkout.result.checking");

  return (
    <div className="container max-w-5xl py-10 md:py-16">
      <div className="mb-10 flex flex-col items-start gap-4">
        <Icon className={`h-12 w-12 ${tone}`} strokeWidth={1.5} aria-hidden />
        <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">{t("checkout.result.title", { number: order.number })}</h1><StatusBadge status={order.status} /></div>
        <p className="text-muted-foreground" role="status">{message}</p>
        {waiting && <Alert variant="info">{t("checkout.result.notice")}</Alert>}
        {failed && <PayAgainButton orderId={order.id} token={sp.t} />}
      </div>
      <PaymentPoller active={waiting} />
      <PurchaseTracker number={order.number} value={order.total} confirmed={paid || (!online && order.status !== "CANCELLED")} />
      <OrderDetails o={order} />
    </div>
  );
}
