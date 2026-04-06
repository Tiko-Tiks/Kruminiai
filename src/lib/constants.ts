export const SITE_NAME = "Krūminių kaimo bendruomenė";

export const PUBLIC_NAV = [
  { label: "Pradžia", href: "/" },
  { label: "Naujienos", href: "/naujienos" },
  { label: "Dokumentai", href: "/dokumentai" },
  { label: "Apie mus", href: "/kontaktai" },
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
