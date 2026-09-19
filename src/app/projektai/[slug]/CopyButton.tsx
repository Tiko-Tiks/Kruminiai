"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/LocaleProvider";

interface Props {
  /** Tekstas, kuris keliauja į iškarpinę (IBAN, nuoroda…). */
  value: string;
  className?: string;
  /**
   * Etiketės perrašymas kitam kontekstui. Numatytoji reikšmė – IBAN tekstai
   * (pirmasis, seniausias naudojimas). „Pasidalink" bloke kopijuojama nuoroda,
   * ne IBAN, todėl ten paduodamos `shareLinkCopyAriaLabel`/`shareLinkCopyToastSuccess`
   * – kitaip ekrano skaitytuvas ir sėkmės pranešimas sakytų „IBAN", nors
   * nukopijuota nuoroda (Codex peržiūra, PR #17).
   */
  ariaLabel?: string;
  successMessage?: string;
}

/**
 * Anksčiau tai buvo `CopyIbanButton` – vienintelė vieta, kur kopijavimas
 * realiai veikė. „Pasidalink" bloke šalia nuorodos gulėjo tik `<Copy>` ikona
 * be jokio `onClick`: atrodė kaip mygtukas, bet paspaudus nieko neįvykdavo.
 * Dabar abi vietos naudoja tą patį komponentą.
 */
export function CopyButton({ value, className, ariaLabel, successMessage }: Props) {
  const t = useT().lieptas;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage ?? t.copyToastSuccess);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error(t.copyToastError);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-strong px-2 py-1.5 rounded hover:bg-brand-soft transition-colors",
        className
      )}
      aria-label={ariaLabel ?? t.copyAriaLabel}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden />
          {t.copiedLabel}
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {t.copyLabel}
        </>
      )}
    </button>
  );
}
