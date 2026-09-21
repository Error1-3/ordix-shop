import { getSettings } from "@/lib/settings";
import { t } from "@/lib/t-static";
import { getHomeSections, getLatestReviews } from "@/services/catalog";
import { Hero } from "@/components/hero";
import { ProductRail } from "@/components/section";
import { Benefits, HomeFaq, NewsletterBand, ReviewsStrip, HOME_FAQ } from "@/components/home-sections";
import { JsonLd } from "@/components/json-ld";
import { faqLd } from "@/lib/seo";

// Data is cached in the data layer (unstable_cache, tag "catalog"); rendered on demand so `next build` needs no database.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [s, sec, reviews] = await Promise.all([getSettings(), getHomeSections(), getLatestReviews(3)]);
  return (
    <>
      <Hero title={s.homepage.heroTitle} subtitle={s.homepage.heroSubtitle} />
      <ProductRail title={t("home.popularIphone")} href="/catalog/iphone?sort=popular" items={sec.popularIphone} />
      <ProductRail title={t("home.newIphone")} href="/catalog/iphone?condition=NEW&sort=newest" items={sec.newIphone} />
      {s.homepage.showUsed && <ProductRail title={t("home.usedIphone")} href="/catalog/iphone?condition=EXCELLENT,GOOD,FAIR" items={sec.usedIphone} />}
      {s.homepage.showRefurbished && <ProductRail title={t("home.refurbished")} href="/catalog/iphone?condition=LIKE_NEW" items={sec.refurbished} />}
      <Benefits />
      <ProductRail title={t("home.macbook")} href="/catalog/macbook" items={sec.macbook} />
      <ProductRail title={t("home.ipad")} href="/catalog/ipad" items={sec.ipad} />
      <ProductRail title={t("home.watch")} href="/catalog/apple-watch" items={sec.watch} />
      <ProductRail title={t("home.airpods")} href="/catalog/airpods" items={sec.airpods} />
      <ProductRail title={t("home.accessories")} href="/catalog/accessories" items={sec.accessories} />
      <ReviewsStrip reviews={reviews} />
      <HomeFaq />
      <NewsletterBand />
      <JsonLd data={faqLd(HOME_FAQ)} />
    </>
  );
}
