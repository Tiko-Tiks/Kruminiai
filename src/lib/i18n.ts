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
  footer: {
    tagline: string;
    linksHeading: string;
    linkNews: string;
    linkDocuments: string;
    linkContacts: string;
    contactsHeading: string;
    companyCodeLabel: string;
    emailLabel: string;
    phoneLabel: string;
    rightsReserved: string;
  };
  about: {
    pageTitle: string;
    visionTitle: string;
    visionBody: string;
    missionTitle: string;
    missionBody1: string;
    missionBody2: string;
    fundingTitle: string;
    fundingIntro: string;
    fundingMembersTitle: string;
    fundingMembersDesc: string;
    fundingGroundsTitle: string;
    fundingGroundsDesc: string;
    fundingBridgeTitle: string;
    fundingBridgeDesc: string;
    fundingEventsTitle: string;
    fundingEventsDesc: string;
    fundingTransparencyTitle: string;
    fundingTransparencyDesc: string;
    impactTitle: string;
    impactCommunityTitle: string;
    impactCommunityDesc: string;
    impactLivingTitle: string;
    impactLivingDesc: string;
    impactTraditionsTitle: string;
    impactTraditionsDesc: string;
    impactTransparencyTitle: string;
    impactTransparencyDesc: string;
    valuesTitle: string;
    value1: string;
    value2: string;
    value3: string;
    value4: string;
    value5: string;
  };
  auth: {
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    loginTitle: string;
    loginSubtitle: string;
    forgotPassword: string;
    loggingIn: string;
    loginButton: string;
    noAccount: string;
    registerNow: string;
    errInvalidCredentials: string;
    errNotApproved: string;
    errNotConfirmed: string;
    errAuthLink: string;
    registerTitle: string;
    registerSubtitle: string;
    firstNameLabel: string;
    firstNamePlaceholder: string;
    lastNameLabel: string;
    lastNamePlaceholder: string;
    confirmPasswordLabel: string;
    confirmPasswordPlaceholder: string;
    registering: string;
    registerButton: string;
    haveAccount: string;
    loginLink: string;
    errPasswordMismatch: string;
    errPasswordLength: string;
    errSignupFailed: string;
    successTitle: string;
    successLine1: string;
    successLine2: string;
    backHome: string;
  };
  projects: {
    pageTitle: string;
    pageIntro: string;
    emptyState: string;
    fundraisingBadge: string;
    amountOfGoal: string;
    donorSingular: string;
    donorPlural: string;
    readMore: string;
  };
  news: {
    pageTitle: string;
    emptyState: string;
  };
  documents: {
    pageHeading: string;
    pageIntro: string;
    emptyState: string;
    generalDocsHeading: string;
    meetingsHeading: string;
    meetingsDescription: string;
    docSingular: string;
    docPlural: string;
  };
  portalHome: {
    sidebarSubtitle: string;
    sectionMyAccount: string;
    sectionCommunity: string;
    navHome: string;
    navVotes: string;
    navMyHistory: string;
    navMyPayments: string;
    navMyData: string;
    navNews: string;
    navMeetings: string;
    navProjects: string;
    navDocuments: string;
    navFinances: string;
    navAboutUs: string;
    logout: string;
    menuAria: string;
    greetingWithName: string;
    greetingNoName: string;
    portalSubtitle: string;
    noMemberLinkTitle: string;
    noMemberLinkBody: string;
    activeVotesLabel: string;
    debtUnpaidLabel: string;
    debtNoneLabel: string;
    historyMeetingSingular: string;
    historyMeetingPlural: string;
    historyInPast: string;
    upcomingMeetingsHeading: string;
    viewAllLink: string;
    votedBadge: string;
    voteNowBadge: string;
    documentsCardTitle: string;
    documentsCardDescription: string;
    myDataCardTitle: string;
    myDataCardDescription: string;
  };
  portalVoting: {
    pageTitle: string;
    pageSubtitle: string;
    emptyState: string;
    pendingSectionTitle: string;
    voteButton: string;
    votedSectionTitle: string;
    votedBadge: string;
  };
  portalHistory: {
    pageTitle: string;
    pageSubtitle: string;
    emptyState: string;
    attendedInPerson: string;
    attendedRemotely: string;
    votedInWriting: string;
    documentsLink: string;
    liveAttendanceSecrecyNote: string;
    viewResolutionsLink: string;
    votesNotEnteredNote: string;
    viewMeetingInfoLink: string;
    voteFor: string;
    voteAgainst: string;
    voteAbstain: string;
  };
  portalProfile: {
    pageTitle: string;
    pageSubtitle: string;
    noMemberLinkTitle: string;
    noMemberLinkBody: string;
    memberSincePrefix: string;
    statusActive: string;
    changeNameNotice: string;
    contactsHeading: string;
    emailLabel: string;
    emailPlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    addressLabel: string;
    addressPlaceholder: string;
    saveButton: string;
    saveErrorFallback: string;
    saveSuccessToast: string;
  };
  portalDocuments: {
    pageTitle: string;
    pageSubtitle: string;
    emptyTitle: string;
    emptyHint: string;
    searchPlaceholder: string;
    filterAll: string;
    filtering: string;
    docsCountWord: string;
    ofWord: string;
    yearSuffix: string;
  };
  docCategories: {
    protokolai: string;
    ataskaitos: string;
    istatai: string;
    sutartys: string;
    kita: string;
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
  footer: {
    tagline: "Kartu kuriame savo kaimą. Geresnę ateitį mūsų bendruomenei ir žmonėms.",
    linksHeading: "Nuorodos",
    linkNews: "Naujienos",
    linkDocuments: "Dokumentai",
    linkContacts: "Kontaktai",
    contactsHeading: "Kontaktai",
    companyCodeLabel: "Įmonės kodas:",
    emailLabel: "El. paštas:",
    phoneLabel: "Tel.:",
    rightsReserved: "Visos teisės saugomos.",
  },
  about: {
    pageTitle: "Apie mus",
    visionTitle: "Mūsų vizija",
    visionBody:
      "Krūminių bendruomenė siekia tapti pavyzdžiu kaimo bendruomenės modeliui Lietuvoje – aktyvi, moderni ir socialiai atsakinga bendruomenė, kurioje kiekvienas narys jaučiasi vertinamas ir turi galimybę prisidėti prie bendro gėrio kūrimo. Mes tikime, kad kaimo gyvensena gali būti patraukli ir moderni, derinant tradicinės kaimo kultūros privalumus su šiuolaikinėmis galimybėmis.",
    missionTitle: "Mūsų misija",
    missionBody1:
      "Telkiame Krūminių ir aplinkinių kaimų – Valkininkų, Užuperkasio, Bucivonių, Urkionių, Jakėnų, Paversekio – gyventojus bendriems projektams ir iniciatyvoms, kurios pagerina gyvenimo kokybę regione. Skatiname kaimynystę, savanoriškumą ir tarpusavio pagarbą.",
    missionBody2:
      "Aktyviai bendradarbiaujame su vietos verslais, savivaldybe ir kitomis organizacijomis kuriant darnią aplinką, kurioje visi – nuo jauniausiųjų iki vyriausiųjų – gali rasti veiklų ir prisidėti prie bendruomenės gyvenimo.",
    fundingTitle: "Veiklos finansavimas",
    fundingIntro:
      "Krūminių bendruomenė veikia ne pelno principu – visos gautos pajamos reinvestuojamos į bendruomenės gerovę: teritorijos priežiūrą, renginius ir bendros infrastruktūros gerinimą.",
    fundingMembersTitle: "Narių įnašai",
    fundingMembersDesc:
      "Stojamasis mokestis (20 €) ir metinis nario mokestis (12 €) sudaro bazinį finansavimą bendruomenės administraciniam darbui ir renginių organizavimui.",
    fundingGroundsTitle: "Teritorijos priežiūra",
    fundingGroundsDesc:
      "Lėšos skiriamos paplūdimio (smėlio užvežimas), žaidimų aikštelės remontui ir bendrosios teritorijos priežiūrai (žolės pjovimas, kuras, elektra).",
    fundingBridgeTitle: "Paplūdimio liepto atnaujinimas",
    fundingBridgeDesc:
      "Liepto laikas atsinaujinti. Tikslas 4 000 EUR – renkamos iš bendruomenės narių ir kaimo svečių aukų atskirai nuo nario mokesčio biudžeto.",
    fundingEventsTitle: "Renginiai",
    fundingEventsDesc:
      "Mindauginės (liepos 6 d.) ir Eglutės puošimas (gruodis) – tradicinės kasmetinės bendruomenės šventės. Papildomi renginiai pagal narių iniciatyvą.",
    fundingTransparencyTitle: "Skaidrumas",
    fundingTransparencyDesc:
      "Visi finansiniai srautai yra skaidrūs ir prieinami bendruomenės nariams. Reguliariai teikiame finansines ir metines ataskaitas.",
    impactTitle: "Socialinis poveikis",
    impactCommunityTitle: "Bendruomeniškumas",
    impactCommunityDesc:
      "Telkiame kaimo gyventojus bendriems projektams ir renginiams, stipriname kaimyniškus ryšius.",
    impactLivingTitle: "Gyvenamoji aplinka",
    impactLivingDesc:
      "Prižiūrime paplūdimį, žaidimų aikštelę ir bendrąją teritoriją – gerinama gyvenimo kokybė kaime.",
    impactTraditionsTitle: "Tradicijos",
    impactTraditionsDesc:
      "Mindauginės, Eglutės puošimas ir kiti bendruomenės renginiai puoselėja kaimo tradicijas.",
    impactTransparencyTitle: "Skaidrumas",
    impactTransparencyDesc:
      "Visi finansiniai srautai ir veiklos sprendimai yra atviri – pasitikėjimas ir atskaitomybė nariams.",
    valuesTitle: "Mūsų vertybės",
    value1: "Bendruomeniškumas ir solidarumas",
    value2: "Atsakingumas ir skaidrumas",
    value3: "Socialinė atsakomybė ir įtraukimas",
    value4: "Pagarba aplinkai ir tradicijoms",
    value5: "Lygios galimybės visiems",
  },
  auth: {
    emailLabel: "El. paštas",
    emailPlaceholder: "jusu@pastas.lt",
    passwordLabel: "Slaptažodis",
    passwordPlaceholder: "Slaptažodis",
    loginTitle: "Nario prisijungimas",
    loginSubtitle: "Įveskite savo duomenis norėdami prisijungti",
    forgotPassword: "Pamiršote slaptažodį?",
    loggingIn: "Jungiamasi...",
    loginButton: "Prisijungti",
    noAccount: "Dar neturite paskyros?",
    registerNow: "Registruotis dabar",
    errInvalidCredentials: "Neteisingas el. paštas arba slaptažodis",
    errNotApproved: "Jūsų paskyra dar nepatvirtinta. Laukite administratoriaus patvirtinimo.",
    errNotConfirmed:
      "Jūsų el. paštas dar nepatvirtintas. Patikrinkite pašto dėžutę ir paspauskite patvirtinimo nuorodą, arba palaukite, kol administratorius patvirtins narystę.",
    errAuthLink: "Nuoroda negaliojanti arba pasenusi. Bandykite prisijungti iš naujo.",
    registerTitle: "Tapti nariu",
    registerSubtitle: "Užpildykite formą ir laukite administratoriaus patvirtinimo",
    firstNameLabel: "Vardas",
    firstNamePlaceholder: "Vardenis",
    lastNameLabel: "Pavardė",
    lastNamePlaceholder: "Pavardenis",
    confirmPasswordLabel: "Pakartokite slaptažodį",
    confirmPasswordPlaceholder: "Pakartokite slaptažodį",
    registering: "Registruojama...",
    registerButton: "Pateikti registraciją",
    haveAccount: "Jau turite paskyrą?",
    loginLink: "Prisijungti",
    errPasswordMismatch: "Slaptažodžiai nesutampa",
    errPasswordLength: "Slaptažodis turi būti bent 8 simbolių",
    errSignupFailed: "Nepavyko sukurti paskyros. Bandykite dar kartą.",
    successTitle: "Registracija gauta!",
    successLine1: "Išsiuntėme jums el. laišką su mokėjimo informacija.",
    successLine2:
      "Kad taptumėte pilnaverčiu nariu, sumokėkite stojamąjį ir nario mokestį. Gavę apmokėjimą, patvirtinsime jūsų narystę ir atsiųsime prisijungimo informaciją.",
    backHome: "Grįžti į pradžią",
  },
  projects: {
    pageTitle: "Bendruomenės projektai",
    pageIntro:
      "Aukų rinkimo projektai – kiekvienam atskira skaidri lėšų istorija ir progresas iki tikslo. Aukoja bendruomenės nariai, kaimo svečiai ir vasaros lankytojai.",
    emptyState: "Šiuo metu aktyvių projektų nėra.",
    fundraisingBadge: "Aukų rinkimas",
    amountOfGoal: "iš {goal} €",
    donorSingular: "aukotojas",
    donorPlural: "aukotojai",
    readMore: "Plačiau",
  },
  news: {
    pageTitle: "Naujienos",
    emptyState: "Kol kas naujienų nėra",
  },
  documents: {
    pageHeading: "Dokumentai",
    pageIntro:
      "Bendruomenės dokumentų archyvas. Susirinkimų papkėse rasite metinę ataskaitą, finansinį rinkinį, protokolą, dalyvių sąrašą ir kitus susijusius dokumentus.",
    emptyState: "Kol kas dokumentų nėra",
    generalDocsHeading: "Pagrindiniai dokumentai",
    meetingsHeading: "Susirinkimai",
    meetingsDescription:
      "Kiekvienas susirinkimo puslapis turi visus susijusius dokumentus (ataskaitas, protokolą, dalyvių sąrašą), skelbimus ir balsavimo rezultatus.",
    docSingular: "dokumentas",
    docPlural: "dokumentai",
  },
  portalHome: {
    sidebarSubtitle: "Nario portalas",
    sectionMyAccount: "Mano paskyra",
    sectionCommunity: "Bendruomenė",
    navHome: "Pradžia",
    navVotes: "Balsavimai",
    navMyHistory: "Mano istorija",
    navMyPayments: "Mano mokėjimai",
    navMyData: "Mano duomenys",
    navNews: "Naujienos",
    navMeetings: "Susirinkimai",
    navProjects: "Projektai",
    navDocuments: "Dokumentai",
    navFinances: "Finansai",
    navAboutUs: "Apie mus",
    logout: "Atsijungti",
    menuAria: "Meniu",
    greetingWithName: "Sveiki, {name}!",
    greetingNoName: "Sveiki!",
    portalSubtitle: "Krūminių kaimo bendruomenės narių portalas",
    noMemberLinkTitle: "Paskyra nesusieta su nario įrašu",
    noMemberLinkBody:
      "Susisiekite su bendruomenės administratoriumi, kad jūsų paskyrą susietų su nario duomenimis. Tada galėsite balsuoti, matyti finansų informaciją ir kitas funkcijas.",
    activeVotesLabel: "aktyvių balsavimų",
    debtUnpaidLabel: "neapmokėta",
    debtNoneLabel: "skolų nėra",
    historyMeetingSingular: "susirinkimas",
    historyMeetingPlural: "susirinkimų",
    historyInPast: "istorijoje",
    upcomingMeetingsHeading: "Artėjantys susirinkimai",
    viewAllLink: "Visi →",
    votedBadge: "Balsavote",
    voteNowBadge: "Balsuokite",
    documentsCardTitle: "Dokumentai",
    documentsCardDescription: "Įstatai, protokolai, ataskaitos",
    myDataCardTitle: "Mano duomenys",
    myDataCardDescription: "Atnaujinkite kontaktus ir duomenis",
  },
  portalVoting: {
    pageTitle: "Balsavimai",
    pageSubtitle: "Aktyvūs ir artėjantys susirinkimai, kuriuose galite balsuoti",
    emptyState: "Aktyvių balsavimų nėra",
    pendingSectionTitle: "Laukia jūsų balso ({count})",
    voteButton: "Balsuoti",
    votedSectionTitle: "Jau balsavote ({count})",
    votedBadge: "Balsavote",
  },
  portalHistory: {
    pageTitle: "Mano balsavimo istorija",
    pageSubtitle: "Visi jūsų balsai bendruomenės susirinkimuose",
    emptyState: "Dar nedalyvavote nė viename balsavime",
    attendedInPerson: "Dalyvavote gyvai",
    attendedRemotely: "Dalyvavote nuotoliu",
    votedInWriting: "Balsavote raštu",
    documentsLink: "Dokumentai",
    liveAttendanceSecrecyNote:
      "Dalyvavote susirinkime gyvai. Pagal balsavimo slaptumo principą individualūs Jūsų balsai nesaugomi – tik bendros susirinkimo sumos.",
    viewResolutionsLink: "Žiūrėti susirinkimo nutarimus →",
    votesNotEnteredNote: "Balsavimo įrašai šiam susirinkimui dar nesuvesti.",
    viewMeetingInfoLink: "Žiūrėti susirinkimo informaciją →",
    voteFor: "Už",
    voteAgainst: "Prieš",
    voteAbstain: "Susilaikau",
  },
  portalProfile: {
    pageTitle: "Mano duomenys",
    pageSubtitle: "Atnaujinkite savo kontaktus",
    noMemberLinkTitle: "Paskyra dar nesusieta su nario duomenimis",
    noMemberLinkBody:
      "Susisiekite su bendruomenės administratoriumi, kad jūsų paskyrą susietų su nario įrašu.",
    memberSincePrefix: "Narys nuo",
    statusActive: "Aktyvus",
    changeNameNotice: "Norint pakeisti vardą ar pavardę, susisiekite su administratoriumi.",
    contactsHeading: "Kontaktai",
    emailLabel: "El. paštas",
    emailPlaceholder: "vardenis@email.com",
    phoneLabel: "Telefonas",
    phonePlaceholder: "+370 6XX XXXXX",
    addressLabel: "Adresas",
    addressPlaceholder: "Gatvė ir namo numeris",
    saveButton: "Išsaugoti",
    saveErrorFallback: "Klaida",
    saveSuccessToast: "Duomenys atnaujinti",
  },
  portalDocuments: {
    pageTitle: "Dokumentai",
    pageSubtitle: "Bendruomenės dokumentų archyvas",
    emptyTitle: "Dokumentų nerasta",
    emptyHint: "Pabandykite pakeisti paieškos kriterijus",
    searchPlaceholder: "Ieškoti dokumentų...",
    filterAll: "Visos",
    filtering: "Filtruojama...",
    docsCountWord: "dokumentų",
    ofWord: "iš",
    yearSuffix: " m.",
  },
  docCategories: {
    protokolai: "Protokolai",
    ataskaitos: "Ataskaitos",
    istatai: "Įstatai",
    sutartys: "Sutartys",
    kita: "Kita",
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
  footer: {
    tagline: "Together we build our village. A better future for our community and its people.",
    linksHeading: "Links",
    linkNews: "News",
    linkDocuments: "Documents",
    linkContacts: "Contacts",
    contactsHeading: "Contacts",
    companyCodeLabel: "Company code:",
    emailLabel: "Email:",
    phoneLabel: "Phone:",
    rightsReserved: "All rights reserved.",
  },
  about: {
    pageTitle: "About us",
    visionTitle: "Our vision",
    visionBody:
      "The Krūminiai community aspires to become a model for rural communities in Lithuania – active, modern and socially responsible, where every member feels valued and has the opportunity to contribute to the common good. We believe that rural life can be attractive and modern, combining the strengths of traditional village culture with the opportunities of today.",
    missionTitle: "Our mission",
    missionBody1:
      "We bring together the residents of Krūminiai and the neighbouring villages – Valkininkai, Užuperkasis, Bucivoniai, Urkioniai, Jakėnai and Paversekis – for shared projects and initiatives that improve quality of life in the region. We encourage neighbourliness, volunteering and mutual respect.",
    missionBody2:
      "We actively cooperate with local businesses, the municipality and other organisations to create a harmonious environment where everyone – from the youngest to the oldest – can find activities and take part in community life.",
    fundingTitle: "How our activities are funded",
    fundingIntro:
      "The Krūminiai community operates on a not-for-profit basis – all income received is reinvested into the community's wellbeing: grounds maintenance, events and improving shared infrastructure.",
    fundingMembersTitle: "Member contributions",
    fundingMembersDesc:
      "The joining fee (€20) and the annual membership fee (€12) provide the basic funding for the community's administrative work and for organising events.",
    fundingGroundsTitle: "Grounds maintenance",
    fundingGroundsDesc:
      "Funds go towards the beach (bringing in sand), repairing the playground and maintaining the shared grounds (mowing, fuel, electricity).",
    fundingBridgeTitle: "Renewing the beach footbridge",
    fundingBridgeDesc:
      "It is time for the footbridge to be renewed. The goal is €4,000 – raised from donations by community members and village guests, separately from the membership-fee budget.",
    fundingEventsTitle: "Events",
    fundingEventsDesc:
      "Mindauginės (6 July) and the Christmas tree decorating (December) are the community's traditional annual celebrations. Additional events take place on members' initiative.",
    fundingTransparencyTitle: "Transparency",
    fundingTransparencyDesc:
      "All financial flows are transparent and accessible to community members. We provide financial and annual reports regularly.",
    impactTitle: "Social impact",
    impactCommunityTitle: "Community spirit",
    impactCommunityDesc:
      "We bring villagers together for shared projects and events, strengthening neighbourly ties.",
    impactLivingTitle: "Living environment",
    impactLivingDesc:
      "We maintain the beach, the playground and the shared grounds – improving quality of life in the village.",
    impactTraditionsTitle: "Traditions",
    impactTraditionsDesc:
      "Mindauginės, the Christmas tree decorating and other community events keep village traditions alive.",
    impactTransparencyTitle: "Transparency",
    impactTransparencyDesc:
      "All financial flows and operational decisions are open – trust and accountability to members.",
    valuesTitle: "Our values",
    value1: "Community spirit and solidarity",
    value2: "Responsibility and transparency",
    value3: "Social responsibility and inclusion",
    value4: "Respect for the environment and traditions",
    value5: "Equal opportunities for all",
  },
  auth: {
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Password",
    loginTitle: "Member login",
    loginSubtitle: "Enter your details to log in",
    forgotPassword: "Forgot your password?",
    loggingIn: "Logging in...",
    loginButton: "Log in",
    noAccount: "Don't have an account yet?",
    registerNow: "Register now",
    errInvalidCredentials: "Incorrect email or password",
    errNotApproved: "Your account is not yet approved. Please wait for administrator approval.",
    errNotConfirmed:
      "Your email is not yet confirmed. Check your inbox and click the confirmation link, or wait for the administrator to approve your membership.",
    errAuthLink: "The link is invalid or has expired. Please try logging in again.",
    registerTitle: "Become a member",
    registerSubtitle: "Fill in the form and wait for administrator approval",
    firstNameLabel: "First name",
    firstNamePlaceholder: "First name",
    lastNameLabel: "Last name",
    lastNamePlaceholder: "Last name",
    confirmPasswordLabel: "Repeat password",
    confirmPasswordPlaceholder: "Repeat password",
    registering: "Submitting...",
    registerButton: "Submit registration",
    haveAccount: "Already have an account?",
    loginLink: "Log in",
    errPasswordMismatch: "Passwords do not match",
    errPasswordLength: "The password must be at least 8 characters",
    errSignupFailed: "Could not create the account. Please try again.",
    successTitle: "Registration received!",
    successLine1: "We have sent you an email with payment information.",
    successLine2:
      "To become a full member, pay the joining fee and the membership fee. Once we receive your payment, we will approve your membership and send you login information.",
    backHome: "Back to home",
  },
  projects: {
    pageTitle: "Community projects",
    pageIntro:
      "Fundraising projects – each with its own transparent record of funds and progress toward the goal. Contributions come from community members, village guests and summer visitors.",
    emptyState: "There are no active projects at the moment.",
    fundraisingBadge: "Fundraising",
    amountOfGoal: "of {goal} €",
    donorSingular: "donor",
    donorPlural: "donors",
    readMore: "Read more",
  },
  news: {
    pageTitle: "News",
    emptyState: "No news yet",
  },
  documents: {
    pageHeading: "Documents",
    pageIntro:
      "Community document archive. In the meeting folders you will find the annual report, financial statements, minutes, attendee list and other related documents.",
    emptyState: "There are no documents yet",
    generalDocsHeading: "Main documents",
    meetingsHeading: "Meetings",
    meetingsDescription:
      "Each meeting page contains all related documents (reports, minutes, attendee list), announcements and voting results.",
    docSingular: "document",
    docPlural: "documents",
  },
  portalHome: {
    sidebarSubtitle: "Member portal",
    sectionMyAccount: "My account",
    sectionCommunity: "Community",
    navHome: "Home",
    navVotes: "Votes",
    navMyHistory: "My history",
    navMyPayments: "My payments",
    navMyData: "My details",
    navNews: "News",
    navMeetings: "Meetings",
    navProjects: "Projects",
    navDocuments: "Documents",
    navFinances: "Finances",
    navAboutUs: "About us",
    logout: "Log out",
    menuAria: "Menu",
    greetingWithName: "Hello, {name}!",
    greetingNoName: "Hello!",
    portalSubtitle: "Krūminiai Village Community member portal",
    noMemberLinkTitle: "Account is not linked to a member record",
    noMemberLinkBody:
      "Please contact the community administrator to have your account linked to your member details. You will then be able to vote, view financial information and access other features.",
    activeVotesLabel: "active votes",
    debtUnpaidLabel: "unpaid",
    debtNoneLabel: "no debt",
    historyMeetingSingular: "meeting",
    historyMeetingPlural: "meetings",
    historyInPast: "in history",
    upcomingMeetingsHeading: "Upcoming meetings",
    viewAllLink: "All →",
    votedBadge: "Voted",
    voteNowBadge: "Vote now",
    documentsCardTitle: "Documents",
    documentsCardDescription: "Bylaws, minutes, reports",
    myDataCardTitle: "My details",
    myDataCardDescription: "Update your contact information and details",
  },
  portalVoting: {
    pageTitle: "Votes",
    pageSubtitle: "Active and upcoming meetings where you can vote",
    emptyState: "There are no active votes",
    pendingSectionTitle: "Awaiting your vote ({count})",
    voteButton: "Vote",
    votedSectionTitle: "Already voted ({count})",
    votedBadge: "Voted",
  },
  portalHistory: {
    pageTitle: "My voting history",
    pageSubtitle: "All your votes at community meetings",
    emptyState: "You have not taken part in any vote yet",
    attendedInPerson: "You attended in person",
    attendedRemotely: "You attended remotely",
    votedInWriting: "You voted in writing",
    documentsLink: "Documents",
    liveAttendanceSecrecyNote:
      "You attended the meeting in person. Under the principle of ballot secrecy, your individual votes are not stored — only the aggregate meeting totals.",
    viewResolutionsLink: "View meeting resolutions →",
    votesNotEnteredNote: "Voting records for this meeting have not been entered yet.",
    viewMeetingInfoLink: "View meeting information →",
    voteFor: "For",
    voteAgainst: "Against",
    voteAbstain: "Abstain",
  },
  portalProfile: {
    pageTitle: "My details",
    pageSubtitle: "Update your contact details",
    noMemberLinkTitle: "Account is not yet linked to member records",
    noMemberLinkBody:
      "Please contact the community administrator to have your account linked to a member record.",
    memberSincePrefix: "Member since",
    statusActive: "Active",
    changeNameNotice: "To change your first or last name, please contact the administrator.",
    contactsHeading: "Contact details",
    emailLabel: "Email",
    emailPlaceholder: "name@email.com",
    phoneLabel: "Phone",
    phonePlaceholder: "+370 6XX XXXXX",
    addressLabel: "Address",
    addressPlaceholder: "Street and house number",
    saveButton: "Save",
    saveErrorFallback: "Error",
    saveSuccessToast: "Details updated",
  },
  portalDocuments: {
    pageTitle: "Documents",
    pageSubtitle: "Community document archive",
    emptyTitle: "No documents found",
    emptyHint: "Try changing your search criteria",
    searchPlaceholder: "Search documents...",
    filterAll: "All",
    filtering: "Filtering...",
    docsCountWord: "documents",
    ofWord: "of",
    yearSuffix: "",
  },
  docCategories: {
    protokolai: "Minutes",
    ataskaitos: "Reports",
    istatai: "Articles of association",
    sutartys: "Contracts",
    kita: "Other",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { lt, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? lt;
}
