"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { addExpulsion, removeExpulsion } from "@/actions/expulsions";
import type { ExpulsionEntry, DebtorCandidate } from "@/actions/expulsions";
import { Trash2, UserPlus, AlertTriangle, Phone, Mail, Info } from "lucide-react";
import { toast } from "sonner";

interface Props {
  meetingId: string;
  initialList: ExpulsionEntry[];
  initialCandidates: DebtorCandidate[];
}

export function ExpulsionsPanel({ meetingId, initialList, initialCandidates }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showCandidates, setShowCandidates] = useState(false);

  const total = initialList.length;
  const totalDebtEur = initialList.reduce((s, e) => s + e.debt_cents, 0) / 100;
  const candidatesMultiYear = initialCandidates.filter((c) => c.years_unpaid > 1);

  function handleAdd(memberId: string) {
    startTransition(async () => {
      const r = await addExpulsion(meetingId, memberId);
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Pridėta į šalinamų sąrašą");
      router.refresh();
    });
  }

  function handleRemove(id: string, name: string) {
    if (!confirm(`Pašalinti „${name}" iš šalinamų sąrašo?`)) return;
    startTransition(async () => {
      const r = await removeExpulsion(id);
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`„${name}" pašalintas iš sąrašo`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Suvestinė */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBox label="Šalinama" value={total.toString()} color="text-red-700" />
        <StatBox label="Bendra skola" value={`${totalDebtEur.toFixed(0)} EUR`} color="text-amber-700" />
        <StatBox
          label="Kandidatų likę"
          value={candidatesMultiYear.length.toString()}
          subText={`(≥2 m. skola, ${initialCandidates.length - candidatesMultiYear.length} su 1 m.)`}
        />
      </div>

      {/* Šalinamų sąrašas */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Tarybos sprendimu šalinami nariai ({total})
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Šis sąrašas automatiškai matomas darbotvarkės klausime Nr. 8.
          </p>
        </CardHeader>
        {total === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            Sąrašas tuščias. Pridėkit narius iš kandidatų sąrašo žemiau.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {initialList.map((e, idx) => (
              <div key={e.id} className="px-5 py-3 flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">
                      {e.first_name} {e.last_name}
                    </p>
                    {e.status === "pasyvus" && (
                      <span className="text-[10px] font-medium bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                        Pasyvus
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                    <span className="font-semibold text-red-700">
                      {(e.debt_cents / 100).toFixed(0)} EUR
                    </span>
                    <span>({e.debt_years})</span>
                    {e.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {e.phone}
                      </span>
                    )}
                    {e.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {e.email}
                      </span>
                    )}
                  </div>
                  {e.reason && (
                    <p className="text-xs text-gray-600 italic mt-1">{e.reason}</p>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(e.id, `${e.first_name} ${e.last_name}`)}
                  disabled={pending}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Pašalinti iš sąrašo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Kandidatai */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Kandidatai į šalinamų sąrašą
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Nariai su skola, kurie dar nėra šalinami. Pažymėti ≥2 m. skolą rodyti aukščiau.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCandidates((v) => !v)}
            >
              {showCandidates ? "Slėpti 1 m." : "Rodyti 1 m."}
            </Button>
          </div>
        </CardHeader>
        {initialCandidates.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            Visi skolingi nariai jau yra šalinamų sąraše arba neturi skolos.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {initialCandidates
              .filter((c) => showCandidates || c.years_unpaid > 1)
              .map((c) => (
                <div key={c.member_id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">
                        {c.first_name} {c.last_name}
                      </p>
                      {c.status === "pasyvus" && (
                        <span className="text-[10px] font-medium bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                          Pasyvus
                        </span>
                      )}
                      {c.years_unpaid > 1 && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                          {c.years_unpaid} m. skola
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 mt-0.5">
                      <span className="font-semibold text-red-700">
                        {(c.debt_cents / 100).toFixed(0)} EUR
                      </span>
                      <span>({c.debt_years})</span>
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </span>
                      )}
                      {!c.phone && !c.email && (
                        <span className="text-red-600">Be kontaktų</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAdd(c.member_id)}
                    disabled={pending}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Pridėti
                  </Button>
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* Pastaba apie sinchronizaciją */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900 flex gap-3">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium mb-1">Automatinė sinchronizacija</p>
          <p className="text-blue-800">
            Kiekvieną kartą, kai pridedat ar pašalinat narį, šis sąrašas automatiškai
            atnaujinamas darbotvarkės klausimo Nr. 8 aprašyme. Balsuotojai matys
            aktualų sąrašą.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  color = "text-gray-900",
  subText,
}: {
  label: string;
  value: string;
  color?: string;
  subText?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-600 mb-0.5">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subText && <p className="text-xs text-gray-400 mt-0.5">{subText}</p>}
    </div>
  );
}
