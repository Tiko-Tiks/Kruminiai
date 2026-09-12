"use client";

import { useState } from "react";
import { resendPasswordSetupLink } from "@/actions/portal-invites";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

/**
 * Slaptažodžio nustatymo nuorodos persiuntimas nariui, kuris JAU turi paskyrą.
 *
 * Masinis „Paskyrų kūrimas" blokas tokių narių neapima (jie nebe kandidatai),
 * todėl be šio mygtuko narys, pamiršęs ar niekada nenusistatęs slaptažodžio,
 * iš admin pusės buvo nepasiekiamas.
 */
export function ResendLinkButton({
  memberId,
  memberName,
  email,
}: {
  memberId: string;
  memberName: string;
  email: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!confirm(`Siųsti slaptažodžio nustatymo nuorodą nariui ${memberName} (${email})?`)) {
      return;
    }
    setLoading(true);
    const result = await resendPasswordSetupLink(memberId);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Nuoroda išsiųsta į ${email}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title="Siųsti slaptažodžio nustatymo nuorodą"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded disabled:opacity-50"
    >
      <KeyRound className="h-3.5 w-3.5" />
      {loading ? "Siunčiama..." : "Slaptažodžio nuoroda"}
    </button>
  );
}
