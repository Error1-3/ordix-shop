import type { Metadata } from "next";
import { t } from "@/lib/t-static";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: t("auth.forgotTitle"), robots: { index: false } };
export default function ForgotPage() { return <AuthShell title={t("auth.forgotTitle")}><ForgotForm /></AuthShell>; }
