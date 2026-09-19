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
      className={cn("inline-flex items-center rounded-lg border border-line overflow-hidden", className)}
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
            "min-h-[2rem] px-2.5 py-1.5 text-xs font-semibold transition-colors",
            locale === l
              ? "bg-brand text-brand-ink"
              : "bg-surface text-ink-subtle hover:text-ink hover:bg-surface-muted"
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
