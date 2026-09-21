import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PublicProductCard } from "@/lib/public-dto";
import { t } from "@/lib/t-static";
import { ProductCard } from "./product-card";

/** Horizontal scroller on mobile, grid on desktop. Renders nothing when empty. */
export function ProductRail({ title, href, items, cols = 4 }: { title: string; href: string; items: PublicProductCard[]; cols?: 4 }) {
  if (!items.length) return null;
  return (
    <section className="container py-10 md:py-14" aria-label={title}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
        <Link href={href} className="group hidden items-center gap-1 text-sm font-medium text-accent sm:flex">{t("home.seeAll")}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Link>
      </div>
      <div className={`-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0`}>
        {items.slice(0, cols).map((p) => <div key={p.id} className="w-[62%] shrink-0 snap-start sm:w-[38%] md:w-auto"><ProductCard p={p} /></div>)}
      </div>
      <Link href={href} className="mt-4 flex items-center gap-1 text-sm font-medium text-accent sm:hidden">{t("home.seeAll")}<ArrowRight className="h-4 w-4" /></Link>
    </section>
  );
}
