"use client";
import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { changePasswordAction } from "@/actions/auth";
import { deleteAddressAction, saveAddressAction, updateProfileAction } from "@/actions/account";
import { initialState } from "@/lib/action-state";
import { useT } from "@/components/i18n-provider";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function ProfileForm({ v }: { v: { firstName: string; lastName: string; phone: string; email: string } }) {
  const t = useT();
  const [s, action, pending] = useActionState(updateProfileAction, initialState);
  const fe = s.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-lg space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("auth.firstName")} error={fe.firstName}><Input name="firstName" defaultValue={v.firstName} required /></Field>
        <Field label={t("auth.lastName")} error={fe.lastName}><Input name="lastName" defaultValue={v.lastName} required /></Field>
      </div>
      <Field label={t("auth.email")}><Input value={v.email} disabled readOnly /></Field>
      <Field label={t("checkout.phone")} error={fe.phone}><Input name="phone" type="tel" defaultValue={v.phone} placeholder="+380" /></Field>
      {s.ok && <Alert variant="success">{t(s.message ?? "common.saved")}</Alert>}
      {s.error && <Alert variant="error">{t(s.error)}</Alert>}
      <Button loading={pending}>{t("account.saveProfile")}</Button>
    </form>
  );
}

export function PasswordForm() {
  const t = useT();
  const [s, action, pending] = useActionState(changePasswordAction, initialState);
  const fe = s.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-md space-y-4">
      <Field label={t("account.currentPassword")} error={fe.current}><Input name="current" type="password" autoComplete="current-password" required /></Field>
      <Field label={t("account.newPassword")} error={fe.next} hint={t("auth.passwordHint")}><Input name="next" type="password" autoComplete="new-password" minLength={10} required /></Field>
      {s.ok && <Alert variant="success">{t(s.message ?? "common.saved")}</Alert>}
      {s.error && <Alert variant="error">{t(s.error)}</Alert>}
      <Button loading={pending}>{t("account.changePassword")}</Button>
    </form>
  );
}

export function AddressForm() {
  const t = useT();
  const [s, action, pending] = useActionState(saveAddressAction, initialState);
  const fe = s.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-xl space-y-4 rounded-xl border border-border p-5">
      <h3 className="font-semibold">{t("account.addAddress")}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("checkout.firstName")} error={fe.firstName}><Input name="firstName" required /></Field>
        <Field label={t("checkout.lastName")} error={fe.lastName}><Input name="lastName" required /></Field>
        <Field label={t("checkout.phone")} error={fe.phone}><Input name="phone" type="tel" placeholder="+380" required /></Field>
        <Field label={t("checkout.city")} error={fe.city}><Input name="city" required /></Field>
        <Field label={t("checkout.warehouse")} className="sm:col-span-2"><Input name="warehouseName" placeholder="Відділення №…" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isDefault" className="accent-[hsl(var(--accent))]" />{t("account.default")}</label>
      {s.ok && <Alert variant="success">{t("common.saved")}</Alert>}
      {s.error && <Alert variant="error">{t(s.error)}</Alert>}
      <Button loading={pending}>{t("common.add")}</Button>
    </form>
  );
}

export function DeleteAddressButton({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button variant="ghost" size="icon" aria-label={t("common.delete")} loading={pending} onClick={() => start(async () => { await deleteAddressAction(id); router.refresh(); })}><Trash2 className="h-4 w-4" /></Button>;
}
