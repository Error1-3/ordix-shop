import type { Metadata } from "next";
import { t } from "@/lib/t-static";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: t("auth.registerTitle"), robots: { index: false } };
export default function RegisterPage() { return <AuthShell title={t("auth.registerTitle")}><RegisterForm /></AuthShell>; }
