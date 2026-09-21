import uk from "@/messages/uk.json";
import en from "@/messages/en.json";

export const LOCALES = ["uk", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uk";

export type Dict = Record<string, unknown>;
export const DICTS: Record<Locale, Dict> = { uk: uk as Dict, en: en as Dict };

function lookup(dict: Dict, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Dict)) cur = (cur as Dict)[part];
    else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/** Falls back en -> uk -> key, so a missing translation never breaks a page. */
export function createT(locale: Locale): TFunction {
  return (key, vars) => {
    const raw = lookup(DICTS[locale], key) ?? lookup(DICTS.uk, key) ?? key;
    return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : raw;
  };
}
