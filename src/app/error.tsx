"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="container grid min-h-[60dvh] place-items-center py-20 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("errors.serverTitle")}</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">{t("errors.serverText")}</p>
        {error.digest && <p className="mt-3 text-xs text-muted-foreground tnum">ref: {error.digest}</p>}
        <div className="mt-8 flex justify-center gap-3"><Button onClick={reset}>{t("errors.retry")}</Button><Button asChild variant="outline"><Link href="/">{t("errors.home")}</Link></Button></div>
      </div>
    </div>
  );
}
