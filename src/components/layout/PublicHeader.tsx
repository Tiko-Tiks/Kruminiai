"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, UserPlus } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { PUBLIC_NAV, SITE_NAME } from "@/lib/constants";
import { createClient } from "@/lib/supabase";
import { useT } from "@/components/i18n/LocaleProvider";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";

export function PublicHeader() {
  const pathname = usePathname();
  const t = useT();
  const navLabel = (key: string, fallback: string) =>
    (t.nav as Record<string, string>)[key] ?? fallback;
  const [menuOpen, setMenuOpen] = useState(false);
  // Hidrato metu nežinom ar prisijungęs – pradedam nuo „neprisijungęs", kad
  // dauguma viešų lankytojų iš karto matytų švarų meniu be auth-only tabų.
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setIsAuthenticated(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setIsAuthenticated(!!session?.user);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const visibleNav = PUBLIC_NAV.filter((item) => !item.requiresAuth || isAuthenticated);

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-line">
      <a href="#turinys" className="skip-link">
        {t.header.skipToContent}
      </a>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            <Image
              src="/images/logo-sm.png"
              alt={SITE_NAME}
              width={64}
              height={96}
              priority
              className="h-12 w-auto"
            />
            <div className="hidden sm:block leading-tight">
              <div className="font-display font-semibold text-ink text-base leading-none">{t.header.communityLine1}</div>
              <div className="font-display text-sm text-ink-muted">{t.header.communityLine2}</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 ml-auto">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  pathname === item.href
                    ? "bg-brand-soft text-brand-strong"
                    : "text-ink-muted hover:text-ink hover:bg-surface-muted"
                )}
              >
                {navLabel(item.key, item.label)}
              </Link>
            ))}
            <div className="ml-3 pl-3 border-l border-line flex items-center gap-2">
              <LanguageToggle />
              {isAuthenticated ? (
                <Link
                  href="/portalas"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-brand text-brand-ink hover:bg-brand-strong transition-colors whitespace-nowrap shadow-sm"
                >
                  {t.header.myAccount}
                </Link>
              ) : (
                <>
                  <Link
                    href="/prisijungimas"
                    className="px-3 py-2 rounded-lg text-sm font-medium text-ink-muted hover:text-ink transition-colors whitespace-nowrap"
                  >
                    {t.header.login}
                  </Link>
                  <Link
                    href="/registracija"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-brand text-brand-ink hover:bg-brand-strong transition-colors whitespace-nowrap shadow-sm"
                  >
                    <UserPlus className="h-4 w-4" />
                    {t.header.becomeMember}
                  </Link>
                </>
              )}
            </div>
          </nav>

          <button
            className="md:hidden -mr-2 p-3 text-ink-muted"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? t.header.closeMenu : t.header.openMenu}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-4 border-t border-line pt-2 space-y-0.5">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "block px-3 py-2.5 rounded-lg text-sm font-medium",
                  pathname === item.href
                    ? "bg-brand-soft text-brand-strong"
                    : "text-ink-muted hover:bg-surface-muted"
                )}
              >
                {navLabel(item.key, item.label)}
              </Link>
            ))}
            <div className="border-t border-line mt-2 pt-2 space-y-2">
              <div className="px-1">
                <LanguageToggle />
              </div>
              {isAuthenticated ? (
                <Link
                  href="/portalas"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-lg text-sm font-semibold bg-brand text-brand-ink"
                >
                  {t.header.myAccount}
                </Link>
              ) : (
                <>
                  <Link
                    href="/prisijungimas"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 rounded-lg text-sm font-medium text-ink-muted hover:bg-surface-muted"
                  >
                    {t.header.login}
                  </Link>
                  <Link
                    href="/registracija"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold bg-brand text-brand-ink"
                  >
                    <UserPlus className="h-4 w-4" />
                    {t.header.becomeMember}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
