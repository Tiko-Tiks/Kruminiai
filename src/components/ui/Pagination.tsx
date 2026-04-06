"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
}

export function Pagination({ currentPage, totalPages, basePath }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const goTo = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("puslapis", page.toString());
    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage <= 1}
        className={cn(
          "p-2 rounded-lg text-sm",
          currentPage <= 1 ? "text-gray-300" : "text-gray-600 hover:bg-gray-100"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <button
          key={page}
          onClick={() => goTo(page)}
          className={cn(
            "h-8 w-8 rounded-lg text-sm font-medium",
            page === currentPage
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          )}
        >
          {page}
        </button>
      ))}
      <button
        onClick={() => goTo(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={cn(
          "p-2 rounded-lg text-sm",
          currentPage >= totalPages ? "text-gray-300" : "text-gray-600 hover:bg-gray-100"
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
