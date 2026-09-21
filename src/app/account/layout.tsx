import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { t } from "@/lib/t-static";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/account", label: "account.title" }, { href: "/account/orders", label: "nav.orders" }, { href: "/account/wishlist", label: "nav.wishlist" },
  { href: "/account/addresses", label: "nav.addresses" }, { href: "/account/profile", label: "nav.profile" }, { href: "/account/security", label: "nav.security" },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="container py-8 md:py-12">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight md:text-4xl">{t("account.title")}</h1>
      <div className="grid gap-8 md:grid-cols-[220px_1fr] md:gap-12">
        <nav aria-label={t("account.title")} className="flex gap-1 overflow-x-auto scrollbar-none md:flex-col">
          {NAV.map((n) => <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3.5 py-2.5 text-sm text-foreground/80 hover:bg-muted hover:text-foreground">{t(n.label)}</Link>)}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
