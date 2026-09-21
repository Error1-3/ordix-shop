import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";
import { t } from "@/lib/t-static";
import { Button } from "./ui/button";
import { BatteryRing } from "./battery-ring";

const CHECKS = ["diagScreen", "diagCameras", "diagFaceId"] as const;

export function Hero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.5)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_75%)]" />
      <div className="container grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3.5 py-1.5 text-[13px] text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />{t("home.heroBadge")}
          </span>
          <h1 className="mt-6 max-w-2xl text-balance text-[2.5rem] font-semibold leading-[1.04] tracking-tight sm:text-5xl lg:text-[4.25rem]">{title}</h1>
          <p className="mt-5 max-w-xl text-pretty text-base text-muted-foreground md:text-lg">{subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg"><Link href="/catalog/iphone">{t("home.heroCta")}</Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/catalog?condition=LIKE_NEW,EXCELLENT,GOOD,FAIR">{t("home.heroCtaUsed")}</Link></Button>
          </div>
        </div>

        {/* Illustrative inspection report — shows what every used device page contains. */}
        <div className="relative mx-auto w-full max-w-[440px] lg:mx-0 lg:ml-auto" aria-hidden>
          <div className="absolute -inset-4 -z-10 rotate-[3deg] rounded-[28px] bg-muted" />
          <div className="rounded-2xl border border-border bg-background p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("home.diagTitle")}</p>
                <p className="mt-1 text-lg font-semibold">iPhone 13 · 128 GB</p>
              </div>
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">A</span>
            </div>
            <div className="mt-6 flex items-center gap-5 rounded-xl bg-muted/70 p-4">
              <BatteryRing value={94} size={76} />
              <div>
                <p className="text-sm font-medium">{t("home.diagBattery")}</p>
                <p className="text-xs text-muted-foreground tnum">94% · 187 циклів</p>
              </div>
            </div>
            <ul className="mt-5 space-y-3">
              {CHECKS.map((k) => (
                <li key={k} className="flex items-center justify-between text-sm">
                  <span>{t(`home.${k}`)}</span>
                  <span className="flex items-center gap-1.5 text-accent"><Check className="h-4 w-4" />{t("home.diagPassed")}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-muted-foreground">{t("product.warranty")}</span><span className="font-medium">3 міс.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
