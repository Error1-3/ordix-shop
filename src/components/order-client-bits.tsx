"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { retryPaymentAction } from "@/actions/checkout";
import { cancelOwnOrderAction } from "@/actions/account";
import { useT } from "@/components/i18n-provider";
import { track } from "@/lib/analytics";
import { Button } from "./ui/button";

/** Re-fetches the (server-verified) order state while the bank/LiqPay callback is still in flight. Never decides anything itself. */
export function PaymentPoller({ active }: { active: boolean }) {
  const router = useRouter();
  const n = useRef(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => { if (++n.current > 20) clearInterval(id); else router.refresh(); }, 4000);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}

/** Fires GA4/Pixel `purchase` once per order, and only when the SERVER says it is paid (or accepted as COD). */
export function PurchaseTracker({ number, value, confirmed }: { number: string; value: number; confirmed: boolean }) {
  useEffect(() => {
    if (!confirmed) return;
    const key = `purchase:${number}`;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch { /* ignore */ }
    track("purchase", { transaction_id: number, value: value / 100 });
  }, [confirmed, number, value]);
  return null;
}

export function RefundTracker({ number, value, active }: { number: string; value: number; active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const key = `refund:${number}`;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch { /* ignore */ }
    track("refund", { transaction_id: number, value: value / 100 });
  }, [active, number, value]);
  return null;
}

export function PayAgainButton({ orderId, token }: { orderId: string; token?: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [redirect, setRedirect] = useState<{ url: string; fields: Record<string, string> } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (redirect) form.current?.submit(); }, [redirect]);
  return (
    <>
      <Button loading={pending} onClick={() => start(async () => { const r = await retryPaymentAction(orderId, token); if (r.ok && r.redirect) setRedirect(r.redirect); else toast.error(t(r.error ?? "common.networkError")); })}>{t("checkout.result.retry")}</Button>
      {redirect && <form ref={form} action={redirect.url} method="POST" acceptCharset="utf-8">{Object.entries(redirect.fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}</form>}
    </>
  );
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" loading={pending} onClick={() => { if (!confirm(t("common.confirm") + "?")) return; start(async () => { const r = await cancelOwnOrderAction(orderId); if (!r.ok) toast.error(t(r.error ?? "common.genericError")); router.refresh(); }); }}>{t("account.cancelOrder")}</Button>
  );
}
