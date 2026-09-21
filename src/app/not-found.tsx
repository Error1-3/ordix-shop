import Link from "next/link";
import { t } from "@/lib/t-static";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container grid min-h-[60dvh] place-items-center py-20 text-center">
      <div>
        <p className="text-7xl font-semibold tracking-tighter text-muted-foreground/40 tnum">404</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("errors.notFoundTitle")}</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">{t("errors.notFoundText")}</p>
        <div className="mt-8 flex justify-center gap-3"><Button asChild><Link href="/catalog">{t("nav.catalog")}</Link></Button><Button asChild variant="outline"><Link href="/">{t("errors.home")}</Link></Button></div>
      </div>
    </div>
  );
}
