export const SITE_NAME = "Krūminių kaimo bendruomenė";

// `key` atitinka i18n žodyno `nav` raktą (žr. src/lib/i18n.ts); `label` –
// lietuviškas fallback'as, jei vertimo nebūtų.
export const PUBLIC_NAV = [
  { key: "home", label: "Pradžia", href: "/", requiresAuth: false },
  { key: "news", label: "Naujienos", href: "/naujienos", requiresAuth: false },
  { key: "projects", label: "Projektai", href: "/projektai", requiresAuth: false },
  { key: "meetings", label: "Susirinkimai", href: "/susirinkimai", requiresAuth: true },
  { key: "documents", label: "Dokumentai", href: "/dokumentai", requiresAuth: true },
  { key: "finance", label: "Finansai", href: "/skaidrumas", requiresAuth: true },
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
  // Garbės narys – be mokesčio prievolės, be balso teisės (tik patariamasis),
  // neskaičiuojamas į kvorumą. Žr. CLAUDE.md „Garbės nario statusas".
  garbes_narys: "Garbės narys",
};

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

export const MEETING_TYPE_LABELS: Record<string, string> = {
  visuotinis: "Visuotinis narių susirinkimas",
  neeilinis: "Neeilinis susirinkimas",
  pakartotinis: "Pakartotinis susirinkimas",
  valdybos: "Valdybos posėdis",
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

// Balsavimo RPC (cast_votes_as_member / cast_votes_with_token) klaidų kodai →
// žmogui suprantamas tekstas. Nežinomas kodas rodomas kaip yra.
export const VOTE_ERROR_MESSAGES: Record<string, string> = {
  not_eligible:
    "Pagal dabartinį narystės statusą balso teisės neturite (garbės nariai dalyvauja patariamojo balso teise).",
  voting_closed:
    "Nuotolinis balsavimas šiam susirinkimui neaktyvus – laikotarpis dar neprasidėjo arba jau pasibaigė.",
  incomplete_ballot: "Pateikite atsakymą į visus darbotvarkės klausimus.",
  already_voted: "Jūs jau balsavote šiame susirinkime.",
  meeting_not_found: "Susirinkimas nerastas.",
  expired: "Nuorodos galiojimas pasibaigė.",
  invalid_token: "Nuoroda negaliojanti.",
  no_member_link: "Paskyra nesusieta su nario įrašu.",
};

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
