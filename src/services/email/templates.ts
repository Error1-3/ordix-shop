import { escapeHtml } from "@/lib/sanitize";
import { formatMoney } from "@/lib/money";
import type { Mail } from "./provider";

export type EmailKind =
  | "registration" | "verification" | "password_reset"
  | "order_created" | "payment_successful" | "payment_failed" | "order_processing" | "order_shipped" | "order_delivered"
  | "order_cancelled" | "refund" | "admin_new_order" | "admin_payment_problem";

export type OrderEmailData = {
  number: string; firstName: string; total: number; items: { title: string; variantLabel: string; quantity: number; lineTotal: number }[];
  paymentMethodLabel: string; deliveryLabel: string; trackingNumber?: string | null; orderUrl: string; adminUrl?: string; note?: string;
};

type Ctx = { storeName: string; siteUrl: string; supportEmail?: string };

function layout(ctx: Ctx, title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="uk"><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;padding:28px">
<tr><td style="font-size:18px;font-weight:700;padding-bottom:16px">${escapeHtml(ctx.storeName)}</td></tr>
<tr><td style="font-size:20px;font-weight:600;padding-bottom:12px">${escapeHtml(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.55">${bodyHtml}</td></tr>
<tr><td style="padding-top:24px;font-size:12px;color:#71717a">${escapeHtml(ctx.storeName)} · <a href="${ctx.siteUrl}" style="color:#71717a">${ctx.siteUrl.replace(/^https?:\/\//, "")}</a></td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${escapeHtml(href)}" style="background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;display:inline-block;font-weight:600">${escapeHtml(label)}</a></p>`;

function itemsTable(d: OrderEmailData): string {
  const rows = d.items
    .map((i) => `<tr><td style="padding:6px 0">${escapeHtml(i.title)}<br><span style="color:#71717a;font-size:13px">${escapeHtml(i.variantLabel)} × ${i.quantity}</span></td><td align="right" style="padding:6px 0;white-space:nowrap">${formatMoney(i.lineTotal)}</td></tr>`)
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e4e4e7;margin-top:12px">${rows}<tr><td style="padding-top:10px;border-top:1px solid #e4e4e7"><b>Разом</b></td><td align="right" style="padding-top:10px;border-top:1px solid #e4e4e7"><b>${formatMoney(d.total)}</b></td></tr></table>
<p style="color:#52525b;font-size:13px">Оплата: ${escapeHtml(d.paymentMethodLabel)}<br>Доставка: ${escapeHtml(d.deliveryLabel)}</p>`;
}

const strip = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<br\s*\/?>/g, "\n").replace(/<\/(p|tr|h\d)>/g, "\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();

export function renderAuthEmail(ctx: Ctx, kind: "registration" | "verification" | "password_reset", data: { name: string; url: string }): Omit<Mail, "to"> {
  const map = {
    registration: { subject: `Вітаємо в ${ctx.storeName}`, title: `Вітаємо, ${data.name}!`, text: "Дякуємо за реєстрацію. Підтвердіть e-mail, щоб увійти в акаунт.", cta: "Підтвердити e-mail" },
    verification: { subject: "Підтвердіть e-mail", title: "Підтвердження e-mail", text: "Натисніть кнопку нижче, щоб підтвердити адресу. Посилання діє 24 години.", cta: "Підтвердити e-mail" },
    password_reset: { subject: "Відновлення пароля", title: "Відновлення пароля", text: "Ми отримали запит на зміну пароля. Посилання діє 1 годину. Якщо це були не ви — просто проігноруйте лист.", cta: "Створити новий пароль" },
  }[kind];
  const html = layout(ctx, map.title, `<p>${escapeHtml(map.text)}</p>${button(data.url, map.cta)}<p style="color:#71717a;font-size:13px">Або скопіюйте посилання: ${escapeHtml(data.url)}</p>`);
  return { subject: map.subject, html, text: `${map.title}\n\n${map.text}\n${data.url}` };
}

export function renderOrderEmail(ctx: Ctx, kind: Exclude<EmailKind, "registration" | "verification" | "password_reset">, d: OrderEmailData): Omit<Mail, "to"> {
  const n = `№${d.number}`;
  const cfg: Record<typeof kind, { subject: string; title: string; lead: string }> = {
    order_created: { subject: `Замовлення ${n} прийнято`, title: `Дякуємо за замовлення ${n}`, lead: `${d.firstName}, ми отримали ваше замовлення.` },
    payment_successful: { subject: `Оплата замовлення ${n} отримана`, title: "Оплата пройшла успішно", lead: `${d.firstName}, дякуємо! Ми почали готувати замовлення ${n}.` },
    payment_failed: { subject: `Оплата замовлення ${n} не пройшла`, title: "Оплата не пройшла", lead: `${d.firstName}, платіж за замовлення ${n} не завершено. Ви можете повторити оплату на сторінці замовлення.` },
    order_processing: { subject: `Замовлення ${n} в обробці`, title: "Замовлення в обробці", lead: `${d.firstName}, ми комплектуємо замовлення ${n}.` },
    order_shipped: { subject: `Замовлення ${n} відправлено`, title: "Замовлення відправлено", lead: `${d.firstName}, замовлення ${n} вже в дорозі.${d.trackingNumber ? ` ТТН Нової пошти: ${d.trackingNumber}.` : ""}` },
    order_delivered: { subject: `Замовлення ${n} доставлено`, title: "Замовлення доставлено", lead: `${d.firstName}, сподіваємось, все сподобалось! Будемо вдячні за відгук.` },
    order_cancelled: { subject: `Замовлення ${n} скасовано`, title: "Замовлення скасовано", lead: `${d.firstName}, замовлення ${n} скасовано.${d.note ? ` ${d.note}` : ""}` },
    refund: { subject: `Повернення коштів за замовлення ${n}`, title: "Кошти повернено", lead: `${d.firstName}, ми ініціювали повернення коштів за замовлення ${n}. Зарахування залежить від банку і зазвичай триває до кількох робочих днів.` },
    admin_new_order: { subject: `Нове замовлення ${n} — ${formatMoney(d.total)}`, title: `Нове замовлення ${n}`, lead: `Клієнт: ${d.firstName}. Сума: ${formatMoney(d.total)}.` },
    admin_payment_problem: { subject: `⚠ Потрібна дія: замовлення ${n}`, title: "Проблема з оплатою", lead: d.note ?? "Потрібна ручна перевірка платежу." },
  };
  const c = cfg[kind];
  const isAdmin = kind.startsWith("admin_");
  const link = isAdmin ? d.adminUrl ?? d.orderUrl : d.orderUrl;
  const html = layout(ctx, c.title, `<p>${escapeHtml(c.lead)}</p>${itemsTable(d)}${button(link, isAdmin ? "Відкрити в адмін-панелі" : "Переглянути замовлення")}`);
  return { subject: c.subject, html, text: strip(html) };
}
