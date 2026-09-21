"use client";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useT } from "@/components/i18n-provider";

export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted lg:hidden" aria-label={t("nav.menu")}><Menu className="h-5 w-5" /></SheetTrigger>
      <SheetContent side="left" title={t("nav.menu")}>
        <nav className="flex flex-col p-3">
          {links.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-3.5 text-[17px] font-medium hover:bg-muted">{l.label}</Link>)}
          <hr className="my-3 border-border" />
          <Link href="/account/orders" onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-[15px] text-muted-foreground hover:bg-muted">{t("nav.orders")}</Link>
          <Link href="/account/wishlist" onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-[15px] text-muted-foreground hover:bg-muted">{t("nav.wishlist")}</Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
