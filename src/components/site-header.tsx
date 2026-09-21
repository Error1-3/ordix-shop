import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { t } from "@/lib/t-static";
import { Logo } from "./logo";
import { SearchBox } from "./search-box";
import { HeaderActions } from "./header-actions";
import { MobileNav } from "./mobile-nav";

const NAV = [
  { href: "/catalog/iphone", key: "iPhone" },
  { href: "/catalog?condition=LIKE_NEW,EXCELLENT,GOOD,FAIR", key: "nav.used" },
  { href: "/catalog/ipad", key: "iPad" },
  { href: "/catalog/macbook", key: "MacBook" },
  { href: "/catalog/apple-watch", key: "Apple Watch" },
  { href: "/catalog/airpods", key: "AirPods" },
  { href: "/catalog/accessories", key: "nav.accessories" },
];

export async function SiteHeader() {
  const s = await getSettings();
  const links = NAV.map((n) => ({ href: n.href, label: n.key.startsWith("nav.") ? (n.key === "nav.accessories" ? t("home.accessories") : t(n.key)) : n.key }));
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      {s.homepage.announcement && <div className="bg-primary px-4 py-2 text-center text-[13px] text-primary-foreground">{s.homepage.announcement}</div>}
      <div className="container relative flex h-16 items-center gap-3">
        <MobileNav links={links} />
        <Logo name={s.store.name} logoUrl={s.store.logoUrl} />
        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label={t("nav.catalog")}>
          {links.map((l) => <Link key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-[14px] text-foreground/75 transition-colors hover:bg-muted hover:text-foreground">{l.label}</Link>)}
        </nav>
        <div className="ml-auto hidden w-full max-w-sm md:block xl:max-w-md"><SearchBox /></div>
        <div className="ml-auto md:ml-0"><HeaderActions /></div>
      </div>
    </header>
  );
}
