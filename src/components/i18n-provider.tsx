"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DICTS, createT, type Locale, type TFunction } from "@/lib/i18n-core";

const Ctx = createContext<{ t: TFunction; locale: Locale }>({ t: createT("uk"), locale: "uk" });

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ t: createT(locale), locale }), [locale]);
  void DICTS;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx).t;
export const useLocale = () => useContext(Ctx).locale;
