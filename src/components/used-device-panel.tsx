"use client";
import { Check, Minus, X } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import type { PublicUsedDevice } from "@/lib/public-dto";
import { BatteryRing } from "./battery-ring";
import { cn } from "@/lib/utils";

function StatusIcon({ s }: { s: string }) {
  if (s === "OK") return <Check className="h-4 w-4 text-accent" aria-hidden />;
  if (s === "DEFECT") return <X className="h-4 w-4 text-destructive" aria-hidden />;
  return <Minus className="h-4 w-4 text-muted-foreground" aria-hidden />;
}

/** "Стан пристрою" — everything the customer needs to trust a used device. Only PUBLIC fields are ever passed in. */
export function UsedDevicePanel({ d, condition }: { d: PublicUsedDevice; condition: string }) {
  const t = useT();
  const functions: { key: string; value: string }[] = [
    { key: "cameras", value: d.cameraCondition }, { key: "faceId", value: d.faceIdStatus }, { key: "touchId", value: d.touchIdStatus }, { key: "trueTone", value: d.trueToneStatus },
    { key: "speaker", value: d.speakerStatus }, { key: "microphone", value: d.microphoneStatus }, { key: "chargingPort", value: d.chargingPortStatus },
    { key: "wifi", value: d.wifiStatus }, { key: "bluetooth", value: d.bluetoothStatus }, { key: "sim", value: d.simStatus },
  ].filter((f) => f.value !== "NOT_APPLICABLE");

  return (
    <section aria-labelledby="used-title" className="rounded-2xl border border-border bg-background p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="used-title" className="text-xl font-semibold tracking-tight">{t("product.used.title")}</h2>
        <div className="flex gap-2">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{t(`condition.${condition}`)}</span>
          {d.deviceGrade && <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">{t("product.used.grade")} {t(`grade.${d.deviceGrade}`)}</span>}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
        <div className="space-y-4">
          {d.batteryHealth != null && (
            <div className="flex items-center gap-4 rounded-xl bg-muted/70 p-4">
              <BatteryRing value={d.batteryHealth} size={84} />
              <div>
                <p className="text-sm font-semibold">{t("product.used.battery")}</p>
                <p className="text-2xl font-semibold tracking-tight tnum">{d.batteryHealth}%</p>
                {d.cycleCount != null && <p className="text-xs text-muted-foreground tnum">{t("product.used.cycles")}: {d.cycleCount}</p>}
              </div>
            </div>
          )}
          <dl className="space-y-3 text-sm">
            {d.screenCondition && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t("product.used.screen")}</dt><dd className="text-right font-medium">{t(`physical.${d.screenCondition}`)}</dd></div>}
            {d.physicalCondition && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t("product.used.body")}</dt><dd className="text-right font-medium">{t(`physical.${d.physicalCondition}`)}</dd></div>}
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t("product.used.warranty")}</dt><dd className="font-medium tnum">{t("product.months", { n: d.warrantyMonths })}</dd></div>
          </dl>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">{t("product.used.functions")}</h3>
          <ul className="grid gap-x-8 sm:grid-cols-2">
            {functions.map((f) => (
              <li key={f.key} className="flex items-center justify-between border-b border-border py-2.5 text-sm">
                <span>{t(`product.used.${f.key}`)}</span>
                <span className={cn("flex items-center gap-1.5", f.value === "DEFECT" && "text-destructive")}><StatusIcon s={f.value} />{t(`functional.${f.value}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 grid gap-6 border-t border-border pt-6 md:grid-cols-3">
        <div><h3 className="mb-1.5 text-sm font-semibold">{t("product.used.accessories")}</h3><p className="text-sm text-muted-foreground">{d.accessoriesIncluded.length ? d.accessoriesIncluded.join(", ") : t("product.used.noAccessories")}</p></div>
        <div><h3 className="mb-1.5 text-sm font-semibold">{t("product.used.defects")}</h3><p className="whitespace-pre-line text-sm text-muted-foreground">{d.defects || t("product.used.noDefects")}</p></div>
        {d.inspectionNotes && <div><h3 className="mb-1.5 text-sm font-semibold">{t("product.used.notes")}</h3><p className="whitespace-pre-line text-sm text-muted-foreground">{d.inspectionNotes}</p></div>}
      </div>
    </section>
  );
}
