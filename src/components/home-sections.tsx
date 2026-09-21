import Link from "next/link";
import { CreditCard, Headphones, ShieldCheck, Star, Truck, BadgeCheck } from "lucide-react";
import { t } from "@/lib/t-static";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { NewsletterForm } from "./newsletter-form";

const BENEFITS = [
  { key: "warranty", Icon: ShieldCheck }, { key: "verified", Icon: BadgeCheck }, { key: "payment", Icon: CreditCard }, { key: "delivery", Icon: Truck }, { key: "support", Icon: Headphones },
] as const;

export function Benefits() {
  return (
    <section className="border-y border-border bg-muted/40 py-14 md:py-20" aria-labelledby="benefits">
      <div className="container">
        <h2 id="benefits" className="mb-10 text-2xl font-semibold tracking-tight md:text-3xl">{t("home.benefitsTitle")}</h2>
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
          {BENEFITS.map(({ key, Icon }) => (
            <div key={key}>
              <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-background shadow-sm ring-1 ring-border"><Icon className="h-5 w-5 text-accent" aria-hidden /></span>
              <h3 className="font-semibold">{t(`home.benefits.${key}.title`)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(`home.benefits.${key}.text`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ReviewsStrip({ reviews }: { reviews: { id: string; rating: number; title: string; body: string; author: string; product: { title: string; slug: string } }[] }) {
  if (!reviews.length) return null;
  return (
    <section className="container py-14 md:py-20" aria-labelledby="reviews">
      <h2 id="reviews" className="mb-8 text-2xl font-semibold tracking-tight md:text-3xl">{t("home.reviewsTitle")}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {reviews.slice(0, 3).map((r) => (
          <figure key={r.id} className="flex flex-col rounded-xl border border-border p-6">
            <div className="flex gap-0.5" aria-label={`${r.rating}/5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-border"}`} />)}</div>
            <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed"><strong className="block">{r.title}</strong><span className="line-clamp-4 text-muted-foreground">{r.body}</span></blockquote>
            <figcaption className="mt-5 text-sm"><span className="font-medium">{r.author}</span> · <Link href={`/product/${r.product.slug}`} className="text-muted-foreground hover:text-foreground">{r.product.title}</Link></figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export const HOME_FAQ = [1, 2, 3, 4, 5].map((n) => ({ q: t(`faq.q${n}`), a: t(`faq.a${n}`) }));

export function HomeFaq() {
  return (
    <section className="container max-w-3xl py-14 md:py-20" aria-labelledby="faq">
      <h2 id="faq" className="mb-6 text-2xl font-semibold tracking-tight md:text-3xl">{t("home.faqTitle")}</h2>
      <Accordion type="single" collapsible>
        {HOME_FAQ.map((f, i) => (
          <AccordionItem key={i} value={`q${i}`}><AccordionTrigger>{f.q}</AccordionTrigger><AccordionContent>{f.a}</AccordionContent></AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export function NewsletterBand() {
  return (
    <section className="container">
      <div className="flex flex-col items-start justify-between gap-8 rounded-2xl bg-primary px-6 py-10 text-primary-foreground md:flex-row md:items-center md:px-12 md:py-14">
        <div className="max-w-md"><h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("home.newsletterTitle")}</h2><p className="mt-2 text-sm text-white/70">{t("home.newsletterText")}</p></div>
        <NewsletterForm dark />
      </div>
    </section>
  );
}
