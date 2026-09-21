import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView, type RawParams } from "@/components/catalog-view";
import { getCategories } from "@/services/catalog";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<RawParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ category }, sp] = await Promise.all([params, searchParams]);
  const c = (await getCategories()).find((x) => x.slug === category);
  if (!c) return {};
  const filtered = Object.keys(sp).some((k) => k !== "page");
  return {
    title: c.seoTitle ?? c.name, description: c.seoDescription ?? c.description ?? undefined,
    alternates: { canonical: `/catalog/${c.slug}` }, robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: { title: c.seoTitle ?? c.name, description: c.seoDescription ?? undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  if (!(await getCategories()).some((c) => c.slug === category)) notFound();
  return <CatalogView categorySlug={category} rawParams={await searchParams} />;
}
