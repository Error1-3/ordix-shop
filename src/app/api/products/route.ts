import { json, limited } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { assertNoSecrets } from "@/lib/public-dto";
import { catalogQuerySchema } from "@/lib/validators";
import { searchProducts } from "@/services/catalog";

export const dynamic = "force-dynamic";

/** Public catalog API: returns PublicProductCard DTOs only (no IMEI/serial/cost — enforced by mapper + assertNoSecrets). */
export async function GET(req: Request) {
  const rl = await limited(req, "products", LIMITS.search);
  if (rl) return rl;
  const parsed = catalogQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return json({ error: "invalid_query", issues: parsed.error.issues.map((i) => i.message) }, 0);
  const page = await searchProducts(parsed.data);
  assertNoSecrets(page);
  return json(page, 15);
}
