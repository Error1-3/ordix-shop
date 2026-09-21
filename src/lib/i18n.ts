import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, createT, type Locale, type TFunction } from "./i18n-core";

export { createT, LOCALES, DEFAULT_LOCALE };
export type { Locale, TFunction };

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get("locale")?.value;
  return (LOCALES as readonly string[]).includes(c ?? "") ? (c as Locale) : DEFAULT_LOCALE;
}

export async function getT(): Promise<{ t: TFunction; locale: Locale }> {
  const locale = await getLocale();
  return { t: createT(locale), locale };
}
