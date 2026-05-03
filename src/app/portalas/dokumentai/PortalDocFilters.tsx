"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import { Search, X } from "lucide-react";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface Props {
  totalCount: number;
  filteredCount: number;
}

export function PortalDocFilters({ totalCount, filteredCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const category = searchParams.get("category") || "visos";

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (search.trim()) params.set("q", search.trim());
      else params.delete("q");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setCategory(value: string | null) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "visos") params.set("category", value);
    else params.delete("category");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          placeholder="Ieškoti dokumentų..."
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

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={category === "visos"} onClick={() => setCategory(null)} label="Visos" />
        {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([key, label]) => (
          <Chip
            key={key}
            active={category === key}
            onClick={() => setCategory(category === key ? null : key)}
            label={label}
          />
        ))}
        <span className="ml-auto text-xs text-gray-500">
          {isPending ? (
            "Filtruojama..."
          ) : filteredCount === totalCount ? (
            `${totalCount} dokumentų`
          ) : (
            <>
              <strong>{filteredCount}</strong> iš {totalCount}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active ? "bg-green-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      )}
    >
      {label}
    </button>
  );
}
