import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-muted text-foreground",
      accent: "bg-accent-soft text-accent",
      dark: "bg-primary text-primary-foreground",
      warning: "bg-amber-50 text-warning",
      destructive: "bg-red-50 text-destructive",
      outline: "border border-border text-muted-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});
export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-card text-card-foreground", className)} {...props} />;
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export function Alert({ variant = "info", className, children }: { variant?: "info" | "error" | "success" | "warning"; className?: string; children: React.ReactNode }) {
  const styles = { info: "bg-muted text-foreground", error: "bg-red-50 text-destructive", success: "bg-accent-soft text-accent", warning: "bg-amber-50 text-warning" }[variant];
  return <div role={variant === "error" ? "alert" : "status"} className={cn("rounded-md px-4 py-3 text-sm", styles, className)}>{children}</div>;
}

export function EmptyState({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-14 text-center">
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <p className="text-base font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
