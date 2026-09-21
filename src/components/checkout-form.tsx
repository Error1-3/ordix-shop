"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Banknote, CreditCard, PackageCheck } from "lucide-react";
import { placeOrderAction, type CheckoutState } from "@/actions/checkout";
import { useT } from "@/components/i18n-provider";
import { useMe } from "@/components/session-provider";
import { computeOrderTotals } from "@/lib/pricing";
import { formatMoney } from "@/lib/money";
import { track } from "@/lib/analytics";
import type { CartView } from "@/services/cart";
import { Alert } from "./ui/misc";
import { Button } from "./ui/button";
import { Field } from "./ui/label";
import { Input, Textarea } from "./ui/input";
import { CityPicker, WarehousePicker, type City, type Warehouse } from "./nova-poshta-picker";
import { SafeImage } from "./safe-image";
import { cn } from "@/lib/utils";

type Methods = { LIQPAY_CARD: boolean; NP_COD: boolean; PAY_ON_RECEIVE: boolean };
export type CheckoutConfig = {
  methods: Methods; cod: { prepaymentAmount: number; commissionPercent: number; commissionFixed: number; maxTotal: number };
  delivery: { flatFee: number; freeShippingThreshold: number | null; note: string }; npReady: boolean;
};
type Prefill = { firstName: string; lastName: string; phone: string; email: string };

const METHOD_ICON = { LIQPAY_CARD: CreditCard, NP_COD: PackageCheck, PAY_ON_RECEIVE: Banknote } as const;
const DELIVERY = ["NP_WAREHOUSE", "NP_LOCKER", "NP_COURIER"] as const;

