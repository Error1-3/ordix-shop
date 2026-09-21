"use client";
import { useActionState } from "react";
import { subscribeNewsletterAction } from "@/actions/account";
import { initialState } from "@/lib/action-state";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewsletterForm({ dark }: { dark?: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(subscribeNewsletterAction, initialState);
  return (
    <form action={action} className="w-full max-w-md">
      <div className="flex gap-2">
        <Input type="email" name="email" required autoComplete="email" placeholder={t("newsletter.placeholder")} aria-label={t("newsletter.placeholder")} className={dark ? "border-white/20 bg-white/10 text-white placeholder:text-white/50" : ""} />
        <Button loading={pending} variant={dark ? "accent" : "default"}>{t("newsletter.subscribe")}</Button>
      </div>
      {state.fieldErrors?.email && <p role="alert" className="mt-2 text-xs text-red-400">{state.fieldErrors.email}</p>}
      {state.error && <p role="alert" className="mt-2 text-xs text-red-400">{t(state.error)}</p>}
      {state.ok && state.message && <p role="status" className="mt-2 text-xs opacity-80">{t(state.message)}</p>}
    </form>
  );
}
