"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { adminAddNoteAction, adminAttachTtnAction, adminChangeStatusAction, adminCreateShipmentAction, adminRefundAction } from "@/actions/admin-orders";
import { useT } from "@/components/i18n-provider";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";

export function AdminOrderActions({ orderId, allowed, canRefund, canShip, hasShipment, isCourier, refundable }: { orderId: string; allowed: string[]; canRefund: boolean; canShip: boolean; hasShipment: boolean; isCourier: boolean; refundable: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState(allowed[0] ?? "");
  const [note, setNote] = useState("");
  const [ttn, setTtn] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? t("common.saved")); else toast.error(r.error ?? t("common.genericError"));
      router.refresh();
    });

  return (
    <div className="space-y-6 rounded-2xl border border-border p-5">
      <h2 className="font-semibold">{t("admin.orderActions")}</h2>
      {allowed.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="st">{t("admin.changeStatus")}</label>
          <div className="flex gap-2"><Select id="st" value={status} onChange={(e) => setStatus(e.target.value)}>{allowed.filter((s) => s !== "REFUNDED").map((s) => <option key={s} value={s}>{t(`orderStatus.${s}`)}</option>)}</Select><Button loading={pending} onClick={() => run(() => adminChangeStatusAction(orderId, status, note))}>{t("common.apply")}</Button></div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Коментар (необов'язково)" maxLength={300} />
        </div>
      )}
      {canShip && !hasShipment && !isCourier && <Button variant="outline" className="w-full" loading={pending} onClick={() => run(() => adminCreateShipmentAction(orderId))}>{t("admin.createTtn")}</Button>}
      {canShip && (
        <div className="space-y-2"><label className="text-sm font-medium" htmlFor="ttn">{t("admin.attachTtn")}</label>
          <div className="flex gap-2"><Input id="ttn" value={ttn} onChange={(e) => setTtn(e.target.value)} inputMode="numeric" placeholder="20450000000000" maxLength={16} /><Button variant="outline" loading={pending} disabled={!ttn} onClick={() => run(() => adminAttachTtnAction(orderId, ttn))}>{t("common.add")}</Button></div></div>
      )}
      <div className="flex gap-2"><Input placeholder="Внутрішня нотатка" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /><Button variant="outline" loading={pending} disabled={!note} onClick={() => run(async () => { const r = await adminAddNoteAction(orderId, note); setNote(""); return r; })}>{t("common.add")}</Button></div>
      {canRefund && refundable && <Button variant="destructive" className="w-full" loading={pending} onClick={() => { if (confirm(t("admin.refundConfirm"))) run(() => adminRefundAction(orderId)); }}>{t("admin.refund")}</Button>}
    </div>
  );
}
