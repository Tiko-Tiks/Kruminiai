"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Vote,
  History,
  Banknote,
  FileText,
  CalendarDays,
  User,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/constants";
import { createClient } from "@/lib/supabase";

const navItems = [
  { label: "Pradžia", href: "/portalas", icon: LayoutDashboard },
  { label: "Balsavimai", href: "/portalas/balsavimai", icon: Vote },
  { label: "Susirinkimai", href: "/portalas/susirinkimai", icon: CalendarDays },
  { label: "Mano istorija", href: "/portalas/istorija", icon: History },
  { label: "Finansai", href: "/portalas/finansai", icon: Banknote },
  { label: "Dokumentai", href: "/portalas/dokumentai", icon: FileText },
  { label: "Mano duomenys", href: "/portalas/profilis", icon: User },
];

export function MemberSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/prisijungimas");
  };

  const isActive = (href: string) => {
    if (href === "/portalas") return pathname === "/portalas";
    return pathname.startsWith(href);
  };

  const navContent = (
    <>
      <div className="flex items-center gap-3 px-5 py-5 border-b border-green-700/30">
        <Image
          src="/images/logo-sm.png"
          alt="Logo"
          width={32}
          height={48}
          className="h-9 w-auto"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{SITE_NAME}</p>
          <p className="text-xs text-green-200">Nario portalas</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white/15 text-white"
                  : "text-green-100 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-green-700/30 space-y-1">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-green-100 hover:bg-white/10 hover:text-white transition-colors"
        >
          <ExternalLink className="h-5 w-5" />
          Viešas puslapis
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-green-100 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Atsijungti
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-lg bg-white shadow-md border border-gray-200"
        aria-label="Meniu"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 flex flex-col bg-gradient-to-b from-green-800 to-green-900 text-white transition-transform",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {navContent}
      </aside>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
