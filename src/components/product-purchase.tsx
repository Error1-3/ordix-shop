"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Heart, Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { addToCartAction } from "@/actions/cart";
import { toggleWishlistAction } from "@/actions/account";
import { useT } from "@/components/i18n-provider";
import { useMe } from "@/components/session-provider";
import { track, toItem } from "@/lib/analytics";
import type { PublicProduct, PublicVariant } from "@/lib/public-dto";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Price } from "./price";
import { SafeImage } from "./safe-image";
import { UsedDevicePanel } from "./used-device-panel";
import { BatteryRing } from "./battery-ring";

const AXES = ["storage", "color", "condition", "connectivity", "simType"] as const;
type Axis = (typeof AXES)[number];

function pickVariant(variants: PublicVariant[], axis: Axis, value: string | null, current: PublicVariant): PublicVariant {
  const pool = variants.filter((v) => v[axis] === value);
  const score = (v: PublicVariant) => AXES.reduce((s, a) => s + (a !== axis && v[a] === current[a] ? 1 : 0), 0) * 10 + (v.available > 0 ? 5 : 0);
  return [...pool].sort((a, b) => score(b) - score(a))[0] ?? current;
}

export function ProductPurchase({ product }: { product: PublicProduct }) {
  const t = useT();
  const router = useRouter();
  const { me, setCartCount, setWished } = useMe();
  const [pending, start] = useTransition();
  const initial = product.variants.find((v) => v.available > 0) ?? product.variants[0];
  const [selectedId, setSelectedId] = useState(initial?.id);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const v = product.variants.find((x) => x.id === selectedId) ?? initial;

  useEffect(() => { if (v) track("view_item", { value: v.price / 100, items: [toItem({ id: product.id, title: product.title, price: v.price, variant: [v.storage, v.color].filter(Boolean).join(" "), category: product.categorySlug })] }); }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Photos of THIS device first (used devices have their own set), else the product gallery.
  const images = useMemo(() => {
    const own = product.images.filter((i) => i.variantId && i.variantId === v?.id);
    if (own.length) return own;
    const general = product.images.filter((i) => !i.variantId);
    return general.length ? general : product.images;
  }, [product.images, v?.id]);
  useEffect(() => setImgIdx(0), [v?.id]);

  if (!v) return <p className="py-20 text-center text-muted-foreground">{t("product.outOfStock")}</p>;

  const options = (axis: Axis) => [...new Set(product.variants.map((x) => x[axis]).filter((x): x is string => Boolean(x)))];
  const isUsed = v.condition !== "NEW";
  const inStock = v.available > 0;
  const wished = me.wishlist.includes(product.id);
  const maxQty = isUsed ? 1 : Math.max(1, Math.min(v.available, 5));

  const add = (buyNow: boolean) =>
    start(async () => {
      const res = await addToCartAction(v.id, qty);
      if (!res.ok) { toast.error(t(res.error ?? "common.genericError")); return; }
      if (typeof res.count === "number") setCartCount(res.count);
      track("add_to_cart", { value: (v.price * qty) / 100, items: [toItem({ id: product.id, title: product.title, price: v.price, quantity: qty, variant: [v.storage, v.color].filter(Boolean).join(" ") })] });
      if (buyNow) router.push("/checkout");
      else toast.success(t("product.addedToCart"), { action: { label: t("nav.cart"), onClick: () => router.push("/cart") } });
    });

  const wish = () =>
    start(async () => {
      if (!me.user) { router.push(`/login?callbackUrl=${encodeURIComponent(`/product/${product.slug}`)}`); return; }
      const r = await toggleWishlistAction(product.id);
      if (r.ok) { setWished(product.id, Boolean(r.wished)); if (r.wished) track("wishlist", { items: [toItem({ id: product.id, title: product.title, price: v.price })] }); }
    });

  const availability = !inStock ? t("product.outOfStock") : v.available === 1 && isUsed ? t("product.lastOne") : v.available <= 3 ? t("product.fewLeft", { n: v.available }) : t("product.inStock");

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        {/* Gallery */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
            <SafeImage src={images[imgIdx]?.url} alt={images[imgIdx]?.alt || product.title} fill priority sizes="(max-width:1024px) 100vw,55vw" className="object-contain p-8 sm:p-12" />
            {isUsed && v.usedDevice?.batteryHealth != null && <div className="absolute left-4 top-4 rounded-full bg-background/90 p-1 backdrop-blur"><BatteryRing value={v.usedDevice.batteryHealth} size={44} /></div>}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Gallery">
              {images.map((im, i) => (
                <button key={im.id} role="tab" aria-selected={i === imgIdx} onClick={() => setImgIdx(i)} className={cn("relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted ring-offset-2 transition-shadow sm:h-20 sm:w-20", i === imgIdx ? "ring-2 ring-foreground" : "opacity-70 hover:opacity-100")}>
                  <SafeImage src={im.url} alt="" fill sizes="80px" className="object-contain p-2" />
                </button>
              ))}
            </div>
          )}
          {isUsed && images.some((i) => i.variantId) && <p className="mt-3 text-xs text-muted-foreground">{t("product.photosOfThisDevice")}</p>}
        </div>

        {/* Buy box */}
        <div>
          <p className="text-sm text-muted-foreground">{product.brand} · {product.model}</p>
          <h1 className="mt-1 text-balance text-3xl font-semibold tracking-tight md:text-4xl">{product.title}</h1>
          <div className="mt-5"><Price price={v.price} compareAt={v.compareAtPrice} size="lg" /></div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className={cn("inline-flex items-center gap-1.5 font-medium", inStock ? "text-accent" : "text-destructive")}><span className={cn("h-2 w-2 rounded-full", inStock ? "bg-accent" : "bg-destructive")} />{availability}</span>
            <span className="text-muted-foreground">{t("product.sku")}: <span className="tnum">{v.sku}</span></span>
          </div>

          <div className="mt-7 space-y-6">
            {AXES.map((axis) => {
              const opts = options(axis);
              const label = t(`product.${axis}`);
              if (opts.length === 0) return null;
              if (opts.length === 1) return <p key={axis} className="text-sm"><span className="text-muted-foreground">{label}: </span>{axis === "condition" ? t(`condition.${opts[0]}`) : opts[0]}</p>;
              return (
                <div key={axis}>
                  <p className="mb-2.5 text-sm font-medium">{label}: <span className="font-normal text-muted-foreground">{axis === "condition" ? t(`condition.${v.condition}`) : v[axis]}</span></p>
                  <div className="flex flex-wrap gap-2">
                    {opts.map((o) => {
                      const any = product.variants.filter((x) => x[axis] === o);
                      const available = any.some((x) => x.available > 0);
                      const on = v[axis] === o;
                      const colorHex = axis === "color" ? any[0]?.colorHex : null;
                      return (
                        <button key={o} type="button" aria-pressed={on} onClick={() => { setSelectedId(pickVariant(product.variants, axis, o, v).id); setQty(1); }}
                          className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all", on ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/50", !available && !on && "text-muted-foreground line-through decoration-1")}>
                          {colorHex && <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/15" style={{ background: colorHex }} />}
                          {axis === "condition" ? t(`condition.${o}`) : o}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {isUsed && v.usedDevice?.batteryHealth != null && (
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-muted/70 p-3.5"><p className="text-xs text-muted-foreground">{t("product.battery")}</p><p className="mt-0.5 font-semibold tnum">{v.usedDevice.batteryHealth}%</p></div>
              <div className="rounded-xl bg-muted/70 p-3.5"><p className="text-xs text-muted-foreground">{t("product.warranty")}</p><p className="mt-0.5 font-semibold tnum">{t("product.months", { n: v.warrantyMonths })}</p></div>
            </div>
          )}
          {!isUsed && <p className="mt-6 text-sm text-muted-foreground">{t("product.warranty")}: <span className="font-medium text-foreground tnum">{t("product.months", { n: v.warrantyMonths })}</span></p>}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {maxQty > 1 && (
              <div className="flex h-12 items-center rounded-full border border-border" aria-label={t("product.quantity")}>
                <button type="button" className="grid h-12 w-11 place-items-center disabled:opacity-30" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)} aria-label="−"><Minus className="h-4 w-4" /></button>
                <span className="w-7 text-center text-sm font-medium tnum" aria-live="polite">{qty}</span>
                <button type="button" className="grid h-12 w-11 place-items-center disabled:opacity-30" disabled={qty >= maxQty} onClick={() => setQty((q) => q + 1)} aria-label="+"><Plus className="h-4 w-4" /></button>
              </div>
            )}
            <Button size="lg" className="flex-1 min-w-40" disabled={!inStock} loading={pending} onClick={() => add(false)}>{t("product.addToCart")}</Button>
            <Button size="lg" variant="accent" className="flex-1 min-w-40" disabled={!inStock} loading={pending} onClick={() => add(true)}>{t("product.buyNow")}</Button>
            <Button size="icon" variant="outline" className="h-12 w-12 rounded-full" onClick={wish} aria-pressed={wished} aria-label={wished ? t("product.wishlistRemove") : t("product.wishlistAdd")}><Heart className={cn("h-5 w-5", wished && "fill-accent text-accent")} /></Button>
          </div>

          <ul className="mt-8 space-y-3 rounded-xl border border-border p-4 text-sm">
            <li className="flex gap-3"><Truck className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span><span className="font-medium">{t("product.delivery")}.</span> <span className="text-muted-foreground">{t("product.deliveryText")}</span></span></li>
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span className="text-muted-foreground">{t("home.benefits.warranty.text")}</span></li>
          </ul>
        </div>
      </div>

      {isUsed && v.usedDevice && <div className="mt-12"><UsedDevicePanel d={v.usedDevice} condition={v.condition} /></div>}
    </>
  );
}
