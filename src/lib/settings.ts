import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { db } from "./db";
import { env } from "./env";
import { SETTINGS_SCHEMAS, type SettingsKey, type SettingsMap } from "./settings-schema";

const TAG = "site-settings";

const defaults = (): SettingsMap =>
  Object.fromEntries(
    (Object.keys(SETTINGS_SCHEMAS) as SettingsKey[]).map((k) => [k, SETTINGS_SCHEMAS[k].parse(k === "store" ? { name: process.env.STORE_NAME || "iDevice Store" } : {})]),
  ) as SettingsMap;

async function loadAll(): Promise<SettingsMap> {
  let rows: { key: string; value: unknown }[];
  try {
    rows = await db.siteSettings.findMany();
  } catch (e) {
    // `next build` in CI/Docker may have no database: pre-render with defaults. At runtime the error propagates (and is not cached).
    if (process.env.NEXT_PHASE === "phase-production-build") return defaults();
    throw e;
  }
  const byKey = new Map<string, unknown>(rows.map((r) => [r.key, r.value] as const));
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(SETTINGS_SCHEMAS) as SettingsKey[]) {
    const schema = SETTINGS_SCHEMAS[key];
    const stored = byKey.get(key);
    const base = key === "store" ? { name: env().STORE_NAME, ...(stored as object | undefined) } : stored ?? {};
    const parsed = schema.safeParse(base);
    // A corrupt row must never take the storefront down: fall back to defaults.
    out[key] = parsed.success ? parsed.data : schema.parse(key === "store" ? { name: env().STORE_NAME } : {});
  }
  return out as SettingsMap;
}

export const getSettings = unstable_cache(loadAll, ["site-settings-v1"], { tags: [TAG], revalidate: 300 });

export async function getSetting<K extends SettingsKey>(key: K): Promise<SettingsMap[K]> {
  return (await getSettings())[key];
}

export async function saveSetting<K extends SettingsKey>(key: K, value: unknown): Promise<SettingsMap[K]> {
  const parsed = SETTINGS_SCHEMAS[key].parse(value) as SettingsMap[K];
  await db.siteSettings.upsert({ where: { key }, create: { key, value: parsed as object }, update: { value: parsed as object } });
  revalidateTag(TAG);
  return parsed;
}
