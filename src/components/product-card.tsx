import Link from "next/link";
import { Star } from "lucide-react";
import type { PublicProductCard } from "@/lib/public-dto";
import { t } from "@/lib/t-static";
import { Price } from "./price";
import { SafeImage } from "./safe-image";
import { BatteryRing } from "./battery-ring";
import { cn } from "@/lib/utils";

export function ProductCard({ p, priority }: { p: PublicProductCard; priority?: boolean }) {
  const usedOnly = p.conditions.length > 0 && !p.conditions.includes("NEW");
  const best = p.conditions.length ? p.conditions.find((c) => c !== "NEW") : undefined;
  return (
    <Link href={`/product/${p.slug}`} className="group block" prefetch={false}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
        <SafeImage
          src={p.image?.url} alt={p.image?.alt || p.title} fill sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,25vw" priority={priority}
          className={cn("object-contain p-6 transition-transform duration-500 ease-out group-hover:scale-[1.04]", !p.inStock && "opacity-50")}
        />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {p.isNew && !usedOnly && <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">{t("nav.new")}</span>}
          {p.hasUsed && best && <span className="rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium backdrop-blur">{usedOnly ? t(`condition.${best}`) : t("nav.used")}</span>}
        </div>
        {p.bestBatteryHealth != null && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-background/90 py-1 pl-1 pr-2.5 backdrop-blur">
            <BatteryRing value={p.bestBatteryHealth} size={22} label={false} />
            <span className="text-[11px] font-medium tnum">{p.bestBatteryHealth}%</span>
          </div>
        )}
        {!p.inStock && <span className="absolute right-2.5 top-2.5 rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{t("product.outOfStock")}</span>}
      </div>
      <div className="mt-3 space-y-1 px-0.5">
        <h3 className="line-clamp-2 text-[15px] font-medium leading-snug">{p.title}</h3>
        <Price price={p.price} compareAt={p.compareAtPrice} size="sm" from={t("common.from")} />
        {p.ratingAvg != null && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{p.ratingAvg} <span>({p.ratingCount})</span></p>
        )}
      </div>
    </Link>
  );
}

export function ProductGrid({ items, className }: { items: PublicProductCard[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4", className)}>
      {items.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}
    </div>
  );
}
