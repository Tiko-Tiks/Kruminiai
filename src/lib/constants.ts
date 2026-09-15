export const SITE_NAME = "Krūminių kaimo bendruomenė";

// `key` atitinka i18n žodyno `nav` raktą (žr. src/lib/i18n.ts); `label` –
// lietuviškas fallback'as, jei vertimo nebūtų.
export const PUBLIC_NAV = [
  { key: "home", label: "Pradžia", href: "/", requiresAuth: false },
  { key: "news", label: "Naujienos", href: "/naujienos", requiresAuth: false },
  { key: "projects", label: "Projektai", href: "/projektai", requiresAuth: false },
  { key: "meetings", label: "Susirinkimai", href: "/susirinkimai", requiresAuth: true },
  { key: "documents", label: "Dokumentai", href: "/dokumentai", requiresAuth: true },
  { key: "finance", label: "Finansai", href: "/finansai", requiresAuth: true },
  { key: "about", label: "Apie mus", href: "/kontaktai", requiresAuth: false },
];

export const ADMIN_NAV = [
  { label: "Suvestinė", href: "/admin", icon: "LayoutDashboard" },
  { label: "Nariai", href: "/admin/nariai", icon: "Users" },
  { label: "Mokesčiai", href: "/admin/mokesciai", icon: "Banknote" },
  { label: "Dokumentai", href: "/admin/dokumentai", icon: "FileText" },
  { label: "Naujienos", href: "/admin/naujienos", icon: "Newspaper" },
] as const;

export const MEMBER_STATUS_LABELS: Record<string, string> = {
  aktyvus: "Aktyvus",
  pasyvus: "Pasyvus",
  "išstojęs": "Išstojęs",
  // Garbės narys – be nario mokesčio prievolės, bet su PILNA balso teise ir
  // įskaičiuojamas į kvorumą. Žr. CLAUDE.md „Garbės nario statusas".
  garbes_narys: "Garbės narys",
};

// Esami nariai – VISI, išskyrus išstojusius. Garbės narys turi tas pačias
// teises kaip įprastas narys (balsavimas, kvorumas, dalyvavimas), todėl šis
// sąrašas naudojamas balsavimo, kvorumo ir dalyvių užklausose.
// DB pusėje tą patį sako `public.is_voting_status()` (migr. 042).
export const ACTIVE_MEMBER_STATUSES: string[] = ["aktyvus", "pasyvus", "garbes_narys"];

// Nario mokestį mokantys nariai – garbės narys nuo mokesčio ATLEISTAS, todėl
// skolų, priminimų, deklaracijų ir šalinimo už nemokėjimą užklausose jo nėra.
export const FEE_STATUSES: string[] = ["aktyvus", "pasyvus"];

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  protokolai: "Protokolai",
  ataskaitos: "Ataskaitos",
  istatai: "Įstatai",
  sutartys: "Sutartys",
  kita: "Kita",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  grynieji: "Grynieji",
  pavedimas: "Pavedimas",
  kita: "Kita",
};

export const FEE_TYPE_LABELS: Record<string, string> = {
  metinis: "Metinis mokestis",
  tikslinis: "Tikslinis įnašas",
  vienkartinis: "Vienkartinis mokėjimas",
  kita: "Kita",
};

// Voting module constants

// `valdybos` reikšmė DB istorinė – įstatuose (V skyrius) kolegialus valdymo
// organas yra TARYBA, todėl naudotojui rodom „Tarybos posėdis".
export const MEETING_TYPE_LABELS: Record<string, string> = {
  visuotinis: "Visuotinis narių susirinkimas",
  neeilinis: "Neeilinis susirinkimas",
  pakartotinis: "Pakartotinis susirinkimas",
  valdybos: "Tarybos posėdis",
};

export const MEETING_STATUS_LABELS: Record<string, string> = {
  planuojamas: "Planuojamas",
  registracija: "Registracija",
  vyksta: "Vyksta",
  baigtas: "Baigtas",
  atšauktas: "Atšauktas",
};

export const RESOLUTION_STATUS_LABELS: Record<string, string> = {
  projektas: "Projektas",
  svarstomas: "Svarstomas",
  balsuojamas: "Balsuojamas",
  patvirtintas: "Patvirtintas",
  atmestas: "Atmestas",
};

// Balsavimo mygtukų etiketės – pirmasis asmuo, kaip vartotojas pats sakytų
export const VOTE_LABELS: Record<string, string> = {
  uz: "Už",
  pries: "Prieš",
  susilaike: "Susilaikau",
};

// Balsavimo RPC klaidų kodai → nario kalba: žr. `voteErrorMessage()`
// (`src/lib/vote-errors.ts`) ir `voteErrors` namespace `src/lib/i18n.ts`.

// Rezultatų / protokolo etiketės – trečiasis asmuo, kaip atsiskaitoma
export const VOTE_RESULT_LABELS: Record<string, string> = {
  uz: "Už",
  pries: "Prieš",
  susilaike: "Susilaikė",
};

export const VOTE_TYPE_LABELS: Record<string, string> = {
  fizinis: "Gyvai",
  isankstinis: "Išankstinis (online)",
  rastu: "Raštu",
};

export const ATTENDANCE_TYPE_LABELS: Record<string, string> = {
  fizinis: "Gyvai",
  nuotolinis: "Nuotoliniu būdu",
  rastu: "Balsavo raštu",
};

export const COMMUNITY_LEGAL = {
  name: "Krūminių kaimo bendruomenė",
  code: "302795244",
  address: "Beržų g. 8, Krūminių k., Varėnos r.",
};

// Finansų modulis (migr. 044). Admin pusės LT etiketės; nariams rodomos
// versijos gyvena i18n žodyne (`finance` namespace, LT + EN).

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  projektas: "Projekto darbai ir medžiagos",
  komunaliniai: "Komunaliniai mokesčiai",
  administracija: "Administravimas",
  renginiai: "Renginiai",
  kita: "Kita",
};

// IŠ KOKIŲ lėšų apmokėta. Be šito nesimato, ar elektra apmokėta iš nario
// mokesčių, ar netyčia iš tikslinių projekto aukų.
export const FUNDING_SOURCE_LABELS: Record<string, string> = {
  projekto_lesos: "Projekto lėšos (tikslinės aukos)",
  bendruomenes_fondas: "Bendruomenės fondas",
  nario_mokesciai: "Nario mokesčiai",
  savivaldybes_parama: "Savivaldybės parama",
  kita: "Kita",
};

export const EXPENSE_PAYMENT_METHOD_LABELS: Record<string, string> = {
  bankas: "Iš banko sąskaitos",
  grynieji: "Grynaisiais (iš kasos)",
};

export const DONATION_METHOD_LABELS: Record<string, string> = {
  sepa: "SEPA pavedimas",
  cash: "Grynaisiais",
  card: "Kortele",
  other: "Kita",
};

export const DONOR_DISPLAY_MODE_LABELS: Record<string, string> = {
  initials: "Tik inicialai (numatyta)",
  full: "Pilnas vardas (organizacija arba duotas sutikimas)",
  anonymous: "Anonimas",
};

export const CASH_TRANSFER_DIRECTION_LABELS: Record<string, string> = {
  kasa_i_banka: "Iš kasos į banką",
  bankas_i_kasa: "Iš banko į kasą",
};
