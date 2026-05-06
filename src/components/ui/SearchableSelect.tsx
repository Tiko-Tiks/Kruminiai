"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Pagalbinis tekstas paieškai (telefonas, email ir pan.) – paieška ir per jį */
  searchHint?: string;
}

interface SearchableSelectProps {
  id?: string;
  name: string;
  label?: string;
  placeholder?: string;
  options: SearchableSelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  emptyText?: string;
}

// Lietuviška diakritikos transliteracija paieškai (ą→a, š→s, ...)
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ąĄ]/g, "a")
    .replace(/[čČ]/g, "c")
    .replace(/[ęėĘĖ]/g, "e")
    .replace(/[įĮ]/g, "i")
    .replace(/[šŠ]/g, "s")
    .replace(/[ųūŲŪ]/g, "u")
    .replace(/[žŽ]/g, "z");
}

export function SearchableSelect({
  id,
  name,
  label,
  placeholder = "Pasirinkite...",
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  required,
  error,
  disabled,
  emptyText = "Nieko nerasta",
}: SearchableSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = normalize(query.trim());
    return options.filter((o) => {
      const haystack = normalize(`${o.label} ${o.searchHint ?? ""}`);
      // Visi paieškos žodžiai turi būti rasti (AND)
      return q.split(/\s+/).every((part) => haystack.includes(part));
    });
  }, [options, query]);

  // Uždaryti spustelėjus už ribų
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reset highlight kai keičiasi filtras
  useEffect(() => {
    setHighlightIdx(0);
  }, [query, open]);

  const setValue = (v: string) => {
    if (controlledValue === undefined) setInternalValue(v);
    onChange?.(v);
  };

  const handleSelect = (opt: SearchableSelectOption) => {
    setValue(opt.value);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue("");
    setQuery("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setHighlightIdx((i) => Math.max(i - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      const item = filtered[highlightIdx];
      if (item) handleSelect(item);
      e.preventDefault();
    } else if (e.key === "Escape") {
      setOpen(false);
      e.preventDefault();
    }
  };

  return (
    <div className="space-y-1" ref={containerRef}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      {/* Hidden input – jis nešasi formoje */}
      <input type="hidden" name={name} value={value} required={required} />

      <div className="relative">
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => {
            setOpen((o) => !o);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "block w-full rounded-lg border bg-white px-3 py-2 pr-9 text-left text-sm shadow-sm transition-colors",
            "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300",
            disabled && "opacity-50 cursor-not-allowed",
            !selected && "text-gray-400"
          )}
        >
          {selected ? selected.label : placeholder}
        </button>

        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {selected && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="pointer-events-auto p-0.5 text-gray-400 hover:text-gray-600 rounded"
              aria-label="Išvalyti"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-400 transition-transform",
              open && "rotate-180"
            )}
          />
        </div>

        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-72 overflow-hidden flex flex-col">
            <div className="relative border-b border-gray-100">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ieškoti..."
                className="w-full bg-transparent pl-9 pr-3 py-2 text-sm focus:outline-none"
                autoComplete="off"
              />
            </div>
            <div className="overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-sm text-gray-400 text-center">{emptyText}</p>
              ) : (
                filtered.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isHighlight = idx === highlightIdx;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => setHighlightIdx(idx)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors",
                        isHighlight ? "bg-blue-50 text-blue-900" : "text-gray-700",
                        isSelected && "font-medium"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{opt.label}</div>
                        {opt.searchHint && (
                          <div className="text-xs text-gray-400 truncate">
                            {opt.searchHint}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
