import Link from "next/link";
import { SearchX } from "lucide-react";
import { t } from "@/lib/t-static";
import { catalogQuerySchema } from "@/lib/validators";
import { getCategories, getFacets, searchProducts } from "@/services/catalog";
import { Breadcrumbs } from "./breadcrumbs";
import { Filters, type FilterValues } from "./filters";
import { Pagination } from "./pagination";
import { ProductGrid } from "./product-card";
import { EmptyState } from "./ui/misc";
import { Button } from "./ui/button";
import { JsonLd } from "./json-ld";
import { breadcrumbLd } from "@/lib/seo";

export type RawParams = Record<string, string | string[] | undefined>;
const flat = (p: RawParams) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== undefined)) as Record<string, string>;

export async function CatalogView({ categorySlug, rawParams }: { categorySlug?: string; rawParams: RawParams }) {
  const flatParams = flat(rawParams);
  const parsed = catalogQuerySchema.safeParse({ ...flatParams, category: categorySlug });
  const query = parsed.success ? parsed.data : catalogQuerySchema.parse({ category: categorySlug });
  const [page, facets, categories] = await Promise.all([searchProducts(query), getFacets(categorySlug), getCategories()]);
  const category = categories.find((c) => c.slug === categorySlug);
  const roots = categories.filter((c) => !c.parentId);
  const title = query.q ? t("search.resultsFor", { q: query.q }) : category?.name ?? t("catalog.title");
  const { page: _p, ...filterParams } = flatParams;
  void _p;
  const crumbs = [{ name: t("nav.catalog"), href: "/catalog" }, ...(category ? [{ name: category.name }] : [])];

  return (
    <div className="container py-8 md:py-12">
      <Breadcrumbs items={crumbs} />
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
      {category?.description && <p className="mt-2 max-w-2xl text-muted-foreground">{category.description}</p>}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Link href="/catalog" className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${!categorySlug ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}>{t("catalog.allCategories")}</Link>
        {roots.map((c) => <Link key={c.id} href={`/catalog/${c.slug}`} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${c.slug === categorySlug ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}>{c.name}</Link>)}
      </div>

      <div className="mt-8">
        <Filters facets={facets} values={filterParams as FilterValues} sort={query.sort} total={page.total}>
          {page.items.length === 0 ? (
            <div className="mt-8"><EmptyState icon={<SearchX className="h-8 w-8" />} title={query.q ? t("search.noResults") : t("catalog.empty")} hint={query.q ? t("search.noResultsHint") : t("catalog.emptyHint")} action={<Button asChild variant="outline"><Link href={categorySlug ? `/catalog/${categorySlug}` : "/catalog"}>{t("catalog.resetAll")}</Link></Button>} /></div>
          ) : (
            <>
              <ProductGrid items={page.items} className="mt-6 xl:grid-cols-3 2xl:grid-cols-4" />
              <Pagination page={page.page} pages={page.pages} basePath={categorySlug ? `/catalog/${categorySlug}` : "/catalog"} params={filterParams} />
            </>
          )}
        </Filters>
      </div>
      <JsonLd data={breadcrumbLd(crumbs.map((c) => ({ name: c.name, path: c.href ?? `/catalog/${categorySlug}` })))} />
    </div>
  );
}
