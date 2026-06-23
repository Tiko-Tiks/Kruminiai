import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale, getDictionary, type Locale } from "@/lib/i18n";

// Serverio komponentams: kalba ir žodynas iš NEXT_LOCALE cookie.
export function getLocale(): Locale {
  return normalizeLocale(cookies().get(LOCALE_COOKIE)?.value);
}

export function getDict() {
  return getDictionary(getLocale());
}
