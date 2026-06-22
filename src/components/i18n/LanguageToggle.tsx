"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// LT / EN perjungiklis. Kalba saugoma cookie'je, po pakeitimo – router.refresh(),
// kad serverio komponentai persirenderintų nauja kalba.
export function LanguageToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();

  const setLocale = (next: Locale) => {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  };

  return (
    <div
      className={cn("inline-flex items-center rounded-lg border border-gray-200 overflow-hidden", className)}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={cn(
            "px-2 py-1 text-xs font-semibold transition-colors",
            locale === l
              ? "bg-green-700 text-white"
              : "bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
