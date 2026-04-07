export const SITE_NAME = "Krūminių kaimo bendruomenė";

export const PUBLIC_NAV = [
  { label: "Pradžia", href: "/" },
  { label: "Naujienos", href: "/naujienos" },
  { label: "Dokumentai", href: "/dokumentai" },
  { label: "Apie mus", href: "/kontaktai" },
  { label: "Skaidrumas", href: "/skaidrumas" },
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

export const VOTE_LABELS: Record<string, string> = {
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
