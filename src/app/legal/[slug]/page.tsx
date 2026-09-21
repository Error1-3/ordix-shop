import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/env";
import { LEGAL_DOCS, renderLegal } from "@/lib/legal-content";
import { t } from "@/lib/t-static";
import { Alert } from "@/components/ui/misc";
import { Breadcrumbs } from "@/components/breadcrumbs";

export const revalidate = 3600;
export function generateStaticParams() { return LEGAL_DOCS.map((d) => ({ slug: d.slug })); }

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  return doc ? { title: doc.title, alternates: { canonical: `/legal/${doc.slug}` } } : {};
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  if (!doc) notFound();
  const s = (await getSettings()).store;
  const vars = { store: s.name, legalName: s.legalName, taxId: s.taxId, address: s.address, email: s.email, phone: s.phone, siteUrl: siteUrl() };
  return (
    <div className="container max-w-3xl py-10 md:py-16">
      <Breadcrumbs items={[{ name: t("nav.catalog"), href: "/" }, { name: doc.title }]} />
      <h1 className="mb-6 text-3xl font-semibold tracking-tight md:text-4xl">{doc.title}</h1>
      <Alert variant="warning" className="mb-10">{t("legal.draftNotice")}</Alert>
      <article className="space-y-8">
        {doc.sections.map((sec) => (
          <section key={sec.h}><h2 className="mb-3 text-lg font-semibold">{sec.h}</h2>
            {sec.p.map((para, i) => <p key={i} className={`mb-2.5 leading-relaxed ${para.includes("[УТОЧНІТЬ") ? "rounded bg-amber-50 px-3 py-2 text-warning" : "text-muted-foreground"}`}>{renderLegal(para, vars)}</p>)}
          </section>
        ))}
      </article>
    </div>
  );
}
