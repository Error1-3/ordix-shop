import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { t } from "@/lib/t-static";
import { consumeToken } from "@/lib/tokens";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Підтвердження e-mail", robots: { index: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const res = token ? await consumeToken(token, "EMAIL_VERIFY") : null;
  if (res) await db.user.updateMany({ where: { email: res.email, emailVerified: null }, data: { emailVerified: new Date() } });
  return (
    <AuthShell title={t("auth.loginTitle")}>
      <Alert variant={res ? "success" : "error"}>{res ? t("auth.verifyOk") : t("auth.verifyInvalid")}</Alert>
      <Button asChild className="mt-5 w-full"><Link href="/login">{t("auth.loginCta")}</Link></Button>
    </AuthShell>
  );
}
