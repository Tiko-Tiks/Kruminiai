"use client";

import { createContext, useContext } from "react";
import { type Dictionary, type Locale, getDictionary } from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  t: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "lt",
  t: getDictionary("lt"),
});

// Įdedamas šakniniame layout'e – kalba ateina iš serverio (cookie), todėl
// SSR ir klientas renderina tą pačią reikšmę (be hidratacijos neatitikimo).
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ locale, t: getDictionary(locale) }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useT(): Dictionary {
  return useContext(LocaleContext).t;
}
