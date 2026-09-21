import type { Metadata } from "next";
import Link from "next/link";
import { t } from "@/lib/t-static";
import { peekToken } from "@/lib/tokens";
import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/misc";

export const metadata: Metadata = { title: t("auth.resetTitle"), robots: { index: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = token ? await peekToken(token, "PASSWORD_RESET") : false;
  return (
    <AuthShell title={t("auth.resetTitle")}>
      {valid && token ? <ResetForm token={token} /> : <Alert variant="error">{t("auth.resetInvalid")} <Link className="underline" href="/forgot-password">→</Link></Alert>}
    </AuthShell>
  );
}
