"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteProductAction, duplicateProductAction, setProductActiveAction } from "@/actions/admin-products";
import { useT } from "@/components/i18n-provider";
import { Button } from "./ui/button";

export function ProductRowActions({ id, active, canDelete }: { id: string; active: boolean; canDelete: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => duplicateProductAction(id))}>{t("admin.duplicate")}</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setProductActiveAction(id, !active))}>{active ? t("admin.deactivate") : t("admin.activate")}</Button>
      {canDelete && <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => { if (confirm(t("admin.confirmDelete"))) run(() => deleteProductAction(id)); }}>{t("common.delete")}</Button>}
    </div>
  );
}
