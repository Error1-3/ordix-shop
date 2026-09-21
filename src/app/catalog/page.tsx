import type { Metadata } from "next";
import { CatalogView, type RawParams } from "@/components/catalog-view";
import { t } from "@/lib/t-static";

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawParams> }): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = Object.keys(sp).some((k) => k !== "page");
  return {
    title: sp.q ? t("search.resultsFor", { q: String(sp.q) }) : t("catalog.title"),
    alternates: { canonical: "/catalog" },
    robots: filtered ? { index: false, follow: true } : undefined, // avoid crawling infinite filter combinations
  };
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <CatalogView rawParams={await searchParams} />;
}
