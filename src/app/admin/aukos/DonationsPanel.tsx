"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { addDonation, deleteDonation } from "@/actions/donations";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Heart } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { formatDonorName, looksLikeOrganisation } from "@/lib/donor-name";
import { DONATION_METHOD_LABELS, DONOR_DISPLAY_MODE_LABELS } from "@/lib/constants";

interface Project {
  id: string;
  slug: string;
  title: string;
  goal_cents: number;
  is_active: boolean;
  is_public: boolean;
}

interface Donation {
  id: string;
  project_id: string;
  donor_name: string | null;
  donor_first_name: string | null;
  donor_last_name: string | null;
  display_mode: string | null;
  amount_cents: number;
  method: string;
  donated_at: string;
  is_anonymous: boolean;
  donor_message: string | null;
  external_ref: string | null;
  source_note: string | null;
  project?: { slug: string; title: string } | null;
}

const METHOD_LABELS = DONATION_METHOD_LABELS;

export function DonationsPanel({
  projects,
  donations,
}: {
  projects: Project[];
  donations: Donation[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  // Gyva peržiūra: admin'as iškart mato, ką pamatys nariai ir lankytojai.
  // Be jos „inicialai pagal nutylėjimą" liktų nematoma taisyklė.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [displayMode, setDisplayMode] = useState("initials");

  const previewName = formatDonorName({
    donor_name: orgName || [firstName, lastName].filter(Boolean).join(" "),
    donor_first_name: orgName ? null : firstName,
    donor_last_name: orgName ? null : lastName,
    display_mode: displayMode,
  });

  // Organizacijoms inicialai beprasmiai – pasiūlom perjungti į pilną vardą
  const suggestFullMode = displayMode === "initials" && looksLikeOrganisation(orgName);

  function resetNameFields() {
    setFirstName("");
    setLastName("");
    setOrgName("");
    setDisplayMode("initials");
  }

  const totals = new Map<string, { count: number; sum: number }>();
  for (const d of donations) {
    const t = totals.get(d.project_id) || { count: 0, sum: 0 };
    t.count++;
    t.sum += d.amount_cents;
    totals.set(d.project_id, t);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    // Suma vedama eurais – konvertuojam į centus prieš siunčiant (DB laiko centus).
    const amountEur = parseFloat(formData.get("amount_eur") as string);
    formData.set("amount_cents", Math.round(amountEur * 100).toString());
    formData.delete("amount_eur");
    startTransition(async () => {
      const r = (await addDonation(formData)) as { error?: unknown; success?: boolean };
      if (r.error) {
        const err = r.error;
        let msg = "Klaida – patikrinkit duomenis";
        if (typeof err === "string") msg = err;
        else if (typeof err === "object" && err !== null) {
          const formErr = (err as { _form?: string[] })._form;
          if (formErr && formErr[0]) msg = formErr[0];
        }
        toast.error(msg);
        return;
      }
      toast.success("Auka pridėta");
      form.reset();
      resetNameFields();
      setShowForm(false);
      router.refresh();
    });
  }

  function handleDelete(id: string, donorName: string | null) {
    if (!confirm(`Ištrinti aukos įrašą${donorName ? ` (${donorName})` : ""}?`)) return;
    startTransition(async () => {
      const r = (await deleteDonation(id)) as { error?: unknown; success?: boolean };
      if (r.error) {
        toast.error(typeof r.error === "string" ? r.error : "Klaida");
        return;
      }
      toast.success("Ištrinta");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Projektai */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => {
          const t = totals.get(p.id) || { count: 0, sum: 0 };
          const goalEur = p.goal_cents / 100;
          const sumEur = t.sum / 100;
          const percent = goalEur > 0 ? Math.min(100, Math.round((sumEur / goalEur) * 100)) : 0;
          return (
            <Card key={p.id}>
              <CardContent>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{p.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {p.is_public ? `/projektai/${p.slug}` : "Vidinis – be viešo puslapio"}
                    </p>
                  </div>
                  {/* Projekto puslapis yra /projektai/[slug]; šakninis /<slug>
                      egzistuoja tik liepto istorinei nuorodai. Nevieši projektai
                      (pvz. Bendruomenės fondas) viešo puslapio apskritai neturi –
                      jų sudėtį rodo /finansai kortelė. */}
                  {p.is_public ? (
                    <Link
                      href={`/projektai/${p.slug}`}
                      target="_blank"
                      className="text-xs text-green-700 hover:text-green-800 inline-flex items-center gap-1"
                    >
                      Žiūrėti <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <Link
                      href="/finansai"
                      target="_blank"
                      className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
                    >
                      Finansuose <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
                <div className="text-2xl font-bold text-green-700">
                  {sumEur.toFixed(0)} €{goalEur > 0 && (
                    <span className="text-sm text-gray-500 font-normal"> / {goalEur.toFixed(0)} €</span>
                  )}
                </div>
                {goalEur > 0 && (
                  <div className="w-full bg-gray-100 rounded-full h-2 my-2">
                    <div
                      className="bg-gradient-to-r from-green-500 to-green-700 h-full rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  {goalEur > 0 && <>{percent}% · </>}{t.count} aukotojai (-os)
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Forma */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              Pridėti naują auką
            </h2>
            <Button size="sm" variant={showForm ? "ghost" : "primary"} onClick={() => setShowForm((v) => !v)}>
              {showForm ? (
                "Uždaryti"
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Nauja auka
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {showForm && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  name="project_id"
                  label="Projektas *"
                  options={projects.map((p) => ({ value: p.id, label: p.title }))}
                  required
                />
                <Select
                  name="method"
                  label="Aukos būdas *"
                  options={Object.entries(METHOD_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                  defaultValue="sepa"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  name="donor_first_name"
                  label="Vardas"
                  placeholder="pvz. Vaida"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={Boolean(orgName)}
                />
                <Input
                  name="donor_last_name"
                  label="Pavardė"
                  placeholder="pvz. Kuncienė"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={Boolean(orgName)}
                />
                <Input
                  name="amount_eur"
                  type="number"
                  step="0.01"
                  label="Suma (EUR) *"
                  placeholder="pvz. 20.00"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="donor_name"
                  label="Arba pavadinimas (organizacija, šeima)"
                  placeholder='pvz. „Varėnos rajono savivaldybė" arba „Norkūnų šeima"'
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
                <Select
                  name="display_mode"
                  label="Kaip rodyti viešai *"
                  options={Object.entries(DONOR_DISPLAY_MODE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  value={displayMode}
                  onChange={(e) => setDisplayMode(e.target.value)}
                  required
                />
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                <span className="text-gray-500">Viešai bus rodoma: </span>
                <span className="font-semibold text-gray-900">{previewName}</span>
                {suggestFullMode && (
                  <p className="text-xs text-amber-700 mt-1">
                    Panašu į organizaciją – jai tinkamesnis „Pilnas vardas“.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="donated_at"
                  type="date"
                  label="Aukos data *"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  required
                />
                <Input
                  name="external_ref"
                  label="Banko pavedimo nr."
                  placeholder="iš banko išrašo"
                />
              </div>

              <Textarea
                name="donor_message"
                label="Aukotojo žinutė (matoma viešai)"
                placeholder="Neprivaloma..."
                rows={2}
              />

              <Input
                name="source_note"
                label="Šaltinis (vidinė pastaba)"
                placeholder='pvz. „Liepto QR parduotuvėje" arba „Bank išrašas 2026-05-06"'
              />

              <div className="pt-2">
                <Button type="submit" loading={pending}>
                  Pridėti auką
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Aukų sąrašas */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">
            Visos aukos ({donations.length})
          </h2>
        </CardHeader>
        {donations.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            Aukų dar nėra. Pridėkit pirmą per formą aukščiau.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {donations.map((d) => (
              <div key={d.id} className="px-5 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 text-sm">
                      {d.donor_name || "Anonimas"}
                    </p>
                    {/* Ką iš tikrųjų mato nariai ir lankytojai */}
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                      viešai: {formatDonorName(d)}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">
                      {METHOD_LABELS[d.method] || d.method}
                    </span>
                    {d.project && (
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">
                        {d.project.title}
                      </span>
                    )}
                  </div>
                  {d.donor_message && (
                    <p className="text-xs text-gray-600 italic mt-1">&bdquo;{d.donor_message}&ldquo;</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-1">
                    <span>{formatDate(d.donated_at)}</span>
                    {d.external_ref && <span>Nr: {d.external_ref}</span>}
                    {d.source_note && <span className="italic">&bdquo;{d.source_note}&ldquo;</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 flex items-center gap-2">
                  <span className="font-bold text-green-700">
                    {(d.amount_cents / 100).toFixed(2)} €
                  </span>
                  <button
                    onClick={() => handleDelete(d.id, d.donor_name)}
                    disabled={pending}
                    className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
