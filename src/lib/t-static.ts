import { createT, DEFAULT_LOCALE } from "./i18n-core";

/**
 * Translator for statically/ISR-rendered public pages. Reading the locale cookie would make every page dynamic
 * and disable caching, so public pages render in DEFAULT_LOCALE (uk). English dictionaries are ready in
 * src/messages/en.json; enabling /en means adding a [locale] route segment (see docs/README.md, "Localization").
 */
export const t = createT(DEFAULT_LOCALE);
export { DEFAULT_LOCALE };
