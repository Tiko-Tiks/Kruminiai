"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { lt } from "date-fns/locale";
import { format, parse, isValid } from "date-fns";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-day-picker/dist/style.css";

interface DatePickerProps {
  label?: string;
  name: string;
  defaultValue?: string; // YYYY-MM-DD
  error?: string;
  required?: boolean;
  placeholder?: string;
}

export function DatePicker({
  label,
  name,
  defaultValue,
  error,
  required,
  placeholder = "YYYY-MM-DD",
}: DatePickerProps) {
  const [value, setValue] = useState(defaultValue || "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Uždaryti popup paspaudus išorėje
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedDate = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const isValidDate = selectedDate && isValid(selectedDate);

  return (
    <div className="space-y-1" ref={ref}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="relative">
        <input
          type="text"
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          required={required}
          pattern="\d{4}-\d{2}-\d{2}"
          inputMode="numeric"
          className={cn(
            "block w-full rounded-lg border px-3 py-2 pr-10 text-sm shadow-sm transition-colors",
            "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
            "placeholder:text-gray-400",
            error ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300"
          )}
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          <Calendar className="h-4 w-4" />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2">
            <DayPicker
              mode="single"
              selected={isValidDate ? selectedDate : undefined}
              onSelect={(d) => {
                if (d) {
                  setValue(format(d, "yyyy-MM-dd"));
                  setOpen(false);
                }
              }}
              locale={lt}
              weekStartsOn={1}
              showOutsideDays
              defaultMonth={isValidDate ? selectedDate : new Date()}
            />
          </div>
        )}
      </div>
      {isValidDate && (
        <p className="text-xs text-gray-500">{format(selectedDate!, "yyyy 'm.' MMMM d 'd.' (EEEE)", { locale: lt })}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
