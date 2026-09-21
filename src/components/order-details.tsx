import Link from "next/link";
import { t } from "@/lib/t-static";
import { formatMoney } from "@/lib/money";
import type { OrderView } from "@/services/order-queries";
import { Badge } from "./ui/misc";
import { SafeImage } from "./safe-image";

const STATUS_TONE: Record<string, "default" | "accent" | "warning" | "destructive" | "dark"> = {
  PENDING: "default", PAYMENT_PENDING: "warning", PAID: "accent", PROCESSING: "accent", PACKED: "accent", SHIPPED: "dark", DELIVERED: "accent",
  CANCELLED: "destructive", REFUNDED: "default", RETURN_REQUESTED: "warning", RETURNED: "default",
};
export const StatusBadge = ({ status }: { status: string }) => <Badge variant={STATUS_TONE[status] ?? "default"}>{t(`orderStatus.${status}`)}</Badge>;

const date = (d: Date) => new Intl.DateTimeFormat("uk-UA", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(d);

/** Server component: what the customer sees about an order. Uses only the OrderView projection. */
export function OrderDetails({ o }: { o: OrderView }) {
  const codPending = o.paymentMethod !== "LIQPAY_CARD";
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div className="space-y-10">
        <section aria-labelledby="o-items">
          <h2 id="o-items" className="mb-4 text-lg font-semibold">{t("account.items")}</h2>
          <ul className="divide-y divide-border border-y border-border">
            {o.items.map((i) => (
              <li key={i.id} className="flex items-center gap-4 py-4">
                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted"><SafeImage src={i.image} alt="" fill sizes="64px" className="object-contain p-2" /></span>
                <span className="min-w-0 flex-1"><span className="block font-medium">{i.title}</span><span className="block text-sm text-muted-foreground">{i.variantLabel} · {i.quantity} {t("common.pcs")} · {t("product.warranty")} {t("product.months", { n: i.warrantyMonths })}</span></span>
                <span className="tnum">{formatMoney(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="o-delivery">
          <h2 id="o-delivery" className="mb-4 text-lg font-semibold">{t("account.deliveryInfo")}</h2>
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">{t("delivery.NP_WAREHOUSE").split(" — ")[0]}</dt><dd className="font-medium">{t(`delivery.${o.deliveryMethod}`)}</dd></div>
            <div><dt className="text-muted-foreground">{t("checkout.city")}</dt><dd className="font-medium">{o.city}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">{o.address ? t("checkout.address") : t("checkout.warehouse")}</dt><dd className="font-medium">{o.address ?? o.warehouseName}</dd></div>
            <div><dt className="text-muted-foreground">{t("account.tracking")}</dt><dd className="font-medium tnum">{o.shipment?.trackingNumber ? <a className="underline" target="_blank" rel="noopener noreferrer" href={`https://novaposhta.ua/tracking/?cargo_number=${o.shipment.trackingNumber}`}>{o.shipment.trackingNumber}</a> : <span className="font-normal text-muted-foreground">{t("account.noTracking")}</span>}</dd></div>
            {o.shipment?.status && <div><dt className="text-muted-foreground">{t("account.trackingStatus")}</dt><dd className="font-medium">{o.shipment.status}</dd></div>}
          </dl>
        </section>

        {o.events.length > 0 && (
          <section aria-labelledby="o-hist">
            <h2 id="o-hist" className="mb-4 text-lg font-semibold">{t("account.history")}</h2>
            <ol className="relative space-y-4 border-l border-border pl-5">
              {o.events.map((e) => <li key={e.id} className="text-sm"><span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-accent" /><p>{e.message}</p><p className="text-xs text-muted-foreground">{date(e.createdAt)}</p></li>)}
            </ol>
          </section>
        )}
      </div>

      <aside className="h-fit rounded-2xl border border-border p-6">
        <dl className="space-y-2.5 text-sm tnum">
          <div className="flex justify-between"><dt className="text-muted-foreground">{t("cart.subtotal")}</dt><dd>{formatMoney(o.subtotal)}</dd></div>
          {o.discountTotal > 0 && <div className="flex justify-between text-accent"><dt>{t("cart.discount")}{o.couponCode ? ` (${o.couponCode})` : ""}</dt><dd>−{formatMoney(o.discountTotal)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted-foreground">{t("cart.shipping")}</dt><dd>{o.deliveryCost > 0 ? formatMoney(o.deliveryCost) : t("cart.shippingCarrier")}</dd></div>
          {o.commission > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">{t("checkout.commission")}</dt><dd>{formatMoney(o.commission)}</dd></div>}
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold"><dt>{t("cart.total")}</dt><dd>{formatMoney(o.total)}</dd></div>
        </dl>
        <div className="mt-5 space-y-1.5 border-t border-border pt-5 text-sm">
          <p><span className="text-muted-foreground">{t("account.payment")}: </span>{t(`paymentMethod.${o.paymentMethod}`)}</p>
          <p><span className="text-muted-foreground">{t("account.status")}: </span>{t(`paymentStatus.${o.paymentStatus}`)}</p>
          {codPending && o.prepaymentAmount > 0 && <p className="text-muted-foreground tnum">{t("checkout.prepayment")}: {formatMoney(o.prepaymentAmount)}</p>}
          {codPending && o.codAmount > 0 && <p className="text-muted-foreground tnum">{t("checkout.codAmount")}: {formatMoney(o.codAmount)}</p>}
          <p className="pt-1 text-xs text-muted-foreground">{date(o.createdAt)}</p>
        </div>
        <Link href="/catalog" className="mt-5 block text-sm text-accent">{t("checkout.result.toCatalog")} →</Link>
      </aside>
    </div>
  );
}
