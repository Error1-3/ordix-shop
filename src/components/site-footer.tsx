import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { t } from "@/lib/t-static";
import { Logo } from "./logo";

const LEGAL = ["terms", "privacy", "cookies", "delivery", "payment", "returns", "warranty", "offer"] as const;

export async function SiteFooter() {
  const s = (await getSettings()).store;
  const socials = Object.entries(s.social).filter(([, v]) => v);
  return (
    <footer className="mt-24 border-t border-border bg-muted/50">
      <div className="container grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo name={s.name} logoUrl={s.logoUrl} />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">{t("footer.paymentsBy")}</p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">{t("footer.shop")}</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link className="hover:text-foreground" href="/catalog/iphone">iPhone</Link></li>
            <li><Link className="hover:text-foreground" href="/catalog?condition=LIKE_NEW,EXCELLENT,GOOD,FAIR">{t("nav.used")}</Link></li>
            <li><Link className="hover:text-foreground" href="/catalog/macbook">MacBook</Link></li>
            <li><Link className="hover:text-foreground" href="/catalog/ipad">iPad</Link></li>
            <li><Link className="hover:text-foreground" href="/catalog/airpods">AirPods</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">{t("footer.info")}</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {LEGAL.map((k) => <li key={k}><Link className="hover:text-foreground" href={`/legal/${k}`}>{t(`legal.${k}`)}</Link></li>)}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">{t("footer.contacts")}</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {s.phone && <li><a className="hover:text-foreground" href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>{s.phone}</a></li>}
            {s.email && <li><a className="hover:text-foreground" href={`mailto:${s.email}`}>{s.email}</a></li>}
            {s.workingHours && <li>{s.workingHours}</li>}
            {s.address && <li>{s.address}</li>}
            {socials.map(([k, v]) => <li key={k}><a className="capitalize hover:text-foreground" href={v} rel="noopener noreferrer nofollow" target="_blank">{k}</a></li>)}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container flex flex-col gap-2 py-6 text-xs text-muted-foreground md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} {s.legalName || s.name}. {t("footer.rights")}</p>
          <p className="max-w-2xl md:text-right">{t("footer.disclaimer", { store: s.name })}</p>
        </div>
      </div>
    </footer>
  );
}
