// Lengvas i18n: cookie-pagrįsta kalba (be /[locale] maršrutų restruktūrizavimo).
// Numatyta – lietuvių; anglų – pasirenkama per kalbos perjungiklį.
//
// Naudojimas:
//   - Serverio komponentuose: getDictionary(getLocaleFromCookies())
//   - Klientiniuose komponentuose: useT() / useLocale() (žr. LocaleProvider)

export type Locale = "lt" | "en";

export const LOCALES: Locale[] = ["lt", "en"];
export const DEFAULT_LOCALE: Locale = "lt";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function normalizeLocale(value: string | undefined | null): Locale {
  return value === "en" ? "en" : "lt";
}

export interface Dictionary {
  nav: {
    home: string;
    news: string;
    projects: string;
    meetings: string;
    documents: string;
    finance: string;
    about: string;
  };
  header: {
    myAccount: string;
    login: string;
    becomeMember: string;
    openMenu: string;
    closeMenu: string;
    communityLine1: string;
    communityLine2: string;
    language: string;
  };
}

const lt: Dictionary = {
  nav: {
    home: "Pradžia",
    news: "Naujienos",
    projects: "Projektai",
    meetings: "Susirinkimai",
    documents: "Dokumentai",
    finance: "Finansai",
    about: "Apie mus",
  },
  header: {
    myAccount: "Mano paskyra",
    login: "Prisijungti",
    becomeMember: "Tapti nariu",
    openMenu: "Atidaryti meniu",
    closeMenu: "Uždaryti meniu",
    communityLine1: "Krūminių kaimo",
    communityLine2: "bendruomenė",
    language: "Kalba",
  },
};

const en: Dictionary = {
  nav: {
    home: "Home",
    news: "News",
    projects: "Projects",
    meetings: "Meetings",
    documents: "Documents",
    finance: "Finances",
    about: "About us",
  },
  header: {
    myAccount: "My account",
    login: "Log in",
    becomeMember: "Become a member",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    communityLine1: "Krūminiai village",
    communityLine2: "community",
    language: "Language",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { lt, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? lt;
}
