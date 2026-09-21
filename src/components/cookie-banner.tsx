"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";

const setConsent = (v: "all" | "necessary") => {
  document.cookie = `consent=${v}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  window.dispatchEvent(new Event("consent-changed"));
};

export function CookieBanner() {
  const t = useT();
  const [show, setShow] = useState(false);
  useEffect(() => setShow(!document.cookie.includes("consent=")), []);
  if (!show) return null;
  return (
    <div role="dialog" aria-label={t("cookies.title")} className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-3xl animate-fade-in rounded-xl border border-border bg-background p-4 shadow-xl sm:inset-x-6 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1 text-sm">
          <p className="font-medium">{t("cookies.title")}</p>
          <p className="mt-1 text-muted-foreground">{t("cookies.text")} <Link href="/legal/cookies" className="underline">{t("cookies.more")}</Link></p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setConsent("necessary"); setShow(false); }}>{t("cookies.necessary")}</Button>
          <Button size="sm" onClick={() => { setConsent("all"); setShow(false); }}>{t("cookies.accept")}</Button>
        </div>
      </div>
    </div>
  );
}
