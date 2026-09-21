import { z } from "zod";
import { json, limited } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { assertNoSecrets } from "@/lib/public-dto";
import { suggest } from "@/services/catalog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = await limited(req, "suggest", LIMITS.search);
  if (rl) return rl;
  const q = z.string().max(80).safeParse(new URL(req.url).searchParams.get("q") ?? "");
  const query = q.success ? sanitizeText(q.data, 80) : "";
  if (query.length < 2) return json({ products: [], models: [] });
  const data = await suggest(query);
  assertNoSecrets(data);
  return json(data, 30);
}