export function CheckoutForm({ cart, config, prefill }: { cart: CartView; config: CheckoutConfig; prefill: Prefill }) {
  const t = useT();
  const router = useRouter();
  const { setCartCount } = useMe();
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, {});
  const available = (Object.keys(config.methods) as (keyof Methods)[]).filter((m) => config.methods[m]);
  const [method, setMethod] = useState<keyof Methods>(available[0] ?? "PAY_ON_RECEIVE");
  const [delivery, setDelivery] = useState<(typeof DELIVERY)[number]>("NP_WAREHOUSE");
  const [city, setCity] = useState<City | null>(null);
  const [wh, setWh] = useState<Warehouse | null>(null);
  const payForm = useRef<HTMLFormElement>(null);

  useEffect(() => { track("begin_checkout", { value: cart.total / 100 }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setWh(null), [city?.ref, delivery]);

  const totals = useMemo(() => computeOrderTotals({
    lines: [{ unitPrice: cart.subtotal, quantity: 1 }], discount: cart.discount, method,
    delivery: { flatFee: config.delivery.flatFee, freeShippingThreshold: config.delivery.freeShippingThreshold },
    cod: { prepaymentAmount: config.cod.prepaymentAmount, commissionPercent: config.cod.commissionPercent, commissionFixed: config.cod.commissionFixed },
  }), [cart, config, method]);

  const result = state.ok ? state.data : undefined;
  useEffect(() => {
    if (!result) return;
    setCartCount(0);
    if (result.redirect) payForm.current?.submit(); // hand over to LiqPay's hosted page (POST data+signature)
    else router.push(result.nextUrl);
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  const fe = state.fieldErrors ?? {};
  const codOver = method === "NP_COD" && config.cod.maxTotal > 0 && totals.total > config.cod.maxTotal;

  if (result?.redirect) {
    return (
      <div className="mx-auto max-w-md py-24 text-center" role="status">
        <p className="text-lg font-medium">{t("checkout.redirectingToPayment")}</p>
        <form ref={payForm} action={result.redirect.url} method="POST" acceptCharset="utf-8" className="mt-6">
          {Object.entries(result.redirect.fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <noscript><Button>{t("checkout.payOnline")}</Button></noscript>
        </form>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-10 lg:grid-cols-[1fr_400px]" noValidate>
      <div className="space-y-10">
        {!config.npReady && <Alert variant="warning">{t("checkout.npUnavailable")}</Alert>}

        <section aria-labelledby="c-contact">
          <h2 id="c-contact" className="mb-4 text-xl font-semibold">{t("checkout.contact")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("checkout.firstName")} error={fe.firstName} htmlFor="firstName"><Input id="firstName" name="firstName" defaultValue={prefill.firstName} autoComplete="given-name" required aria-invalid={Boolean(fe.firstName)} /></Field>
            <Field label={t("checkout.lastName")} error={fe.lastName} htmlFor="lastName"><Input id="lastName" name="lastName" defaultValue={prefill.lastName} autoComplete="family-name" required aria-invalid={Boolean(fe.lastName)} /></Field>
            <Field label={t("checkout.phone")} error={fe.phone} htmlFor="phone"><Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={prefill.phone} placeholder="+380" autoComplete="tel" required aria-invalid={Boolean(fe.phone)} /></Field>
            <Field label={t("checkout.email")} error={fe.email} htmlFor="email"><Input id="email" name="email" type="email" defaultValue={prefill.email} autoComplete="email" required aria-invalid={Boolean(fe.email)} /></Field>
          </div>
        </section>

        <section aria-labelledby="c-delivery">
          <h2 id="c-delivery" className="mb-4 text-xl font-semibold">{t("checkout.delivery")}</h2>
          <fieldset className="grid gap-2.5 sm:grid-cols-3">
            <legend className="sr-only">{t("checkout.deliveryMethod")}</legend>
            {DELIVERY.map((d) => (
              <label key={d} className={cn("cursor-pointer rounded-xl border p-3.5 text-sm transition-colors", delivery === d ? "border-foreground bg-muted/50" : "border-border hover:border-foreground/40")}>
                <input type="radio" name="deliveryMethod" value={d} checked={delivery === d} onChange={() => setDelivery(d)} className="sr-only" />
                <span className="font-medium">{t(`delivery.${d}`).replace("Нова пошта — ", "")}</span>
              </label>
            ))}
          </fieldset>
          <p className="mt-2 text-xs text-muted-foreground">{config.delivery.note}</p>

          <div className="mt-5 space-y-4">
            <Field label={t("checkout.city")} error={fe.cityRef ?? fe.city} htmlFor="city">
              <CityPicker value={city} onSelect={setCity} error={fe.cityRef} />
              <input type="hidden" name="city" value={city?.name ?? ""} /><input type="hidden" name="cityRef" value={city?.ref ?? ""} />
            </Field>
            {delivery !== "NP_COURIER" ? (
              <Field label={delivery === "NP_LOCKER" ? t("checkout.locker") : t("checkout.warehouse")} error={fe.warehouseRef}>
                <WarehousePicker cityRef={city?.ref ?? null} kind={delivery === "NP_LOCKER" ? "locker" : "warehouse"} value={wh} onSelect={setWh} error={fe.warehouseRef} />
                <input type="hidden" name="warehouseRef" value={wh?.ref ?? ""} /><input type="hidden" name="warehouseName" value={wh?.name ?? ""} />
              </Field>
            ) : (
              <Field label={t("checkout.address")} hint={t("checkout.addressHint")} error={fe.address} htmlFor="address"><Input id="address" name="address" autoComplete="street-address" aria-invalid={Boolean(fe.address)} /></Field>
            )}
            <Field label={t("checkout.comment")} htmlFor="comment"><Textarea id="comment" name="comment" maxLength={500} rows={3} /></Field>
          </div>
        </section>

        <section aria-labelledby="c-pay">
          <h2 id="c-pay" className="mb-4 text-xl font-semibold">{t("checkout.payment")}</h2>
          <fieldset className="space-y-2.5">
            <legend className="sr-only">{t("checkout.paymentMethod")}</legend>
            {available.map((m) => {
              const Icon = METHOD_ICON[m];
              return (
                <label key={m} className={cn("flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition-colors", method === m ? "border-foreground bg-muted/50" : "border-border hover:border-foreground/40")}>
                  <input type="radio" name="paymentMethod" value={m} checked={method === m} onChange={() => setMethod(m)} className="mt-1 accent-[hsl(var(--accent))]" />
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                  <span><span className="block text-[15px] font-medium">{t(`paymentMethod.${m}`)}</span><span className="block text-[13px] text-muted-foreground">{t(`paymentMethodHint.${m}`)}</span></span>
                </label>
              );
            })}
          </fieldset>
          {method === "NP_COD" && <p className="mt-3 text-xs text-muted-foreground">{t("checkout.codHint")}</p>}
          {codOver && <Alert variant="error" className="mt-3">{t("checkout.error.COD_LIMIT")}</Alert>}
        </section>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="acceptOffer" className="mt-0.5 h-4 w-4 accent-[hsl(var(--accent))]" required />
          <span>{t("checkout.acceptOffer")} (<Link className="underline" href="/legal/offer" target="_blank">{t("legal.offer")}</Link>, <Link className="underline" href="/legal/privacy" target="_blank">{t("legal.privacy")}</Link>)</span>
        </label>
        {fe.acceptOffer && <p role="alert" className="-mt-6 text-xs text-destructive">{fe.acceptOffer}</p>}
      </div>

      <aside className="h-fit rounded-2xl border border-border p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold">{t("checkout.yourOrder")}</h2>
        <ul className="mt-4 max-h-64 space-y-3.5 overflow-y-auto pr-1">
          {cart.lines.map((l) => (
            <li key={l.variantId} className="flex gap-3">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted"><SafeImage src={l.image} alt="" fill sizes="56px" className="object-contain p-1.5" /></span>
              <span className="min-w-0 flex-1 text-sm"><span className="line-clamp-1 font-medium">{l.title}</span><span className="block text-xs text-muted-foreground">{l.variantLabel} × {l.quantity}</span></span>
              <span className="text-sm tnum">{formatMoney(l.unitPrice * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-5 space-y-2 border-t border-border pt-5 text-sm tnum">
          <div className="flex justify-between"><dt className="text-muted-foreground">{t("cart.subtotal")}</dt><dd>{formatMoney(totals.subtotal)}</dd></div>
          {totals.discountTotal > 0 && <div className="flex justify-between text-accent"><dt>{t("cart.discount")}</dt><dd>−{formatMoney(totals.discountTotal)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted-foreground">{t("cart.shipping")}</dt><dd>{totals.deliveryCost > 0 ? formatMoney(totals.deliveryCost) : t("cart.shippingCarrier")}</dd></div>
          {totals.commission > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">{t("checkout.commission")}</dt><dd>{formatMoney(totals.commission)}</dd></div>}
          <div className="flex justify-between border-t border-border pt-3 text-lg font-semibold"><dt>{t("cart.total")}</dt><dd>{formatMoney(totals.total)}</dd></div>
          {method === "NP_COD" && totals.prepaymentAmount > 0 && (<>
            <div className="flex justify-between text-muted-foreground"><dt>{t("checkout.prepayment")}</dt><dd>{formatMoney(totals.prepaymentAmount)}</dd></div>
            <div className="flex justify-between text-muted-foreground"><dt>{t("checkout.codAmount")}</dt><dd>{formatMoney(totals.codAmount)}</dd></div>
          </>)}
        </dl>
        {state.error && <Alert variant="error" className="mt-4">{t(state.error)}{state.error.includes("OUT_OF_STOCK") && <> <Link href="/cart" className="underline">{t("nav.cart")}</Link></>}</Alert>}
        <Button size="lg" className="mt-5 w-full" loading={pending} disabled={cart.hasProblems || codOver || (available.length === 0)}>
          {pending ? t("checkout.processing") : totals.onlineAmount > 0 ? t("checkout.payOnline") : t("checkout.placeOrder")}
        </Button>
      </aside>
    </form>
  );
}
