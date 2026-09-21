"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MapPin, Search } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";

export type City = { ref: string; name: string; present: string };
export type Warehouse = { ref: string; number: string; name: string; address: string; kind: "warehouse" | "locker" };

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

export function CityPicker({ value, onSelect, error }: { value: City | null; onSelect: (c: City | null) => void; error?: string }) {
  const t = useT();
  const [q, setQ] = useState(value?.present ?? "");
  const [items, setItems] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const dq = useDebounced(q);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value || dq.trim().length < 2) { setItems([]); return; }
    const ctrl = new AbortController();
    setLoading(true); setFailed(false);
    fetch(`/api/nova-poshta/cities?q=${encodeURIComponent(dq.trim())}`, { signal: ctrl.signal })
      .then((r) => r.json()).then((j) => { setItems(j.cities ?? []); setFailed(Boolean(j.error)); })
      .catch(() => { if (!ctrl.signal.aborted) setFailed(true); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [dq, value]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={box} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input id="city" value={q} autoComplete="off" aria-invalid={Boolean(error)} className="pl-10" placeholder={t("checkout.cityHint")}
          onChange={(e) => { setQ(e.target.value); if (value) onSelect(null); setOpen(true); }} onFocus={() => setOpen(true)} />
        {loading ? <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : value && <Check className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />}
      </div>
      {open && !value && q.trim().length >= 2 && (
        <ul role="listbox" className="absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-background p-1.5 shadow-xl">
          {failed && <li className="px-3 py-3 text-sm text-destructive">{t("checkout.npUnavailable")}</li>}
          {!failed && !loading && items.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">{t("checkout.noCities")}</li>}
          {items.map((c) => (
            <li key={c.ref} role="option" aria-selected={false}>
              <button type="button" className="w-full rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted" onClick={() => { onSelect(c); setQ(c.present); setOpen(false); }}>{c.present}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WarehousePicker({ cityRef, kind, value, onSelect, error }: { cityRef: string | null; kind: "warehouse" | "locker"; value: Warehouse | null; onSelect: (w: Warehouse | null) => void; error?: string }) {
  const t = useT();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const [items, setItems] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setItems([]); setQ(""); }, [cityRef, kind]);
  useEffect(() => {
    if (!cityRef) return;
    const ctrl = new AbortController();
    setLoading(true); setFailed(false);
    fetch(`/api/nova-poshta/warehouses?cityRef=${cityRef}&kind=${kind}&q=${encodeURIComponent(dq)}`, { signal: ctrl.signal })
      .then((r) => r.json()).then((j) => { setItems(j.warehouses ?? []); setFailed(Boolean(j.error)); })
      .catch(() => { if (!ctrl.signal.aborted) setFailed(true); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [cityRef, kind, dq]);

  if (!cityRef) return <p className="rounded-md bg-muted px-3.5 py-3 text-sm text-muted-foreground">{t("checkout.cityFirst")}</p>;
  return (
    <div className={cn("rounded-xl border border-border", error && "border-destructive")}>
      {value ? (
        <div className="flex items-start justify-between gap-3 p-3.5 text-sm"><span><Check className="mr-1.5 inline h-4 w-4 text-accent" />{value.name}</span><button type="button" className="shrink-0 text-accent" onClick={() => onSelect(null)}>{t("common.edit")}</button></div>
      ) : (
        <>
          <div className="relative border-b border-border"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("checkout.searchWarehouse")} className="h-11 rounded-b-none border-0 pl-10 focus-visible:ring-0" /></div>
          <ul role="listbox" className="max-h-64 overflow-y-auto p-1.5" aria-busy={loading}>
            {loading && <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("checkout.loadingCities")}</li>}
            {failed && <li className="px-3 py-3 text-sm text-destructive">{t("checkout.npUnavailable")}</li>}
            {!loading && !failed && items.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">{t("checkout.noCities")}</li>}
            {items.map((w) => <li key={w.ref}><button type="button" role="option" aria-selected={false} className="w-full rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted" onClick={() => onSelect(w)}>{w.name}</button></li>)}
          </ul>
        </>
      )}
    </div>
  );
}
