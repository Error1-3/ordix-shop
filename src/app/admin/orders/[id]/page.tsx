import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdminPage } from "@/lib/authz";
import { can } from "@/lib/rbac";
import { decryptField } from "@/lib/crypto";
import { formatMoney } from "@/lib/money";
import { allowedNext, type OrderStatusName } from "@/lib/order-status";
import { t } from "@/lib/t-static";
import { StatusBadge } from "@/components/order-details";
import { AdminOrderActions } from "@/components/admin-order-actions";

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminPage("orders.read");
  const order = await db.order.findUnique({
    where: { id: (await params).id },
    include: { items: { include: { variant: { select: { id: true, usedDevice: { select: { secret: { select: { imeiEncrypted: true, serialEncrypted: true } } } } } } } }, payments: { orderBy: { createdAt: "desc" } }, shipment: true, events: { orderBy: { createdAt: "asc" } }, user: { select: { id: true, email: true } } },
  });
  if (!order) notFound();

  // Staff-only: sold device identifiers (for warranty / returns). Decrypted server-side; access is audit-logged.
  const showSecrets = can(actor.role, "usedDevice.secret.read");
  const identifiers = showSecrets
    ? order.items.map((i) => {
        const s = i.variant?.usedDevice?.secret;
        if (!s) return null;
        try { return { itemId: i.id, imei: s.imeiEncrypted ? decryptField(s.imeiEncrypted) : null, serial: s.serialEncrypted ? decryptField(s.serialEncrypted) : null }; } catch { return { itemId: i.id, imei: null, serial: null }; }
      }).filter((x): x is { itemId: string; imei: string | null; serial: string | null } => x !== null)
    : [];
  if (identifiers.length) await audit({ actor, action: "usedDevice.secret_view", entity: "Order", entityId: order.id });

  const allowed = allowedNext(order.status as OrderStatusName);
  const paidOnline = order.payments.some((p) => p.status === "PAID");
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight tnum">{order.number}</h1><StatusBadge status={order.status} /><span className="text-sm text-muted-foreground">{t(`paymentStatus.${order.paymentStatus}`)}</span></div>
      <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section><h2 className="mb-3 font-semibold">{t("account.items")}</h2>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {order.items.map((i) => { const id = identifiers.find((x) => x.itemId === i.id); return (
                <li key={i.id} className="flex flex-wrap justify-between gap-3 p-4 text-sm">
                  <div><Link href={`/admin/products/${i.productId}`} className="font-medium hover:underline">{i.title}</Link><p className="text-muted-foreground">{i.variantLabel} · {i.sku} × {i.quantity}</p>
                    {id && <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 font-mono text-xs text-warning">IMEI {id.imei ?? "—"} · S/N {id.serial ?? "—"}</p>}</div>
                  <span className="tnum">{formatMoney(i.lineTotal)}</span>
                </li>); })}
            </ul></section>
          <section className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4 text-sm"><h2 className="mb-2 font-semibold">{t("admin.customerData")}</h2><p>{order.firstName} {order.lastName}</p><p className="text-muted-foreground">{order.phone}</p><p className="text-muted-foreground">{order.email}</p>{order.user && <p className="mt-1 text-xs text-muted-foreground">Акаунт: {order.user.email}</p>}{order.comment && <p className="mt-3 whitespace-pre-line rounded bg-muted p-2 text-xs">{order.comment}</p>}</div>
            <div className="rounded-xl border border-border p-4 text-sm"><h2 className="mb-2 font-semibold">{t("account.deliveryInfo")}</h2><p>{t(`delivery.${order.deliveryMethod}`)}</p><p className="text-muted-foreground">{order.city}</p><p className="text-muted-foreground">{order.warehouseName ?? order.address}</p><p className="mt-2 tnum">{t("account.tracking")}: {order.shipment?.trackingNumber ?? "—"}</p>{order.shipment?.status && <p className="text-xs text-muted-foreground">{order.shipment.status}</p>}</div>
          </section>
          <section><h2 className="mb-3 font-semibold">{t("account.payment")}</h2>
            <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[520px] text-sm"><thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2.5">LiqPay order_id</th><th className="px-4 py-2.5">Статус</th><th className="px-4 py-2.5">raw</th><th className="px-4 py-2.5">Сума</th></tr></thead>
              <tbody className="divide-y divide-border">{order.payments.map((p) => <tr key={p.id}><td className="px-4 py-2.5 font-mono text-xs">{p.providerOrderId}</td><td className="px-4 py-2.5">{p.status}</td><td className="px-4 py-2.5 text-muted-foreground">{p.rawStatus ?? "—"}{p.failureReason ? ` (${p.failureReason})` : ""}</td><td className="px-4 py-2.5 tnum">{formatMoney(p.amount)}</td></tr>)}{order.payments.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-muted-foreground">{t(`paymentMethod.${order.paymentMethod}`)}</td></tr>}</tbody></table></div>
            <dl className="mt-3 grid grid-cols-2 gap-1 text-sm tnum sm:grid-cols-4"><div><dt className="text-xs text-muted-foreground">Разом</dt><dd>{formatMoney(order.total)}</dd></div><div><dt className="text-xs text-muted-foreground">Післяплата</dt><dd>{formatMoney(order.codAmount)}</dd></div><div><dt className="text-xs text-muted-foreground">Передоплата</dt><dd>{formatMoney(order.prepaymentAmount)}</dd></div><div><dt className="text-xs text-muted-foreground">Комісія</dt><dd>{formatMoney(order.commission)}</dd></div></dl></section>
          <section><h2 className="mb-3 font-semibold">{t("admin.timeline")}</h2>
            <ol className="space-y-2 border-l border-border pl-4 text-sm">{order.events.map((e) => <li key={e.id}><span className={e.type === "payment_alert" ? "font-medium text-destructive" : ""}>{e.message}</span> <span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(e.createdAt)}</span></li>)}</ol></section>
        </div>
        {can(actor.role, "orders.update") && (
          <AdminOrderActions orderId={order.id} allowed={allowed} canRefund={can(actor.role, "orders.refund")} canShip hasShipment={Boolean(order.shipment)} isCourier={order.deliveryMethod === "NP_COURIER"} refundable={paidOnline} />
        )}
      </div>
    </div>
  );
}
