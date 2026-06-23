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
  home: {
    upcomingMeetingBadge: string;
    upcomingMeetingCta: string;
    heroTitle: string;
    heroEyebrow: string;
    heroSubtitle: string;
    heroNewsButton: string;
    heroContactButton: string;
    statMembersLabel: string;
    statVolunteersLabel: string;
    statYearsLabel: string;
    lieptasBadge: string;
    lieptasCategoryLabel: string;
    lieptasDescription: string;
    lieptasProgressOf: string;
    lieptasDonorSingular: string;
    lieptasDonorPlural: string;
    lieptasCta: string;
    pinnedBadge: string;
    quickLinkNewsTitle: string;
    quickLinkNewsDesc: string;
    quickLinkProjectsTitle: string;
    quickLinkProjectsDesc: string;
    quickLinkAboutTitle: string;
    quickLinkAboutDesc: string;
    quickLinkContactsTitle: string;
    quickLinkContactsDesc: string;
    latestNewsHeading: string;
    allNewsLink: string;
    aboutHeading: string;
    aboutBody: string;
    valueCommunityTitle: string;
    valueCommunityDesc: string;
    valueTransparencyTitle: string;
    valueTransparencyDesc: string;
    valueInvestmentTitle: string;
    valueInvestmentDesc: string;
    membershipHeading: string;
    membershipBody: string;
    membershipJoiningFeeAmount: string;
    membershipJoiningFeeLabel: string;
    membershipAnnualFeeAmount: string;
    membershipAnnualFeeLabel: string;
    membershipCta: string;
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
  home: {
    upcomingMeetingBadge: "Artėjantis susirinkimas",
    upcomingMeetingCta: "Darbotvarkė ir dokumentai",
    heroTitle: "Krūminių kaimo bendruomenė",
    heroEyebrow: "Nuo 2012 m.",
    heroSubtitle: "Kartu kuriame geresnę ateitį mūsų kaimui ir žmonėms.",
    heroNewsButton: "Naujienos",
    heroContactButton: "Susisiekite",
    statMembersLabel: "narių",
    statVolunteersLabel: "savanorių",
    statYearsLabel: "veiklos metų",
    lieptasBadge: "Pilotinis projektas",
    lieptasCategoryLabel: "Aukų rinkimas",
    lieptasDescription:
      "Mūsų liepto laikas atsinaujinti – su bendruomenės ir svečių pagalba. Jei ne dabar, tai kada?",
    lieptasProgressOf: "iš {goal} €",
    lieptasDonorSingular: "aukotojas",
    lieptasDonorPlural: "aukotojai",
    lieptasCta: "Padėti",
    pinnedBadge: "Svarbu",
    quickLinkNewsTitle: "Naujienos",
    quickLinkNewsDesc: "Pranešimai apie susirinkimus, renginius ir svarbius sprendimus",
    quickLinkProjectsTitle: "Projektai",
    quickLinkProjectsDesc: "Aukų rinkimo projektai su skaidria lėšų istorija",
    quickLinkAboutTitle: "Apie mus",
    quickLinkAboutDesc: "Vizija, misija ir bendruomenės veiklos modelis",
    quickLinkContactsTitle: "Kontaktai",
    quickLinkContactsDesc: "Susisiekite su bendruomenės valdyba",
    latestNewsHeading: "Naujausios naujienos",
    allNewsLink: "Visos naujienos",
    aboutHeading: "Apie bendruomenę",
    aboutBody:
      "Telkiame bendruomenės narius bendriems projektams ir iniciatyvoms, kurios pagerina gyvenimo kokybę Krūminiuose. Skatinama kaimynystė, savanoriškumas ir tarpusavio pagarba. Aktyviai bendradarbiaujame su vietiniais verslais, savivaldybe ir kitomis organizacijomis.",
    valueCommunityTitle: "Bendruomeniškumas",
    valueCommunityDesc:
      "Telkiame Krūminių ir aplinkinių kaimų gyventojus bendriems projektams ir iniciatyvoms",
    valueTransparencyTitle: "Skaidrumas",
    valueTransparencyDesc:
      "Visi finansiniai srautai yra skaidrūs ir prieinami bendruomenės nariams",
    valueInvestmentTitle: "Investicijos į bendruomenę",
    valueInvestmentDesc:
      "Surenkamos lėšos skirtos paplūdimio, žaidimų aikštelės ir bendros teritorijos priežiūrai",
    membershipHeading: "Tapkite nariu",
    membershipBody:
      "Bendruomenės nariais gali būti 18 metų sulaukę veiksnūs fiziniai asmenys, gyvenantys, dirbantys ar turintys nuosavybės Krūminių kaime ir pritariantys bendruomenės tikslams.",
    membershipJoiningFeeAmount: "20 €",
    membershipJoiningFeeLabel: "Stojamasis mokestis",
    membershipAnnualFeeAmount: "12 €",
    membershipAnnualFeeLabel: "Metinis nario mokestis",
    membershipCta: "Pateikti prašymą",
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
  home: {
    upcomingMeetingBadge: "Upcoming meeting",
    upcomingMeetingCta: "Agenda and documents",
    heroTitle: "Krūminiai Village Community",
    heroEyebrow: "Since 2012",
    heroSubtitle: "Together we build a better future for our village and its people.",
    heroNewsButton: "News",
    heroContactButton: "Get in touch",
    statMembersLabel: "members",
    statVolunteersLabel: "volunteers",
    statYearsLabel: "years of activity",
    lieptasBadge: "Pilot project",
    lieptasCategoryLabel: "Fundraising",
    lieptasDescription:
      "It is time for our footbridge to be renewed – with the help of the community and our guests. If not now, then when?",
    lieptasProgressOf: "of €{goal}",
    lieptasDonorSingular: "donor",
    lieptasDonorPlural: "donors",
    lieptasCta: "Help out",
    pinnedBadge: "Important",
    quickLinkNewsTitle: "News",
    quickLinkNewsDesc: "Announcements about meetings, events and important decisions",
    quickLinkProjectsTitle: "Projects",
    quickLinkProjectsDesc: "Fundraising projects with a transparent record of funds",
    quickLinkAboutTitle: "About us",
    quickLinkAboutDesc: "Our vision, mission and the way the community operates",
    quickLinkContactsTitle: "Contacts",
    quickLinkContactsDesc: "Get in touch with the community board",
    latestNewsHeading: "Latest news",
    allNewsLink: "All news",
    aboutHeading: "About the community",
    aboutBody:
      "We bring community members together for shared projects and initiatives that improve quality of life in Krūminiai. We foster neighbourliness, volunteering and mutual respect. We actively cooperate with local businesses, the municipality and other organisations.",
    valueCommunityTitle: "Community spirit",
    valueCommunityDesc:
      "We bring together residents of Krūminiai and neighbouring villages for shared projects and initiatives",
    valueTransparencyTitle: "Transparency",
    valueTransparencyDesc:
      "All financial flows are transparent and accessible to community members",
    valueInvestmentTitle: "Investing in the community",
    valueInvestmentDesc:
      "Funds raised go towards maintaining the beach, the playground and shared community grounds",
    membershipHeading: "Become a member",
    membershipBody:
      "Membership is open to legally competent individuals aged 18 or over who live, work or own property in Krūminiai village and who support the community's aims.",
    membershipJoiningFeeAmount: "€20",
    membershipJoiningFeeLabel: "Joining fee",
    membershipAnnualFeeAmount: "€12",
    membershipAnnualFeeLabel: "Annual membership fee",
    membershipCta: "Submit an application",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { lt, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? lt;
}
