import Link from "next/link";

/** Original wordmark. Deliberately NOT the Apple logo — this store is not an official Apple retailer. */
export function Logo({ name, logoUrl }: { name: string; logoUrl?: string }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label={name}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain" />
      ) : (
        <span className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-primary text-[13px] font-bold tracking-tight text-primary-foreground">
          iD<span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-background transition-transform group-hover:scale-125" />
        </span>
      )}
      <span className="text-[17px] font-semibold tracking-tight">{name}</span>
    </Link>
  );
}
