"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Clock, Search, X } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { formatMoney } from "@/lib/money";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { PublicProductCard } from "@/lib/public-dto";

const RECENT_KEY = "recent-searches";
const readRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 6); } catch { return []; }
};
const POPULAR = ["iPhone 15 Pro", "iPhone 14", "iPhone 13", "iPhone 16 Pro", "MacBook Air", "AirPods Pro"];

export function SearchBox({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const t = useT();
  const router = useRouter();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ products: PublicProductCard[]; models: string[] }>({ products: [], models: [] });
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);

  useEffect(() => setRecent(readRecent()), [open]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setData({ products: [], models: [] }); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        if (res.ok) setData(await res.json());
      } catch { /* aborted / offline */ }
    }, 180);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q]);

  const submit = (term: string) => {
    const value = term.trim();
    if (!value) return;
    try { localStorage.setItem(RECENT_KEY, JSON.stringify([value, ...readRecent().filter((r) => r !== value)].slice(0, 6))); } catch { /* private mode */ }
    track("search", { search_term: value });
    setOpen(false);
    router.push(`/catalog?q=${encodeURIComponent(value)}`);
  };

  const entries = [...data.models.map((m) => ({ kind: "model" as const, label: m })), ...data.products.map((p) => ({ kind: "product" as const, label: p.title, p }))];
  const showEmpty = q.trim().length < 2;

  return (
    <div ref={box} className={cn("relative", className)}>
      <form role="search" onSubmit={(e) => { e.preventDefault(); if (active >= 0 && entries[active]) { const en = entries[active]; if (en.kind === "product") { setOpen(false); router.push(`/product/${en.p.slug}`); } else submit(en.label); } else submit(q); }}>
        <label htmlFor={id} className="sr-only">{t("common.search")}</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id={id} value={q} autoFocus={autoFocus} autoComplete="off" enterKeyHint="search" role="combobox" aria-expanded={open} aria-controls={`${id}-list`}
            onChange={(e) => { setQ(e.target.value); setActive(-1); setOpen(true); }} onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(entries.length - 1, a + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder={t("search.placeholder")}
            className="h-11 w-full rounded-full border border-transparent bg-muted pl-10 pr-10 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-input focus:bg-background focus:shadow-sm"
          />
          {q && <button type="button" aria-label={t("common.close")} onClick={() => { setQ(""); setData({ products: [], models: [] }); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-black/5"><X className="h-4 w-4" /></button>}
        </div>
      </form>

      {open && (
        <div id={`${id}-list`} role="listbox" className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[70dvh] animate-fade-in overflow-y-auto rounded-xl border border-border bg-background p-2 shadow-xl">
          {showEmpty ? (
            <>
              {recent.length > 0 && (
                <div className="mb-1">
                  <div className="flex items-center justify-between px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("search.recent")}
                    <button className="normal-case underline" onClick={() => { localStorage.removeItem(RECENT_KEY); setRecent([]); }}>{t("search.clearRecent")}</button>
                  </div>
                  {recent.map((r) => (
                    <button key={r} onClick={() => submit(r)} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"><Clock className="h-4 w-4 text-muted-foreground" />{r}</button>
                  ))}
                </div>
              )}
              <div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("search.popular")}</div>
              <div className="flex flex-wrap gap-2 px-3 pb-2">
                {POPULAR.map((p) => <button key={p} onClick={() => submit(p)} className="rounded-full bg-muted px-3 py-1.5 text-[13px] hover:bg-border">{p}</button>)}
              </div>
            </>
          ) : entries.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("search.noResults")}</p>
          ) : (
            <>
              {data.models.map((m, i) => (
                <button role="option" aria-selected={active === i} key={m} onClick={() => submit(m)} className={cn("flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm hover:bg-muted", active === i && "bg-muted")}>
                  <Search className="h-4 w-4 text-muted-foreground" />{m}
                </button>
              ))}
              {data.products.map((p, j) => {
                const i = data.models.length + j;
                return (
                  <Link role="option" aria-selected={active === i} key={p.id} href={`/product/${p.slug}`} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted", active === i && "bg-muted")}>
                    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">{p.image && <Image src={p.image.url} alt="" fill sizes="44px" className="object-cover" />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm">{p.title}</span><span className="text-xs text-muted-foreground tnum">{t("common.from")} {formatMoney(p.price)}</span></span>
                  </Link>
                );
              })}
              <button onClick={() => submit(q)} className="mt-1 w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-accent hover:bg-muted">{t("search.viewAll")} «{q}»</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
