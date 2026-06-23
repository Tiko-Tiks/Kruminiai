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
  lieptas: {
    projectNotFound: string;
    heroEyebrow: string;
    beforeBadge: string;
    afterBadge: string;
    beforePhotoAlt: string;
    afterPhotoAlt: string;
    progressRaisedPrefix: string;
    progressGoalSuffix: string;
    donorsLabel: string;
    remainingPrefix: string;
    remainingSuffix: string;
    howToDonateHeading: string;
    howToDonateIntro: string;
    qrInstruction: string;
    qrSupportedApps: string;
    manualTransferHeading: string;
    fieldRecipient: string;
    fieldIban: string;
    fieldBank: string;
    fieldPurpose: string;
    bankName: string;
    suggestedAmountsHeading: string;
    otherAmount: string;
    boardCostHint: string;
    cashDonationHeading: string;
    communityAddress: string;
    supportersHeading: string;
    supportersTransparency: string;
    anonymousDonor: string;
    noDonorsTitle: string;
    noDonorsSubtitle: string;
    shareHeading: string;
    shareIntro: string;
    printableNotice: string;
    printableLinkWord: string;
    copyToastSuccess: string;
    copyToastError: string;
    copyAriaLabel: string;
    copyLabel: string;
    copiedLabel: string;
  };
  transparency: {
    pageHeading: string;
    introPrefix: string;
    introLinkWord: string;
    summaryCollected: string;
    summaryCollectedMeta: string;
    summaryDebt: string;
    summaryDebtMeta: string;
    summaryDonated: string;
    summaryDonatedMeta: string;
    feesByYearTitle: string;
    colYear: string;
    colCollected: string;
    colCollectable: string;
    colDebt: string;
    colPaid: string;
    paidCell: string;
    fundraisingProjectLabel: string;
    bridgeProjectTitle: string;
    bridgeOfGoal: string;
    donorSingular: string;
    donorPlural: string;
    donationsTitle: string;
    donationSingular: string;
    donationPlural: string;
    colDate: string;
    colDonor: string;
    colAmount: string;
    anonymousDonor: string;
    financialReportsTitle: string;
    allDocsTitle: string;
    allDocsSubtitle: string;
    emptyState: string;
  };
  portalFinance: {
    pageTitle: string;
    noMemberLink: string;
    pageSubtitle: string;
    totalDebtLabel: string;
    noDebtLabel: string;
    unpaidSectionTitle: string;
    overduePrefix: string;
    dueByPrefix: string;
    overdueBadge: string;
    unpaidHint: string;
    historySectionTitle: string;
    noPayments: string;
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
  lieptas: {
    projectNotFound: "Projektas nerastas.",
    heroEyebrow: "Pilotinis projektas · {year} m.",
    beforeBadge: "Dabar",
    afterBadge: "Po atnaujinimo",
    beforePhotoAlt: "Krūminių paplūdimio liepto būklė dabar",
    afterPhotoAlt: "Atnaujinto Krūminių paplūdimio liepto vizija",
    progressRaisedPrefix: "surinkta iš",
    progressGoalSuffix: "tikslo",
    donorsLabel: "aukotojai (-os)",
    remainingPrefix: "Liko surinkti:",
    remainingSuffix: ". Kiekviena auka svarbi – net 5 € yra svari pagalba!",
    howToDonateHeading: "Kaip paaukoti?",
    howToDonateIntro:
      "Greičiausias būdas – nuskenuokite QR kodą savo banko aplikacija. Forma atsidarys su jau užpildytais duomenimis. Jums tereikia įvesti sumą ir patvirtinti pavedimą.",
    qrInstruction: "📱 Atidarykite banko aplikaciją → „Naujas pavedimas\" → „Skenuoti QR\"",
    qrSupportedApps:
      "Geriausiai veikia Swedbank, SEB, Luminor, Šiaulių/Artea aplikacijose. Jei jūsų app'as nepalaiko – pavedimą įveskite rankomis (rekvizitai dešinėje).",
    manualTransferHeading: "Pavedimas rankomis",
    fieldRecipient: "Gavėjas:",
    fieldIban: "IBAN:",
    fieldBank: "Bankas:",
    fieldPurpose: "Paskirtis:",
    bankName: "AB Artea bankas",
    suggestedAmountsHeading: "Pasiūlytos sumos",
    otherAmount: "arba kita suma",
    boardCostHint:
      "💡 Vienos terasinės lentos kaina ~12 € – jūsų indėlis tampa konkrečia statybine medžiaga.",
    cashDonationHeading: "Norite paaukoti grynais?",
    communityAddress: "Beržų g. 8, Krūminių k., Varėnos r.",
    supportersHeading: "Mūsų rėmėjai",
    supportersTransparency:
      "Skaidrumas – kiekviena auka užregistruota viešai. Anoniminiai aukotojai parodyti kaip „Anonimas\".",
    anonymousDonor: "Anonimas",
    noDonorsTitle: "Aukotojų dar nėra – būkite pirmas! 💚",
    noDonorsSubtitle: "Jūsų auka padarys liepto atnaujinimą realybe.",
    shareHeading: "Pasidalinkit su draugais!",
    shareIntro:
      "Kuo daugiau žmonių sužinos, tuo greičiau atnaujinsim lieptą. Nukopijuokit nuorodą ir pasidalinkit:",
    printableNotice: "Spausdintinę versiją (A4 su QR kodu) galite atsisiųsti",
    printableLinkWord: "čia",
    copyToastSuccess: "IBAN nukopijuotas",
    copyToastError: "Nepavyko nukopijuoti – pažymėk ir nukopijuok rankomis",
    copyAriaLabel: "Kopijuoti IBAN",
    copyLabel: "Kopijuoti",
    copiedLabel: "Nukopijuota",
  },
  transparency: {
    pageHeading: "Finansai",
    introPrefix:
      "Bendruomenės finansų skaidri ataskaita – nario mokesčiai, skolos, aukos ir kaip jos naudojamos. Visi kiti dokumentai – įstatai, protokolai, sutartys – yra",
    introLinkWord: "dokumentų archyve",
    summaryCollected: "Šiemet surinkta",
    summaryCollectedMeta: "{count} nariai · {year} m.",
    summaryDebt: "Nario mokesčio skola",
    summaryDebtMeta: "Sukaupta per visus metus",
    summaryDonated: "Lieptui aukota",
    summaryDonatedMeta: "iš {goal} € tikslo ({percent}%)",
    feesByYearTitle: "Nario mokesčiai pagal metus",
    colYear: "Metai",
    colCollected: "Surinkta",
    colCollectable: "Galima surinkti",
    colDebt: "Skola",
    colPaid: "Sumokėjo",
    paidCell: "{paid} iš {total}",
    fundraisingProjectLabel: "Aukų rinkimo projektas",
    bridgeProjectTitle: "Lieptas – padėk man atsinaujinti!",
    bridgeOfGoal: "iš {goal} €",
    donorSingular: "aukotojas",
    donorPlural: "aukotojai",
    donationsTitle: "Aukos Liepto projektui",
    donationSingular: "auka",
    donationPlural: "aukos",
    colDate: "Data",
    colDonor: "Aukotojas",
    colAmount: "Suma",
    anonymousDonor: "Anonimas",
    financialReportsTitle: "Finansinės ataskaitos",
    allDocsTitle: "Visi bendruomenės dokumentai",
    allDocsSubtitle: "Įstatai, protokolai, ataskaitos, sutartys – pilnas archyvas",
    emptyState: "Duomenų nėra.",
  },
  portalFinance: {
    pageTitle: "Finansai",
    noMemberLink: "Paskyra nesusieta su nario įrašu. Susisiekite su administratoriumi.",
    pageSubtitle: "Jūsų nario mokesčių būsena ir mokėjimo istorija",
    totalDebtLabel: "neapmokėtų mokesčių iš viso",
    noDebtLabel: "neapmokėtų mokesčių neturite",
    unpaidSectionTitle: "Neapmokėti mokesčiai",
    overduePrefix: "Pradelsta",
    dueByPrefix: "Iki",
    overdueBadge: "Pradelsta",
    unpaidHint:
      "Mokesčius galite sumokėti pavedimu į bendruomenės sąskaitą. Susisiekite su pirmininku dėl rekvizitų.",
    historySectionTitle: "Mokėjimo istorija",
    noPayments: "Mokėjimų dar nėra",
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
  lieptas: {
    projectNotFound: "Project not found.",
    heroEyebrow: "Pilot project · {year}",
    beforeBadge: "Now",
    afterBadge: "After renewal",
    beforePhotoAlt: "Current condition of the Krūminiai beach footbridge",
    afterPhotoAlt: "Vision of the renewed Krūminiai beach footbridge",
    progressRaisedPrefix: "raised of the",
    progressGoalSuffix: "goal",
    donorsLabel: "donors",
    remainingPrefix: "Still to raise:",
    remainingSuffix: ". Every donation matters – even 5 € is meaningful help!",
    howToDonateHeading: "How to donate?",
    howToDonateIntro:
      "The fastest way is to scan the QR code with your banking app. The transfer form will open with the details already filled in. You only need to enter the amount and confirm the transfer.",
    qrInstruction: "📱 Open your banking app → \"New transfer\" → \"Scan QR\"",
    qrSupportedApps:
      "Works best in the Swedbank, SEB, Luminor and Šiaulių/Artea apps. If your app does not support it, enter the transfer manually (details on the right).",
    manualTransferHeading: "Manual transfer",
    fieldRecipient: "Recipient:",
    fieldIban: "IBAN:",
    fieldBank: "Bank:",
    fieldPurpose: "Purpose:",
    bankName: "AB Artea bankas",
    suggestedAmountsHeading: "Suggested amounts",
    otherAmount: "or another amount",
    boardCostHint:
      "💡 One terrace board costs about 12 € – your contribution becomes a real building material.",
    cashDonationHeading: "Would you like to donate in cash?",
    communityAddress: "Beržų g. 8, Krūminiai village, Varėna district",
    supportersHeading: "Our supporters",
    supportersTransparency:
      "Transparency – every donation is recorded publicly. Anonymous donors are shown as \"Anonymous\".",
    anonymousDonor: "Anonymous",
    noDonorsTitle: "No donors yet – be the first! 💚",
    noDonorsSubtitle: "Your donation will make renewing the footbridge a reality.",
    shareHeading: "Share with friends!",
    shareIntro:
      "The more people who find out, the sooner we will renew the footbridge. Copy the link and share it:",
    printableNotice: "You can download a printable version (A4 with QR code)",
    printableLinkWord: "here",
    copyToastSuccess: "IBAN copied",
    copyToastError: "Could not copy – select and copy manually",
    copyAriaLabel: "Copy IBAN",
    copyLabel: "Copy",
    copiedLabel: "Copied",
  },
  transparency: {
    pageHeading: "Finances",
    introPrefix:
      "A transparent account of the community's finances – membership fees, debts, donations and how they are used. All other documents – the statutes, minutes and contracts – are in",
    introLinkWord: "the document archive",
    summaryCollected: "Collected this year",
    summaryCollectedMeta: "{count} members · {year}",
    summaryDebt: "Membership fee debt",
    summaryDebtMeta: "Accumulated over all years",
    summaryDonated: "Donated to the footbridge",
    summaryDonatedMeta: "of the {goal} € goal ({percent}%)",
    feesByYearTitle: "Membership fees by year",
    colYear: "Year",
    colCollected: "Collected",
    colCollectable: "Collectable",
    colDebt: "Debt",
    colPaid: "Paid",
    paidCell: "{paid} of {total}",
    fundraisingProjectLabel: "Fundraising project",
    bridgeProjectTitle: "The footbridge – help me get a new look!",
    bridgeOfGoal: "of {goal} €",
    donorSingular: "donor",
    donorPlural: "donors",
    donationsTitle: "Donations to the footbridge project",
    donationSingular: "donation",
    donationPlural: "donations",
    colDate: "Date",
    colDonor: "Donor",
    colAmount: "Amount",
    anonymousDonor: "Anonymous",
    financialReportsTitle: "Financial reports",
    allDocsTitle: "All community documents",
    allDocsSubtitle: "Statutes, minutes, reports, contracts – the full archive",
    emptyState: "No data.",
  },
  portalFinance: {
    pageTitle: "Finances",
    noMemberLink: "This account is not linked to a member record. Please contact the administrator.",
    pageSubtitle: "Your membership fee status and payment history",
    totalDebtLabel: "in unpaid fees in total",
    noDebtLabel: "you have no unpaid fees",
    unpaidSectionTitle: "Unpaid fees",
    overduePrefix: "Overdue",
    dueByPrefix: "Due by",
    overdueBadge: "Overdue",
    unpaidHint:
      "You can pay your fees by bank transfer to the community account. Contact the chairperson for the payment details.",
    historySectionTitle: "Payment history",
    noPayments: "No payments yet",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { lt, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? lt;
}
