import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildQuery, cn } from "@/lib/utils";
import { t } from "@/lib/t-static";

export function Pagination({ page, pages, basePath, params }: { page: number; pages: number; basePath: string; params: Record<string, string | undefined> }) {
  if (pages <= 1) return null;
  const href = (p: number) => `${basePath}${buildQuery({ ...params, page: p > 1 ? p : undefined })}`;
  const window = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const list = [...window].sort((a, b) => a - b);
  const item = "grid h-10 min-w-10 place-items-center rounded-md px-3 text-sm transition-colors";
  return (
    <nav aria-label="pagination" className="mt-12 flex items-center justify-center gap-1.5">
      {page > 1 ? <Link href={href(page - 1)} rel="prev" className={cn(item, "hover:bg-muted")} aria-label={t("catalog.prev")}><ChevronLeft className="h-4 w-4" /></Link> : <span className={cn(item, "opacity-30")}><ChevronLeft className="h-4 w-4" /></span>}
      {list.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - (list[i - 1] as number) > 1 && <span className="text-muted-foreground">…</span>}
          <Link href={href(p)} aria-current={p === page ? "page" : undefined} className={cn(item, p === page ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{p}</Link>
        </span>
      ))}
      {page < pages ? <Link href={href(page + 1)} rel="next" className={cn(item, "hover:bg-muted")} aria-label={t("catalog.next")}><ChevronRight className="h-4 w-4" /></Link> : <span className={cn(item, "opacity-30")}><ChevronRight className="h-4 w-4" /></span>}
    </nav>
  );
}
