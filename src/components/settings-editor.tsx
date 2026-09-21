"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveSettingsAction } from "@/actions/admin-misc";
import { useT } from "@/components/i18n-provider";
import { parseMoney } from "@/lib/money";
import type { SettingsKey } from "@/lib/settings-schema";
import { Button } from "./ui/button";
import { Field } from "./ui/label";
import { Input, Textarea } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type F = { path: string; label: string; type: "text" | "textarea" | "number" | "money" | "bool" | "moneyNullable" | "select"; options?: string[]; hint?: string };

export const SETTINGS_FIELDS: Record<SettingsKey, { title: string; fields: F[] }> = {
  store: { title: "Магазин", fields: [
    { path: "name", label: "Назва магазину", type: "text" }, { path: "legalName", label: "Юридична назва (ФОП/ТОВ)", type: "text" }, { path: "taxId", label: "ЄДРПОУ / ІПН", type: "text" },
    { path: "logoUrl", label: "Логотип (URL)", type: "text", hint: "Не використовуйте логотип Apple" }, { path: "phone", label: "Телефон", type: "text" }, { path: "email", label: "E-mail", type: "text" },
    { path: "address", label: "Адреса", type: "text" }, { path: "workingHours", label: "Графік роботи", type: "text" },
    { path: "social.instagram", label: "Instagram", type: "text" }, { path: "social.telegram", label: "Telegram", type: "text" }, { path: "social.facebook", label: "Facebook", type: "text" }, { path: "social.tiktok", label: "TikTok", type: "text" }, { path: "social.youtube", label: "YouTube", type: "text" },
  ] },
  payments: { title: "Оплата", fields: [
    { path: "liqpayEnabled", label: "LiqPay (картка онлайн)", type: "bool" }, { path: "codEnabled", label: "Післяплата Новою поштою", type: "bool" }, { path: "payOnReceiveEnabled", label: "Оплата при отриманні", type: "bool" },
    { path: "codPrepaymentAmount", label: "Передоплата за післяплатою, ₴ (0 = без)", type: "money" },
    { path: "codCommissionPercent", label: "Комісія за післяплату, % (з тарифів перевізника)", type: "number", hint: "0 за замовчуванням — застосунок не вгадує тарифи" },
    { path: "codCommissionFixed", label: "Комісія за післяплату, фіксована ₴", type: "money" }, { path: "codMaxTotal", label: "Макс. сума післяплати, ₴ (0 = без ліміту)", type: "money" },
  ] },
  shipping: { title: "Доставка", fields: [
    { path: "flatFee", label: "Фіксована вартість доставки, ₴ (0 = за тарифами НП)", type: "money" }, { path: "freeShippingThreshold", label: "Безкоштовно від, ₴ (порожньо = ні)", type: "moneyNullable" },
    { path: "payer", label: "Платник доставки в ЕН", type: "select", options: ["Recipient", "Sender"] }, { path: "defaultWeightGrams", label: "Вага за замовчуванням, г", type: "number" }, { path: "note", label: "Текст про доставку", type: "textarea" },
  ] },
  orders: { title: "Замовлення", fields: [
    { path: "reservationMinutes", label: "Час резерву на оплату, хв", type: "number" }, { path: "maxQuantityPerItem", label: "Макс. кількість одного товару", type: "number" },
    { path: "autoConfirmCodOrders", label: "Автопідтвердження COD", type: "bool" }, { path: "notifyAdminEmail", label: "Сповіщати адміна e-mail-ом", type: "bool" },
  ] },
  warranty: { title: "Гарантія", fields: [{ path: "newMonths", label: "Гарантія на нові, міс.", type: "number" }, { path: "usedMonths", label: "Гарантія на вживані (за замовч.), міс.", type: "number" }, { path: "text", label: "Текст", type: "textarea" }] },
  seo: { title: "SEO", fields: [{ path: "titleTemplate", label: "Шаблон title (%s)", type: "text" }, { path: "defaultTitle", label: "Title за замовчуванням", type: "text" }, { path: "defaultDescription", label: "Description", type: "textarea" }, { path: "ogImage", label: "OG-зображення (URL)", type: "text" }] },
  analytics: { title: "Аналітика", fields: [{ path: "ga4Id", label: "GA4 (G-XXXX)", type: "text" }, { path: "gtmId", label: "GTM (GTM-XXXX)", type: "text", hint: "Якщо задано GTM — GA4 підключається через нього" }, { path: "metaPixelId", label: "Meta Pixel ID", type: "text" }] },
  homepage: { title: "Головна", fields: [{ path: "heroTitle", label: "Заголовок hero", type: "text" }, { path: "heroSubtitle", label: "Підзаголовок", type: "textarea" }, { path: "announcement", label: "Стрічка оголошення", type: "text" }, { path: "showUsed", label: "Показувати «Вживані»", type: "bool" }, { path: "showRefurbished", label: "Показувати «Refurbished»", type: "bool" }] },
  email: { title: "Email", fields: [{ path: "fromName", label: "Ім'я відправника", type: "text" }, { path: "adminNotificationEmail", label: "E-mail адміна для сповіщень", type: "text" }] },
};

