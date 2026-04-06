"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";

export function MembersSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("paieska") || "");
  const [status, setStatus] = useState(searchParams.get("statusas") || "visi");

  const applyFilters = (newSearch?: string, newStatus?: string) => {
    const params = new URLSearchParams();
    const s = newSearch ?? search;
    const st = newStatus ?? status;
    if (s) params.set("paieska", s);
    if (st && st !== "visi") params.set("statusas", st);
    router.push(`/admin/nariai?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          placeholder="Ieškoti pagal vardą, pavardę, el. paštą..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </div>
      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          applyFilters(undefined, e.target.value);
        }}
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      >
        <option value="visi">Visi statusai</option>
        <option value="aktyvus">Aktyvūs</option>
        <option value="pasyvus">Pasyvūs</option>
        <option value="išstojęs">Išstoję</option>
      </select>
    </div>
  );
}
