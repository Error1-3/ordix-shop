"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { buildQuery } from "@/lib/utils";

export type Facets = { models: string[]; storages: string[]; colors: string[]; conditions: string[]; minPrice: number; maxPrice: number };
export type FilterValues = Record<string, string | undefined>;

const CONDITION_ORDER = ["NEW", "LIKE_NEW", "EXCELLENT", "GOOD", "FAIR"];
const csv = (v?: string) => (v ? v.split(",").filter(Boolean) : []);
const toggle = (v: string | undefined, item: string) => {
  const set = new Set(csv(v));
  set.has(item) ? set.delete(item) : set.add(item);
  return [...set].join(",") || undefined;
};
const KEYS = ["model", "condition", "storage", "color", "minPrice", "maxPrice", "minBattery", "minWarranty", "inStock", "brand"] as const;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="border-b border-border py-5 first:pt-0"><legend className="mb-3 text-sm font-semibold">{title}</legend>{children}</fieldset>;
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded border-input accent-[hsl(var(--accent))]" />
      <span>{label}</span>
    </label>
  );
}

function Panel({ facets, values, set }: { facets: Facets; values: FilterValues; set: (patch: FilterValues) => void }) {
  const t = useT();
  const [min, setMin] = useState(values.minPrice ?? "");
  const [max, setMax] = useState(values.maxPrice ?? "");
  useEffect(() => { setMin(values.minPrice ?? ""); setMax(values.maxPrice ?? ""); }, [values.minPrice, values.maxPrice]);
  const conditions = CONDITION_ORDER.filter((c) => facets.conditions.includes(c));
  return (
    <div>
      {facets.models.length > 1 && (
        <Group title={t("catalog.model")}>
          <Select value={values.model ?? ""} onChange={(e) => set({ model: e.target.value || undefined })} aria-label={t("catalog.model")}>
            <option value="">{t("common.all")}</option>
            {facets.models.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Group>
      )}
      <Group title={t("catalog.price")}>
        <div className="flex items-center gap-2">
          <Input inputMode="numeric" placeholder={`${t("catalog.priceFrom")} ${facets.minPrice}`} value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} onBlur={() => set({ minPrice: min || undefined })} onKeyDown={(e) => e.key === "Enter" && set({ minPrice: min || undefined })} aria-label={t("catalog.priceFrom")} />
          <span className="text-muted-foreground">–</span>
          <Input inputMode="numeric" placeholder={`${t("catalog.priceTo")} ${facets.maxPrice}`} value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} onBlur={() => set({ maxPrice: max || undefined })} onKeyDown={(e) => e.key === "Enter" && set({ maxPrice: max || undefined })} aria-label={t("catalog.priceTo")} />
        </div>
      </Group>
      <Group title={t("catalog.condition")}>
        {conditions.map((c) => <Check key={c} label={t(`condition.${c}`)} checked={csv(values.condition).includes(c)} onChange={() => set({ condition: toggle(values.condition, c) })} />)}
      </Group>
      {facets.storages.length > 0 && (
        <Group title={t("catalog.storage")}>
          <div className="flex flex-wrap gap-2">
            {facets.storages.map((s) => {
              const on = csv(values.storage).includes(s);
              return <button type="button" key={s} aria-pressed={on} onClick={() => set({ storage: toggle(values.storage, s) })} className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${on ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40"}`}>{s}</button>;
            })}
          </div>
        </Group>
      )}
      {facets.colors.length > 0 && (
        <Group title={t("catalog.color")}>{facets.colors.map((c) => <Check key={c} label={c} checked={csv(values.color).includes(c)} onChange={() => set({ color: toggle(values.color, c) })} />)}</Group>
      )}
      <Group title={t("catalog.battery")}>
        <Select value={values.minBattery ?? ""} onChange={(e) => set({ minBattery: e.target.value || undefined })} aria-label={t("catalog.battery")}>
          <option value="">{t("common.all")}</option>{[80, 85, 90, 95].map((b) => <option key={b} value={b}>≥ {b}%</option>)}
        </Select>
      </Group>
      <Group title={t("catalog.warranty")}>
        <Select value={values.minWarranty ?? ""} onChange={(e) => set({ minWarranty: e.target.value || undefined })} aria-label={t("catalog.warranty")}>
          <option value="">{t("common.all")}</option>{[3, 6, 12].map((m) => <option key={m} value={m}>≥ {m} {t("product.months", { n: "" }).trim() || "міс."}</option>)}
        </Select>
      </Group>
      <Group title={t("catalog.availability")}>
        <Check label={t("catalog.inStock")} checked={values.inStock === "1"} onChange={() => set({ inStock: values.inStock === "1" ? undefined : "1" })} />
      </Group>
    </div>
  );
}

export function Filters({ facets, values, sort, total, children }: { facets: Facets; values: FilterValues; sort: string; total: number; children: React.ReactNode }) {
  const t = useT();
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<FilterValues>(values);
  const [open, setOpen] = useState(false);
  useEffect(() => setDraft(values), [values]);

  const push = (next: FilterValues, nextSort = sort) => start(() => router.push(`${path}${buildQuery({ ...next, sort: nextSort === "recommended" ? undefined : nextSort, page: undefined })}`, { scroll: false }));
  const active = KEYS.filter((k) => values[k]).length;

  return (
    <div className="lg:flex lg:gap-10">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block" aria-label={t("catalog.filters")} aria-busy={pending}>
        <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-3">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold">{t("catalog.filters")}</h2>{active > 0 && <button className="text-[13px] text-accent" onClick={() => push({ q: values.q })}>{t("catalog.resetAll")}</button>}</div>
          <Panel facets={facets} values={values} set={(patch) => push({ ...values, ...patch })} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
      {/* Toolbar (sort + mobile drawer) */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">{t("catalog.found", { count: total })}</p>
        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden"><SlidersHorizontal className="h-4 w-4" />{t("catalog.filters")}{active > 0 && <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] text-accent-foreground">{active}</span>}</Button>
            </SheetTrigger>
            <SheetContent side="bottom" title={t("catalog.filters")}>
              <div className="p-5"><Panel facets={facets} values={draft} set={(patch) => setDraft((d) => ({ ...d, ...patch }))} /></div>
              <div className="sticky bottom-0 flex gap-3 border-t border-border bg-background p-4">
                <Button variant="outline" className="flex-1" onClick={() => { setDraft({ q: values.q }); push({ q: values.q }); setOpen(false); }}>{t("common.reset")}</Button>
                <SheetClose asChild><Button className="flex-1" onClick={() => push(draft)}>{t("catalog.showResults")}</Button></SheetClose>
              </div>
            </SheetContent>
          </Sheet>
          <Select value={sort} onChange={(e) => push(values, e.target.value)} className="h-9 w-auto min-w-44 text-[13px]" aria-label={t("catalog.sort")}>
            {["recommended", "newest", "price_asc", "price_desc", "popular"].map((s) => <option key={s} value={s}>{t(`catalog.sortOptions.${s}`)}</option>)}
          </Select>
        </div>
      </div>
      {children}
      </div>
    </div>
  );
}
