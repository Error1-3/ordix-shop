import Link from "next/link";
import { db } from "@/lib/db";
import { t } from "@/lib/t-static";
import { consumeToken } from "@/lib/tokens";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Підписка", robots: { index: false }, referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";

export default async function NewsletterConfirm({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const res = token ? await consumeToken(token, "NEWSLETTER_CONFIRM") : null;
  if (res) await db.newsletterSubscriber.updateMany({ where: { email: res.email }, data: { confirmedAt: new Date(), unsubscribedAt: null } });
  return (
    <AuthShell title={t("home.newsletterTitle")}>
      <Alert variant={res ? "success" : "error"}>{res ? t("common.saved") : t("auth.verifyInvalid")}</Alert>
      <Button asChild className="mt-5 w-full"><Link href="/">{t("errors.home")}</Link></Button>
    </AuthShell>
  );
}
