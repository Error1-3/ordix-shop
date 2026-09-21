import { safeJsonLd } from "@/lib/sanitize";

/** Server component. Content is escaped so a product title can never close the <script> tag. */
export function JsonLd({ data }: { data: unknown | unknown[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(d) }} />
      ))}
    </>
  );
}
