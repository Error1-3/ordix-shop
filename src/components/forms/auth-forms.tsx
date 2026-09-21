"use client";
import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, loginAction, registerAction, resendVerificationAction, resetPasswordAction } from "@/actions/auth";
import { initialState } from "@/lib/action-state";
import { useT } from "@/components/i18n-provider";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function LoginForm({ callbackUrl, notice }: { callbackUrl?: string; notice?: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(loginAction, initialState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      {notice && <Alert variant="success">{t(notice)}</Alert>}
      <Field label={t("auth.email")} htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label={t("auth.password")} htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
      {state.error && <Alert variant="error">{t(state.error)}</Alert>}
      <Button className="w-full" size="lg" loading={pending}>{t("auth.loginCta")}</Button>
      <div className="flex justify-between text-sm"><Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">{t("auth.forgot")}</Link><Link href="/register" className="text-accent">{t("auth.registerTitle")}</Link></div>
      {state.error === "auth.errors.email_not_verified" && <ResendVerification />}
    </form>
  );
}

function ResendVerification() {
  const t = useT();
  const [state, action, pending] = useActionState(resendVerificationAction, initialState);
  return (
    <form action={action} className="space-y-2 rounded-md bg-muted p-3">
      <Input name="email" type="email" placeholder={t("auth.email")} required />
      <Button variant="outline" size="sm" loading={pending}>{t("auth.resendVerify")}</Button>
      {state.ok && state.message && <p className="text-xs text-accent">{t(state.message)}</p>}
    </form>
  );
}

export function RegisterForm() {
  const t = useT();
  const [state, action, pending] = useActionState(registerAction, initialState);
  const fe = state.fieldErrors ?? {};
  if (state.ok) return <Alert variant="success">{t(state.message ?? "auth.registered")}</Alert>;
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("auth.firstName")} error={fe.firstName} htmlFor="firstName"><Input id="firstName" name="firstName" autoComplete="given-name" required /></Field>
        <Field label={t("auth.lastName")} error={fe.lastName} htmlFor="lastName"><Input id="lastName" name="lastName" autoComplete="family-name" required /></Field>
      </div>
      <Field label={t("auth.email")} error={fe.email} htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label={t("auth.phone")} error={fe.phone} htmlFor="phone"><Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+380" /></Field>
      <Field label={t("auth.password")} error={fe.password} hint={t("auth.passwordHint")} htmlFor="password"><Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /></Field>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="acceptTerms" required className="mt-0.5 h-4 w-4 accent-[hsl(var(--accent))]" /><span>{t("auth.acceptTerms")} (<Link className="underline" href="/legal/terms" target="_blank">{t("legal.terms")}</Link>)</span></label>
      {fe.acceptTerms && <p role="alert" className="text-xs text-destructive">{fe.acceptTerms}</p>}
      {state.error && <Alert variant="error">{t(state.error)}</Alert>}
      <Button className="w-full" size="lg" loading={pending}>{t("auth.registerCta")}</Button>
      <p className="text-center text-sm text-muted-foreground">{t("auth.haveAccount")} <Link href="/login" className="text-accent">{t("auth.loginCta")}</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const t = useT();
  const [state, action, pending] = useActionState(forgotPasswordAction, initialState);
  if (state.ok) return <Alert variant="success">{t(state.message ?? "auth.forgotSent")}</Alert>;
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("auth.forgotText")}</p>
      <Field label={t("auth.email")} error={state.fieldErrors?.email} htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      {state.error && <Alert variant="error">{t(state.error)}</Alert>}
      <Button className="w-full" size="lg" loading={pending}>{t("common.continue")}</Button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);
  if (state.ok) return (<div className="space-y-4"><Alert variant="success">{t("auth.resetDone")}</Alert><Button asChild className="w-full"><Link href="/login">{t("auth.loginCta")}</Link></Button></div>);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label={t("account.newPassword")} error={state.fieldErrors?.password} hint={t("auth.passwordHint")} htmlFor="password"><Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /></Field>
      {state.error && <Alert variant="error">{t(state.error)} <Link className="underline" href="/forgot-password">→</Link></Alert>}
      <Button className="w-full" size="lg" loading={pending}>{t("auth.resetCta")}</Button>
    </form>
  );
}
