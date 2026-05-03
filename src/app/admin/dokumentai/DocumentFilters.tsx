"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import { Search, X, Eye, EyeOff } from "lucide-react";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface Props {
  totalCount: number;
  filteredCount: number;
}

export function DocumentFilters({ totalCount, filteredCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") || "");
  const category = searchParams.get("category") || "visos";
  const visibility = searchParams.get("visibility") || "all";
  const sort = searchParams.get("sort") || "newest";

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (search.trim()) params.set("q", search.trim());
      else params.delete("q");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all" && value !== "visos" && value !== "newest") params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  const hasFilters =
    search.trim() !== "" || category !== "visos" || visibility !== "all" || sort !== "newest";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
      {/* Paieška */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          placeholder="Ieškoti pagal pavadinimą, aprašymą arba failo vardą..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-9 py-2 text-sm rounded-lg border border-gray-300 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Kategorijų filtras (chip'ai) */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={category === "visos"}
          onClick={() => setParam("category", null)}
          label="Visos"
        />
        {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([key, label]) => (
          <FilterChip
            key={key}
            active={category === key}
            onClick={() => setParam("category", category === key ? null : key)}
            label={label}
          />
        ))}
      </div>

      {/* Sub-filtrai */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500">Matomumas:</span>
          <FilterChip
            active={visibility === "all"}
            onClick={() => setParam("visibility", null)}
            label="Visi"
            size="xs"
          />
          <FilterChip
            active={visibility === "visible"}
            onClick={() => setParam("visibility", "visible")}
            label={
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" /> Matomi
              </span>
            }
            size="xs"
          />
          <FilterChip
            active={visibility === "hidden"}
            onClick={() => setParam("visibility", "hidden")}
            label={
              <span className="flex items-center gap-1">
                <EyeOff className="h-3 w-3" /> Paslėpti
              </span>
            }
            size="xs"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-gray-500">Rūšiuoti:</span>
          <select
            value={sort}
            onChange={(e) => setParam("sort", e.target.value === "newest" ? null : e.target.value)}
            className="text-xs rounded-md border border-gray-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="newest">Naujausi pirma</option>
            <option value="oldest">Seniausi pirma</option>
            <option value="name">Pagal pavadinimą</option>
          </select>
        </div>

        <div className="ml-auto text-gray-500">
          {isPending ? (
            <span className="text-blue-600">Filtruojama...</span>
          ) : hasFilters ? (
            <span>
              <strong className="text-gray-700">{filteredCount}</strong> iš {totalCount}
            </span>
          ) : (
            <span>{totalCount} dokumentų</span>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  size = "sm",
}: {
  active: boolean;
  onClick: () => void;
  label: React.ReactNode;
  size?: "xs" | "sm";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full font-medium transition-colors",
        size === "xs" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs",
        active
          ? "bg-green-700 text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      )}
    >
      {label}
    </button>
  );
}
