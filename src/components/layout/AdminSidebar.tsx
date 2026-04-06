"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Banknote,
  FileText,
  Newspaper,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/constants";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const icons = {
  LayoutDashboard,
  Users,
  Banknote,
  FileText,
  Newspaper,
};

const navItems = [
  { label: "Suvestinė", href: "/admin", icon: "LayoutDashboard" },
  { label: "Nariai", href: "/admin/nariai", icon: "Users" },
  { label: "Mokesčiai", href: "/admin/mokesciai", icon: "Banknote" },
  { label: "Dokumentai", href: "/admin/dokumentai", icon: "FileText" },
  { label: "Naujienos", href: "/admin/naujienos", icon: "Newspaper" },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/prisijungimas");
  };

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/50">
        <div className="h-8 w-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-xs">
          KB
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{SITE_NAME}</p>
          <p className="text-xs text-slate-400">Administravimas</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = icons[item.icon as keyof typeof icons];
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-700/50 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <ExternalLink className="h-5 w-5" />
          Viešas puslapis
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Atsijungti
        </button>
      </div>
    </aside>
  );
}
