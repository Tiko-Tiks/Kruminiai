"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  iban: string;
}

export function CopyIbanButton({ iban }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(iban);
      setCopied(true);
      toast.success("IBAN nukopijuotas");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Nepavyko nukopijuoti – pažymėk ir nukopijuok rankomis");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:text-green-800 font-semibold px-2 py-1 rounded hover:bg-green-50 transition-colors"
      aria-label="Kopijuoti IBAN"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Nukopijuota
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Kopijuoti
        </>
      )}
    </button>
  );
}
