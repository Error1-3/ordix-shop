import { json, limited } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { novaPoshtaConfigured } from "@/lib/env";
import { sanitizeText } from "@/lib/sanitize";
import { novaPoshta } from "@/services/shipping";
import { NovaPoshtaError } from "@/services/shipping/nova-poshta";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = await limited(req, "np-cities", LIMITS.npLookup);
  if (rl) return rl;
  if (!novaPoshtaConfigured()) return json({ error: "np_not_configured", cities: [] }, 0);
  const q = sanitizeText(new URL(req.url).searchParams.get("q") ?? "", 60);
  if (q.length < 2) return json({ cities: [] });
  try {
    return json({ cities: await novaPoshta().searchCities(q) }, 60);
  } catch (e) {
    console.error("[np] cities", e instanceof NovaPoshtaError ? e.message : e);
    return json({ error: "np_unavailable", cities: [] }, 0);
  }
}
