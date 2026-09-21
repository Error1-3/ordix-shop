import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { getAllProductSlugs, getCategories } from "@/services/catalog";

export const dynamic = "force-dynamic"; // needs DB; cached inside the data layer

const LEGAL = ["terms", "privacy", "cookies", "delivery", "payment", "returns", "warranty", "offer"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [products, categories] = await Promise.all([getAllProductSlugs(), getCategories()]);
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/catalog`, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({ url: `${base}/catalog/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...LEGAL.map((l) => ({ url: `${base}/legal/${l}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
