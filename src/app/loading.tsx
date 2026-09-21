import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="container py-10" aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-8 h-10 w-64" />
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i}><Skeleton className="aspect-[4/5] w-full" /><Skeleton className="mt-3 h-4 w-3/4" /><Skeleton className="mt-2 h-4 w-1/3" /></div>)}</div>
    </div>
  );
}
