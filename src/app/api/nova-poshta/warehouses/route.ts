import { z } from "zod";
import { json, limited } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { novaPoshtaConfigured } from "@/lib/env";
import { sanitizeText } from "@/lib/sanitize";
import { novaPoshta } from "@/services/shipping";
import { NovaPoshtaError } from "@/services/shipping/nova-poshta";

export const dynamic = "force-dynamic";

const schema = z.object({ cityRef: z.string().regex(/^[0-9a-f-]{36}$/i), kind: z.enum(["warehouse", "locker"]).default("warehouse"), q: z.string().max(60).optional() });

export async function GET(req: Request) {
  const rl = await limited(req, "np-wh", LIMITS.npLookup);
  if (rl) return rl;
  if (!novaPoshtaConfigured()) return json({ error: "np_not_configured", warehouses: [] }, 0);
  const parsed = schema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return json({ error: "bad_request", warehouses: [] });
  try {
    const warehouses = await novaPoshta().getWarehouses({ cityRef: parsed.data.cityRef, kind: parsed.data.kind, query: sanitizeText(parsed.data.q ?? "", 60), limit: 60 });
    return json({ warehouses }, 120);
  } catch (e) {
    console.error("[np] warehouses", e instanceof NovaPoshtaError ? e.message : e);
    return json({ error: "np_unavailable", warehouses: [] }, 0);
  }
}
