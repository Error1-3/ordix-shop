import { siteUrl } from "./env";
import { minorToDecimal } from "./money";
import type { PublicProduct } from "./public-dto";
import type { SettingsMap } from "./settings-schema";

const abs = (path: string) => (path.startsWith("http") ? path : `${siteUrl()}${path}`);

export function organizationLd(s: SettingsMap["store"]) {
  return {
    "@context": "https://schema.org", "@type": "Organization", name: s.legalName || s.name, url: siteUrl(),
    ...(s.logoUrl ? { logo: abs(s.logoUrl) } : {}), ...(s.phone ? { telephone: s.phone } : {}), ...(s.email ? { email: s.email } : {}),
    sameAs: Object.values(s.social).filter(Boolean),
  };
}

export const websiteLd = (name: string) => ({
  "@context": "https://schema.org", "@type": "WebSite", name, url: siteUrl(),
  potentialAction: { "@type": "SearchAction", target: `${siteUrl()}/catalog?q={search_term_string}`, "query-input": "required name=search_term_string" },
});

export const breadcrumbLd = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
});

export const faqLd = (faq: { q: string; a: string }[]) => ({
  "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});

const CONDITION_LD: Record<string, string> = {
  NEW: "https://schema.org/NewCondition", LIKE_NEW: "https://schema.org/RefurbishedCondition", EXCELLENT: "https://schema.org/UsedCondition",
  GOOD: "https://schema.org/UsedCondition", FAIR: "https://schema.org/UsedCondition",
};

/** Product + Offer(s). Only PUBLIC DTO fields are used — nothing private can reach structured data. */
export function productLd(p: PublicProduct) {
  const offers = p.variants.map((v) => ({
    "@type": "Offer", url: abs(`/product/${p.slug}`), priceCurrency: "UAH", price: minorToDecimal(v.price).toFixed(2), sku: v.sku,
    availability: v.available > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", itemCondition: CONDITION_LD[v.condition] ?? CONDITION_LD.NEW,
  }));
  return {
    "@context": "https://schema.org", "@type": "Product", name: p.title, description: p.shortDescription || p.description.slice(0, 300), sku: p.variants[0]?.sku, brand: { "@type": "Brand", name: p.brand },
    ...(p.images.length ? { image: p.images.slice(0, 6).map((i) => abs(i.url)) } : {}), url: abs(`/product/${p.slug}`),
    offers: offers.length === 1 ? offers[0] : { "@type": "AggregateOffer", priceCurrency: "UAH", lowPrice: minorToDecimal(Math.min(...p.variants.map((v) => v.price))).toFixed(2), highPrice: minorToDecimal(Math.max(...p.variants.map((v) => v.price))).toFixed(2), offerCount: offers.length, offers },
    ...(p.ratingCount > 0 && p.ratingAvg ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAvg, reviewCount: p.ratingCount } } : {}),
  };
}