const get = (o: any, path: string) => path.split(".").reduce((a, k) => (a == null ? a : a[k]), o); // eslint-disable-line @typescript-eslint/no-explicit-any
function setDeep(o: any, path: string, v: unknown) { const ks = path.split("."); let cur = o; ks.slice(0, -1).forEach((k) => { cur = cur[k] ??= {}; }); cur[ks[ks.length - 1]!] = v; } // eslint-disable-line @typescript-eslint/no-explicit-any

function Group({ k, values }: { k: SettingsKey; values: unknown }) {
  const t = useT();
  const router = useRouter();
  const spec = SETTINGS_FIELDS[k];
  const init = Object.fromEntries(spec.fields.map((f) => {
    const v = get(values, f.path);
    return [f.path, f.type === "bool" ? Boolean(v) : f.type === "money" ? String((v ?? 0) / 100) : f.type === "moneyNullable" ? (v == null ? "" : String(v / 100)) : String(v ?? "")];
  }));
  const [state, setState] = useState<Record<string, string | boolean>>(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    const out: Record<string, unknown> = {};
    try {
      for (const f of spec.fields) {
        const raw = state[f.path];
        const val = f.type === "bool" ? Boolean(raw) : f.type === "number" ? Number(raw) : f.type === "money" ? parseMoney(String(raw || "0")) : f.type === "moneyNullable" ? (String(raw).trim() === "" ? null : parseMoney(String(raw))) : String(raw);
        setDeep(out, f.path, val);
      }
    } catch { toast.error("Некоректна сума"); return; }
    const r = await saveSettingsAction(k, JSON.stringify(out));
    if (r.ok) { toast.success(t("common.saved")); setErrors({}); router.refresh(); } else { setErrors(r.fieldErrors ?? {}); toast.error(r.error ? t(r.error) : t("common.genericError")); }
  });

  return (
    <div className="max-w-2xl space-y-4">
      {spec.fields.map((f) => f.type === "bool" ? (
        <label key={f.path} className="flex items-center gap-2.5 text-sm"><input type="checkbox" checked={Boolean(state[f.path])} onChange={(e) => setState((s) => ({ ...s, [f.path]: e.target.checked }))} className="h-4 w-4 accent-[hsl(var(--accent))]" />{f.label}</label>
      ) : (
        <Field key={f.path} label={f.label} hint={f.hint} error={errors[f.path]}>
          {f.type === "textarea" ? <Textarea value={String(state[f.path])} onChange={(e) => setState((s) => ({ ...s, [f.path]: e.target.value }))} />
            : f.type === "select" ? <select className="h-11 w-full rounded-md border border-input px-3 text-sm" value={String(state[f.path])} onChange={(e) => setState((s) => ({ ...s, [f.path]: e.target.value }))}>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
            : <Input value={String(state[f.path])} inputMode={f.type === "text" ? undefined : "decimal"} onChange={(e) => setState((s) => ({ ...s, [f.path]: e.target.value }))} />}
        </Field>
      ))}
      <Button loading={pending} onClick={save}>{t("common.save")}</Button>
    </div>
  );
}

export function SettingsEditor({ values, canWrite, integrations }: { values: Record<SettingsKey, unknown>; canWrite: boolean; integrations: { liqpay: boolean; liqpaySandbox: boolean; np: boolean; email: string; cloudinary: boolean } }) {
  const t = useT();
  const keys = Object.keys(SETTINGS_FIELDS) as SettingsKey[];
  const dot = (ok: boolean) => <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${ok ? "bg-accent" : "bg-destructive"}`} />;
  return (
    <div>
      <p className="mb-4 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">{t("admin.liqpayNote")}</p>
      <ul className="mb-8 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <li>{dot(integrations.liqpay)}LiqPay ключі {integrations.liqpay ? "задано" : "не задано"}</li>
        <li>{dot(!integrations.liqpaySandbox)}Sandbox {integrations.liqpaySandbox ? "УВІМКНЕНО (тільки для тестів!)" : "вимкнено"}</li>
        <li>{dot(integrations.np)}Нова пошта {integrations.np ? "ключ задано" : "ключ не задано"}</li>
        <li>{dot(integrations.email !== "console")}E-mail: {integrations.email}</li>
        <li>{dot(integrations.cloudinary)}Cloudinary {integrations.cloudinary ? "налаштовано" : "не налаштовано"}</li>
      </ul>
      <Tabs defaultValue="store">
        <TabsList>{keys.map((k) => <TabsTrigger key={k} value={k}>{SETTINGS_FIELDS[k].title}</TabsTrigger>)}</TabsList>
        {keys.map((k) => <TabsContent key={k} value={k}>{canWrite ? <Group k={k} values={values[k]} /> : <p className="text-sm text-muted-foreground">{t("errors.forbidden")}</p>}</TabsContent>)}
      </Tabs>
    </div>
  );
}
