import "server-only";
import { db } from "@/lib/db";
import { env, siteUrl } from "@/lib/env";
import { createT, type Locale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { guestOrderUrl } from "@/lib/order-access";
import { emailProvider } from "./provider";
import { renderAuthEmail, renderOrderEmail, type EmailKind, type OrderEmailData } from "./templates";

async function ctx() {
  const s = await getSettings();
  return { storeName: s.store.name, siteUrl: siteUrl(), supportEmail: s.store.email };
}

export async function sendAuthEmail(kind: "registration" | "verification" | "password_reset", to: string, name: string, token: string) {
  const path = kind === "password_reset" ? `/reset-password?token=${token}` : `/verify-email?token=${token}`;
  const mail = renderAuthEmail(await ctx(), kind, { name, url: `${siteUrl()}${path}` });
  await emailProvider().send({ to, ...mail });
}

/** Build order e-mail data from the DB (single source of truth) and send to customer and/or admin. */
export async function sendOrderEmail(orderId: string, kind: Exclude<EmailKind, "registration" | "verification" | "password_reset">, extra: { note?: string } = {}) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true, shipment: true } });
  if (!order) return;
  const settings = await getSettings();
  const t = createT((order.locale as Locale) ?? "uk");
  const data: OrderEmailData = {
    number: order.number, firstName: order.firstName, total: order.total,
    items: order.items.map((i) => ({ title: i.title, variantLabel: i.variantLabel, quantity: i.quantity, lineTotal: i.lineTotal })),
    paymentMethodLabel: t(`paymentMethod.${order.paymentMethod}`), deliveryLabel: `${t(`delivery.${order.deliveryMethod}`)}, ${order.city}${order.warehouseName ? `, ${order.warehouseName}` : ""}`,
    trackingNumber: order.shipment?.trackingNumber, orderUrl: order.userId ? `${siteUrl()}/account/orders/${order.id}` : guestOrderUrl(order.number), adminUrl: `${siteUrl()}/admin/orders/${order.id}`, note: extra.note,
  };
  const c = await ctx();
  const mail = renderOrderEmail(c, kind, data);
  if (kind.startsWith("admin_")) {
    const to = settings.email.adminNotificationEmail || env().ADMIN_EMAIL;
    if (to) await emailProvider().send({ to, ...mail });
    return;
  }
  await emailProvider().send({ to: order.email, ...mail });
}
