import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { t } from "@/lib/t-static";
import { getApprovedReviews, getProductBySlug, getRelated } from "@/services/catalog";
import { ProductPurchase } from "@/components/product-purchase";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ReviewForm } from "@/components/review-form";
import { ProductRail } from "@/components/section";
import { JsonLd } from "@/components/json-ld";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { breadcrumbLd, faqLd, productLd } from "@/lib/seo";

// ISR: rendered on first request, cached 5 min, invalidated instantly by revalidateTag("catalog") on admin edits/sales.
export const revalidate = 300;
export async function generateStaticParams() { return []; }

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return {};
  const desc = p.seoDescription ?? (p.shortDescription || p.description.slice(0, 160));
  return {
    title: p.seoTitle ?? p.title, description: desc, alternates: { canonical: `/product/${p.slug}` },
    openGraph: { type: "website", title: p.seoTitle ?? p.title, description: desc, images: p.images[0] ? [{ url: p.images[0].url, alt: p.images[0].alt || p.title }] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  const [reviews, related] = await Promise.all([getApprovedReviews(product.id), getRelated(product.id, product.categorySlug, product.model)]);
  const crumbs = [
    { name: t("nav.catalog"), href: "/catalog" },
    { name: product.categoryName, href: `/catalog/${product.categorySlug}` },
    { name: product.title },
  ];

  return (
    <>
      <div className="container py-6 md:py-10">
        <Breadcrumbs items={crumbs} />
        <ProductPurchase product={product} />

        <div className="mx-auto mt-16 grid max-w-5xl gap-14">
          {product.description && (
            <section aria-labelledby="desc"><h2 id="desc" className="mb-4 text-2xl font-semibold tracking-tight">{t("product.description")}</h2><div className="max-w-3xl whitespace-pre-line leading-relaxed text-muted-foreground">{product.description}</div></section>
          )}
          {product.specifications.length > 0 && (
            <section aria-labelledby="specs">
              <h2 id="specs" className="mb-4 text-2xl font-semibold tracking-tight">{t("product.specs")}</h2>
              <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
                {product.specifications.map((g) => (
                  <div key={g.group}>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.group}</h3>
                    <dl>{g.items.map((it) => <div key={it.label} className="flex justify-between gap-4 border-b border-border py-2.5 text-sm"><dt className="text-muted-foreground">{it.label}</dt><dd className="text-right font-medium">{it.value}</dd></div>)}</dl>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section aria-labelledby="reviews">
            <div className="mb-5 flex flex-wrap items-baseline gap-3">
              <h2 id="reviews" className="text-2xl font-semibold tracking-tight">{t("product.reviews")}</h2>
              {product.ratingAvg != null && <span className="flex items-center gap-1 text-sm"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /><b>{product.ratingAvg}</b><span className="text-muted-foreground">({product.ratingCount})</span></span>}
            </div>
            {reviews.length === 0 ? <p className="mb-6 text-sm text-muted-foreground">{t("reviews.none")}</p> : (
              <ul className="mb-8 divide-y divide-border">
                {reviews.map((r) => (
                  <li key={r.id} className="py-5">
                    <div className="flex items-center gap-2"><span className="flex" aria-label={`${r.rating}/5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-border"}`} />)}</span><span className="text-sm font-medium">{r.author}</span>{r.isVerifiedPurchase && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">{t("reviews.verified")}</span>}</div>
                    <p className="mt-2 font-medium">{r.title}</p><p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <ReviewForm productId={product.id} />
          </section>
          {product.faq.length > 0 && (
            <section aria-labelledby="pfaq">
              <h2 id="pfaq" className="mb-2 text-2xl font-semibold tracking-tight">{t("product.faq")}</h2>
              <Accordion type="single" collapsible>{product.faq.map((f, i) => <AccordionItem key={i} value={`f${i}`}><AccordionTrigger>{f.q}</AccordionTrigger><AccordionContent>{f.a}</AccordionContent></AccordionItem>)}</Accordion>
            </section>
          )}
        </div>
      </div>
      <ProductRail title={t("product.related")} href={`/catalog/${product.categorySlug}`} items={related} />
      <JsonLd data={[productLd({ ...product, ratingAvg: product.ratingAvg, ratingCount: product.ratingCount }), breadcrumbLd(crumbs.map((c) => ({ name: c.name, path: c.href ?? `/product/${product.slug}` }))), ...(product.faq.length ? [faqLd(product.faq)] : [])]} />
    </>
  );
}
