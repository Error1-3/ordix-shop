import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="breadcrumb" className="mb-5 overflow-x-auto scrollbar-none">
      <ol className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-muted-foreground">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            {it.href ? <Link href={it.href} className="hover:text-foreground">{it.name}</Link> : <span aria-current="page" className="text-foreground">{it.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
