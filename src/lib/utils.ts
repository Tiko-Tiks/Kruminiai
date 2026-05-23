import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { lt } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "yyyy-MM-dd");
}

export function formatDateLong(date: string | Date): string {
  return format(new Date(date), "yyyy 'm.' MMMM d 'd.'", { locale: lt });
}

/**
 * Formatuoja laiką HH:MM Europe/Vilnius zonoje.
 *
 * BŪTINA naudoti vietoj date.toLocaleTimeString("lt-LT", {...}) – Vercel
 * serveris veikia UTC zonoje, todėl SSR rodytų UTC valandą (pvz. 15:00
 * vietoj 18:00 Vilniaus laiku). Šis helper'is visada konvertuoja į
 * Europe/Vilnius nepriklausomai nuo serverio zonos.
 */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("lt-LT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Vilnius",
  });
}

export function formatCurrency(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// Sukonstruoti viešą URL dokumentui pagal file_path.
// Palaiko kelis formatus:
//   - __api__/X/Y    → /api/X/Y (server-rendered HTML, pvz. salinami sąrašas)
//   - __public__/X   → /X (statinis viešas failas)
//   - X.pdf (default) → Supabase Storage public URL
export function getDocumentPublicUrl(filePath: string): string {
  if (filePath.startsWith("__api__/")) {
    return `/api/${filePath.replace("__api__/", "")}`;
  }
  if (filePath.startsWith("__public__/")) {
    return `/${filePath.replace("__public__/", "")}`;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return `${base}/storage/v1/object/public/documents/${filePath}`;
}

// Ar dokumentas yra server-generuojamas HTML (ne PDF failas)?
// Naudojama nuspręsti, ar peržiūrai naudoti iframe ar PdfViewer.
export function isServerGeneratedDoc(filePath: string): boolean {
  return filePath.startsWith("__api__/");
}

// Lietuviškas šauksmininkas (vocative case) – kreipiniams.
// Mindaugas → Mindaugai, Andrius → Andriau, Eglė → Egle.
export function vocative(name: string): string {
  if (!name) return name;
  const lower = name.toLowerCase();
  // -ius → -iau (turi būti tikrinamas prieš -us)
  if (lower.endsWith("ius")) return name.slice(0, -3) + "iau";
  // -ys → -y
  if (lower.endsWith("ys")) return name.slice(0, -2) + "y";
  // -us → -au
  if (lower.endsWith("us")) return name.slice(0, -2) + "au";
  // -as → -ai
  if (lower.endsWith("as")) return name.slice(0, -2) + "ai";
  // -is → -i
  if (lower.endsWith("is")) return name.slice(0, -2) + "i";
  // -ė → -e
  if (lower.endsWith("ė")) return name.slice(0, -1) + "e";
  // -a → nesikeičia (Aldona, Rasa)
  return name;
}

export function generateSlug(text: string): string {
  const charMap: Record<string, string> = {
    ą: "a", č: "c", ę: "e", ė: "e", į: "i",
    š: "s", ų: "u", ū: "u", ž: "z",
    Ą: "a", Č: "c", Ę: "e", Ė: "e", Į: "i",
    Š: "s", Ų: "u", Ū: "u", Ž: "z",
  };
  return text
    .split("")
    .map((c) => charMap[c] || c)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
