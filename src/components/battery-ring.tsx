import { cn } from "@/lib/utils";

/** Battery-health ring. The signature element of the store: every used device shows its measured capacity. */
export function BatteryRing({ value, size = 44, label = true, className }: { value: number; size?: number; label?: boolean; className?: string }) {
  const stroke = Math.max(3, size / 11);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circ * (1 - clamped / 100);
  const tone = clamped >= 90 ? "text-accent" : clamped >= 80 ? "text-amber-600" : "text-red-600";
  return (
    <span className={cn("relative inline-grid place-items-center", tone, className)} style={{ width: size, height: size }} role="img" aria-label={`${clamped}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ}
          className="animate-ring-fill" style={{ strokeDashoffset: offset, ["--ring-circ" as string]: circ, ["--ring-offset" as string]: offset }}
        />
      </svg>
      {label && <span className="absolute text-[11px] font-semibold tnum text-foreground" style={{ fontSize: size * 0.25 }}>{clamped}</span>}
    </span>
  );
}
