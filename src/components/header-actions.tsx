"use client";
import Link from "next/link";
import { Heart, Search, ShoppingBag, User } from "lucide-react";
import { useState } from "react";
import { useT } from "@/components/i18n-provider";
import { useMe } from "@/components/session-provider";
import { SearchBox } from "@/components/search-box";
import { logoutAction } from "@/actions/auth";

export function HeaderActions() {
  const t = useT();
  const { me } = useMe();
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const iconBtn = "relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-muted";

  return (
    <>
      <div className="flex items-center gap-0.5">
        <button className={`${iconBtn} md:hidden`} aria-label={t("common.search")} onClick={() => setSearchOpen((v) => !v)}><Search className="h-[19px] w-[19px]" /></button>
        <Link href={me.user ? "/account/wishlist" : "/login?callbackUrl=/account/wishlist"} className={`${iconBtn} hidden sm:grid`} aria-label={t("nav.wishlist")}>
          <Heart className="h-[19px] w-[19px]" />
          {me.wishlist.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />}
        </Link>
        <div className="relative" onMouseLeave={() => setMenu(false)}>
          {me.user ? (
            <>
              <button className={iconBtn} aria-label={t("nav.account")} aria-expanded={menu} onClick={() => setMenu((v) => !v)}><User className="h-[19px] w-[19px]" /></button>
              {menu && (
                <div className="absolute right-0 top-11 z-50 w-56 animate-fade-in rounded-xl border border-border bg-background p-1.5 shadow-xl">
                  <p className="truncate px-3 py-2 text-xs text-muted-foreground">{me.user.name}</p>
                  <Link onClick={() => setMenu(false)} href="/account/orders" className="block rounded-md px-3 py-2 text-sm hover:bg-muted">{t("nav.orders")}</Link>
                  <Link onClick={() => setMenu(false)} href="/account/wishlist" className="block rounded-md px-3 py-2 text-sm hover:bg-muted">{t("nav.wishlist")}</Link>
                  <Link onClick={() => setMenu(false)} href="/account/profile" className="block rounded-md px-3 py-2 text-sm hover:bg-muted">{t("nav.profile")}</Link>
                  {me.user.role !== "CUSTOMER" && <Link onClick={() => setMenu(false)} href="/admin" className="block rounded-md px-3 py-2 text-sm font-medium text-accent hover:bg-muted">{t("nav.admin")}</Link>}
                  <form action={logoutAction}><button className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted">{t("nav.logout")}</button></form>
                </div>
              )}
            </>
          ) : (
            <Link href="/login" className={iconBtn} aria-label={t("nav.login")}><User className="h-[19px] w-[19px]" /></Link>
          )}
        </div>
        <Link href="/cart" className={iconBtn} aria-label={`${t("nav.cart")}: ${me.cartCount}`}>
          <ShoppingBag className="h-[19px] w-[19px]" />
          {me.cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold leading-none text-accent-foreground tnum">{me.cartCount}</span>}
        </Link>
      </div>
      {searchOpen && <div className="absolute inset-x-0 top-full z-40 border-b border-border bg-background p-3 shadow-sm md:hidden"><SearchBox autoFocus /></div>}
    </>
  );
}
