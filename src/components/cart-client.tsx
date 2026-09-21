"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Minus, Plus, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { applyCouponAction, removeCouponAction, updateCartQuantityAction } from "@/actions/cart";
import { useT } from "@/components/i18n-provider";
import { useMe } from "@/components/session-provider";
import { formatMoney } from "@/lib/money";
import type { CartView } from "@/services/cart";
import { Alert, EmptyState } from "./ui/misc";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SafeImage } from "./safe-image";
import { Price } from "./price";

export function CartClient({ cart }: { cart: CartView }) {
  const t = useT();
  const router = useRouter();
  const { setCartCount } = useMe();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string; count?: number }>, okMsg?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(t(r.error ?? "common.genericError"));
      else if (okMsg) toast.success(okMsg);
      if (typeof r.count === "number") setCartCount(r.count);
      router.refresh();
    });

  if (cart.lines.length === 0) {
    return <EmptyState icon={<ShoppingBag className="h-10 w-10" />} title={t("cart.empty")} hint={t("cart.emptyHint")} action={<Button asChild><Link href="/catalog">{t("cart.goCatalog")}</Link></Button>} />;
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]" aria-busy={pending}>
      <ul className="divide-y divide-border border-y border-border">
        {cart.lines.map((l) => {
          const bad = l.problem === "OUT_OF_STOCK" || l.problem === "UNAVAILABLE";
          const single = l.condition !== "NEW";
          return (
            <li key={l.variantId} className="flex gap-4 py-5 sm:gap-6">
              <Link href={`/product/${l.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-28 sm:w-28"><SafeImage src={l.image} alt="" fill sizes="112px" className="object-contain p-3" /></Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/product/${l.slug}`} className="line-clamp-2 font-medium hover:underline">{l.title}</Link>
                    <p className="mt-0.5 text-sm text-muted-foreground">{l.variantLabel}</p>
                  </div>
                  <button className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted" aria-label={t("cart.remove")} onClick={() => run(() => updateCartQuantityAction(l.variantId, 0))}><Trash2 className="mx-auto h-4 w-4" /></button>
                </div>
                {l.problem && <p className={`mt-1.5 text-xs font-medium ${bad ? "text-destructive" : "text-warning"}`}>{t(`cart.problem.${l.problem}`)}</p>}
                <div className="mt-auto flex items-end justify-between pt-3">
                  {single ? <span className="text-sm text-muted-foreground tnum">1 {t("common.pcs")}</span> : (
                    <div className="flex h-9 items-center rounded-full border border-border">
                      <button className="grid h-9 w-9 place-items-center disabled:opacity-30" disabled={pending || bad} onClick={() => run(() => updateCartQuantityAction(l.variantId, l.quantity - 1))} aria-label="−"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-6 text-center text-sm tnum">{l.quantity}</span>
                      <button className="grid h-9 w-9 place-items-center disabled:opacity-30" disabled={pending || bad || l.quantity >= l.available} onClick={() => run(() => updateCartQuantityAction(l.variantId, l.quantity + 1))} aria-label="+"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                  <Price price={l.unitPrice * l.quantity} compareAt={l.compareAt ? l.compareAt * l.quantity : null} size="sm" className="justify-end" />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit rounded-2xl border border-border p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold">{t("cart.title")} · {t("cart.items", { n: cart.itemCount })}</h2>

        <div className="mt-5">
          {cart.couponCode && !cart.couponError ? (
            <div className="flex items-center justify-between rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm"><span className="flex items-center gap-2 font-medium text-accent"><Tag className="h-4 w-4" />{cart.couponCode}</span><button aria-label={t("cart.couponRemove")} onClick={() => run(() => removeCouponAction())}><X className="h-4 w-4 text-accent" /></button></div>
          ) : (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) run(async () => { const r = await applyCouponAction(code); if (r.ok) setCode(""); return r; }, t("cart.couponApplied")); }}>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("cart.couponPlaceholder")} aria-label={t("cart.coupon")} maxLength={40} autoCapitalize="characters" />
              <Button type="submit" variant="outline" disabled={pending || !code.trim()}>{t("cart.couponApply")}</Button>
            </form>
          )}
          {cart.couponError && <p className="mt-2 text-xs text-destructive">{t(`cart.couponError.${cart.couponError}`)}</p>}
        </div>

        <dl className="mt-6 space-y-2.5 text-sm tnum">
          <div className="flex justify-between"><dt className="text-muted-foreground">{t("cart.subtotal")}</dt><dd>{formatMoney(cart.subtotal)}</dd></div>
          {cart.discount > 0 && <div className="flex justify-between text-accent"><dt>{t("cart.discount")}</dt><dd>−{formatMoney(cart.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted-foreground">{t("cart.shipping")}</dt><dd>{cart.deliveryCost > 0 ? formatMoney(cart.deliveryCost) : t("cart.shippingCarrier")}</dd></div>
          <div className="flex justify-between border-t border-border pt-4 text-lg font-semibold"><dt>{t("cart.total")}</dt><dd>{formatMoney(cart.total)}</dd></div>
        </dl>

        {cart.hasProblems && <Alert variant="warning" className="mt-5">{t("cart.removeProblems")}</Alert>}
        <Button asChild size="lg" className="mt-5 w-full" disabled={cart.hasProblems}>
          {cart.hasProblems ? <span>{t("cart.checkout")}</span> : <Link href="/checkout">{t("cart.checkout")}</Link>}
        </Button>
        <Button asChild variant="ghost" className="mt-2 w-full"><Link href="/catalog">{t("cart.continueShopping")}</Link></Button>
      </aside>
    </div>
  );
}
