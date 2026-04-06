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

export function formatCurrency(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
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
