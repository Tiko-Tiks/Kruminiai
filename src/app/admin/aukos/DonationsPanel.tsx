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

interface Project {
  id: string;
  slug: string;
  title: string;
  goal_cents: number;
  is_active: boolean;
}

interface Donation {
  id: string;
  project_id: string;
  donor_name: string | null;
  amount_cents: number;
  method: string;
  donated_at: string;
  is_anonymous: boolean;
  donor_message: string | null;
  external_ref: string | null;
  source_note: string | null;
  project?: { slug: string; title: string } | null;
}

const METHOD_LABELS: Record<string, string> = {
  sepa: "SEPA pavedimas",
  cash: "Grynaisiais",
  card: "Kortele",
  other: "Kita",
};

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
                    <p className="text-xs text-gray-500 mt-0.5">/{p.slug}</p>
                  </div>
                  <Link
                    href={`/${p.slug}`}
                    target="_blank"
                    className="text-xs text-green-700 hover:text-green-800 inline-flex items-center gap-1"
                  >
                    Žiūrėti <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <div className="text-2xl font-bold text-green-700">
                  {sumEur.toFixed(0)} € <span className="text-sm text-gray-500 font-normal">/ {goalEur.toFixed(0)} €</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 my-2">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-700 h-full rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {percent}% · {t.count} aukotojai (-os)
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="donor_name"
                  label="Aukotojo vardas"
                  placeholder="Vardas Pavardė arba palikit tuščią"
                />
                <Input
                  name="amount_cents"
                  type="number"
                  label="Suma centais *"
                  placeholder="pvz. 2000 = 20 EUR"
                  required
                />
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

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="is_anonymous" className="rounded border-gray-300" />
                Aukotojas norėjo likti anoniminis (vardas viešai nebus rodomas)
              </label>

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
                      {d.is_anonymous || !d.donor_name ? "Anonimas" : d.donor_name}
                    </p>
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
