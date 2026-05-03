"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, UserPlus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PUBLIC_NAV, SITE_NAME } from "@/lib/constants";

export function PublicHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            <Image
              src="/images/logo-sm.png"
              alt={SITE_NAME}
              width={64}
              height={96}
              className="h-12 w-auto"
            />
            <div className="hidden xl:block leading-tight">
              <div className="font-semibold text-gray-900 text-sm">Krūminių kaimo</div>
              <div className="text-xs text-gray-500">bendruomenė</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 ml-auto">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  pathname === item.href
                    ? "bg-green-50 text-green-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="ml-3 pl-3 border-l border-gray-200 flex items-center gap-2">
              <Link
                href="/prisijungimas"
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
              >
                Prisijungti
              </Link>
              <Link
                href="/registracija"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-green-700 text-white hover:bg-green-600 transition-colors whitespace-nowrap shadow-sm"
              >
                <UserPlus className="h-4 w-4" />
                Tapti nariu
              </Link>
            </div>
          </nav>

          <button
            className="md:hidden p-2 text-gray-600"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Uždaryti meniu" : "Atidaryti meniu"}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-100 pt-2 space-y-0.5">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "block px-3 py-2.5 rounded-lg text-sm font-medium",
                  pathname === item.href
                    ? "bg-green-50 text-green-700"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="border-t border-gray-100 mt-2 pt-2 space-y-0.5">
              <Link
                href="/prisijungimas"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Prisijungti
              </Link>
              <Link
                href="/registracija"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-green-700 text-white"
              >
                <UserPlus className="h-4 w-4" />
                Tapti nariu
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
