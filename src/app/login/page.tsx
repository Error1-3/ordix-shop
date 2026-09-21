import type { Metadata } from "next";
import { t } from "@/lib/t-static";
import { safeRedirectPath } from "@/lib/sanitize";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: t("auth.loginTitle"), robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; verified?: string }> }) {
  const sp = await searchParams;
  return <AuthShell title={t("auth.loginTitle")}><LoginForm callbackUrl={safeRedirectPath(sp.callbackUrl, "")} notice={sp.verified ? "auth.verifyOk" : undefined} /></AuthShell>;
}
