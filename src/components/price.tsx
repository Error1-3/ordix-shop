import { discountPercent, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Price({ price, compareAt, size = "md", from, className }: { price: number; compareAt?: number | null; size?: "sm" | "md" | "lg"; from?: string; className?: string }) {
  const pct = discountPercent(compareAt, price);
  const big = { sm: "text-[15px]", md: "text-lg", lg: "text-3xl" }[size];
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tnum", className)}>
      {from && <span className="text-xs text-muted-foreground">{from}</span>}
      <span className={cn("font-semibold tracking-tight", big)}>{formatMoney(price)}</span>
      {pct > 0 && compareAt && (
        <>
          <s className={cn("text-muted-foreground", size === "lg" ? "text-base" : "text-[13px]")}>{formatMoney(compareAt)}</s>
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">−{pct}%</span>
        </>
      )}
    </div>
  );
}
