"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function MembersSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("paieska") || "");
  // Pagal nutylėjimą rodom tik aktyvius – sinchroniška su page.tsx default'u.
  const [status, setStatus] = useState(searchParams.get("statusas") || "aktyvus");
  // Pirmo renderio metu nepushinam – kad nesutriktų SSR pateiktas URL.
  const isFirstRender = useRef(true);

  const applyFilters = (s: string, st: string) => {
    const params = new URLSearchParams();
    if (s.trim()) params.set("paieska", s.trim());
    // "aktyvus" yra default – nereikia įrašyti į URL.
    if (st && st !== "aktyvus") params.set("statusas", st);
    const qs = params.toString();
    // replace (ne push) – kad kiekvienas paspaudimas neterštų istorijos.
    router.replace(qs ? `/admin/nariai?${qs}` : "/admin/nariai");
  };

  // Automatinis filtravimas su debounce – nereikia spausti Enter.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => applyFilters(search, status), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters(search, status)}
          placeholder="Ieškoti pagal vardą, pavardę, el. paštą, telefoną..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </div>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      >
        <option value="aktyvus">Aktyvūs (numatyta)</option>
        <option value="pasyvus">Pasyvūs</option>
        <option value="išstojęs">Išstoję</option>
        <option value="visi">Visi statusai</option>
      </select>
    </div>
  );
}
