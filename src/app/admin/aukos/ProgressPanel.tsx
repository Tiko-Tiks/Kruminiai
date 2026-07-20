"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  addProjectUpdate,
  deleteProjectUpdate,
  addProjectExpense,
  deleteProjectExpense,
} from "@/actions/project-progress";
import { toast } from "sonner";
import { Plus, Trash2, Hammer, Wallet, ImageIcon } from "lucide-react";
import { formatDate, getImagePublicUrl } from "@/lib/utils";
import { compressImage } from "@/lib/image-compress";

interface Project {
  id: string;
  slug: string;
  title: string;
  goal_cents: number;
  is_active: boolean;
}

interface ProjectUpdate {
  id: string;
  project_id: string;
  title: string;
  body: string | null;
  update_date: string;
  photos: string[];
  is_published: boolean;
  project?: { slug: string; title: string } | null;
}

interface ProjectExpense {
  id: string;
  project_id: string;
  description: string;
  supplier: string | null;
  amount_cents: number;
  expense_date: string;
  receipt_ref: string | null;
  note: string | null;
  project?: { slug: string; title: string } | null;
}

function extractError(err: unknown): string {
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null) {
    const formErr = (err as { _form?: string[] })._form;
    if (formErr && formErr[0]) return formErr[0];
    const first = Object.values(err as Record<string, string[]>)[0];
    if (Array.isArray(first) && first[0]) return first[0];
  }
  return "Klaida – patikrinkit duomenis";
}

export function ProgressPanel({
  projects,
  updates,
  expenses,
}: {
  projects: Project[];
  updates: ProjectUpdate[];
  expenses: ProjectExpense[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [uploading, setUploading] = useState(false);

  const totalSpentCents = expenses.reduce((s, e) => s + e.amount_cents, 0);

  async function handleUpdateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    // Nuotraukas suspaudžiam prieš siunčiant į server action
    const fileInput = form.querySelector<HTMLInputElement>('input[name="photos"]');
    const files = Array.from(fileInput?.files || []);
    formData.delete("photos");

    setUploading(true);
    try {
      for (const f of files) {
        const compressed = await compressImage(f);
        formData.append("photos", compressed);
      }
    } finally {
      setUploading(false);
    }

    startTransition(async () => {
      const r = (await addProjectUpdate(formData)) as { error?: unknown; success?: boolean };
      if (r.error) {
        toast.error(extractError(r.error));
        return;
      }
      toast.success("Eigos įrašas paskelbtas");
      form.reset();
      setShowUpdateForm(false);
      router.refresh();
    });
  }

  function handleUpdateDelete(u: ProjectUpdate) {
    if (!confirm(`Ištrinti įrašą „${u.title}"? Bus ištrintos ir nuotraukos.`)) return;
    startTransition(async () => {
      const r = (await deleteProjectUpdate(u.id)) as { error?: unknown; success?: boolean };
      if (r.error) {
        toast.error(typeof r.error === "string" ? r.error : "Klaida");
        return;
      }
      toast.success("Ištrinta");
      router.refresh();
    });
  }

  function handleExpenseSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    // Suma vedama eurais – konvertuojam į centus prieš siunčiant (DB laiko centus).
    const amountEur = parseFloat(formData.get("amount_eur") as string);
    formData.set("amount_cents", Math.round(amountEur * 100).toString());
    formData.delete("amount_eur");
    startTransition(async () => {
      const r = (await addProjectExpense(formData)) as { error?: unknown; success?: boolean };
      if (r.error) {
        toast.error(extractError(r.error));
        return;
      }
      toast.success("Išlaida užregistruota");
      form.reset();
      setShowExpenseForm(false);
      router.refresh();
    });
  }

  function handleExpenseDelete(x: ProjectExpense) {
    if (!confirm(`Ištrinti išlaidą „${x.description}" (${(x.amount_cents / 100).toFixed(2)} €)?`)) return;
    startTransition(async () => {
      const r = (await deleteProjectExpense(x.id)) as { error?: unknown; success?: boolean };
      if (r.error) {
        toast.error(typeof r.error === "string" ? r.error : "Klaida");
        return;
      }
      toast.success("Ištrinta");
      router.refresh();
    });
  }

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.title }));
  const busy = pending || uploading;

  return (
    <div className="space-y-6">
      {/* Statybų eigos įrašai */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Hammer className="h-4 w-4 text-amber-600" />
              Statybų eigos įrašai ({updates.length})
            </h2>
            <Button
              size="sm"
              variant={showUpdateForm ? "ghost" : "primary"}
              onClick={() => setShowUpdateForm((v) => !v)}
            >
              {showUpdateForm ? (
                "Uždaryti"
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Naujas įrašas
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {showUpdateForm && (
          <CardContent>
            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select name="project_id" label="Projektas *" options={projectOptions} required />
                <Input
                  name="update_date"
                  type="date"
                  label="Data *"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>

              <Input
                name="title"
                label="Pavadinimas *"
                placeholder='pvz. „Sumontuotos pirmosios terasinės lentos"'
                required
              />

              <Textarea
                name="body"
                label="Aprašymas (matomas viešai)"
                placeholder="Kas padaryta, kas toliau..."
                rows={3}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nuotraukos
                </label>
                <input
                  type="file"
                  name="photos"
                  accept="image/*"
                  multiple
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-green-50 file:text-green-700 file:font-semibold hover:file:bg-green-100"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Galima kelias iškart – prieš įkeliant automatiškai sumažinamos (iki 1600px).
                </p>
              </div>

              <div className="pt-2">
                <Button type="submit" loading={busy}>
                  {uploading ? "Ruošiamos nuotraukos..." : "Paskelbti įrašą"}
                </Button>
              </div>
            </form>
          </CardContent>
        )}

        {updates.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            Eigos įrašų dar nėra. Paskelbkit pirmą – bendruomenė laukia nuotraukų!
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {updates.map((u) => (
              <div key={u.id} className="px-5 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 text-sm">{u.title}</p>
                    {u.project && (
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">
                        {u.project.title}
                      </span>
                    )}
                    {(u.photos || []).length > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full inline-flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" />
                        {(u.photos || []).length}
                      </span>
                    )}
                  </div>
                  {u.body && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{u.body}</p>
                  )}
                  {(u.photos || []).length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {(u.photos || []).slice(0, 6).map((p) => (
                        <a key={p} href={getImagePublicUrl(p)} target="_blank" rel="noopener noreferrer">
                          <img
                            src={getImagePublicUrl(p)}
                            alt=""
                            className="h-12 w-12 object-cover rounded-md border border-gray-200"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">{formatDate(u.update_date)}</p>
                </div>
                <button
                  onClick={() => handleUpdateDelete(u)}
                  disabled={busy}
                  className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Išlaidos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-green-700" />
              Išlaidos ({expenses.length}) ·{" "}
              <span className="text-amber-700">{(totalSpentCents / 100).toFixed(2)} €</span>
            </h2>
            <Button
              size="sm"
              variant={showExpenseForm ? "ghost" : "primary"}
              onClick={() => setShowExpenseForm((v) => !v)}
            >
              {showExpenseForm ? (
                "Uždaryti"
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Nauja išlaida
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {showExpenseForm && (
          <CardContent>
            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select name="project_id" label="Projektas *" options={projectOptions} required />
                <Input
                  name="expense_date"
                  type="date"
                  label="Data *"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="description"
                  label="Paskirtis * (matoma viešai)"
                  placeholder='pvz. „Terasinės lentos, 40 vnt."'
                  required
                />
                <Input
                  name="amount_eur"
                  type="number"
                  step="0.01"
                  label="Suma (EUR) *"
                  placeholder="pvz. 480.00"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="supplier"
                  label="Tiekėjas (matomas viešai)"
                  placeholder='pvz. „UAB Mediena"'
                />
                <Input
                  name="receipt_ref"
                  label="Sąskaitos / kvito nr. (vidinis)"
                  placeholder="pvz. SF-2026-0154"
                />
              </div>

              <Input
                name="note"
                label="Vidinė pastaba"
                placeholder="Neprivaloma – viešai nerodoma"
              />

              <div className="pt-2">
                <Button type="submit" loading={pending}>
                  Registruoti išlaidą
                </Button>
              </div>
            </form>
          </CardContent>
        )}

        {expenses.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            Išlaidų dar nėra. Registruokit pagal sąskaitas faktūras – jos matomos viešai.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {expenses.map((x) => (
              <div key={x.id} className="px-5 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 text-sm">{x.description}</p>
                    {x.supplier && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">
                        {x.supplier}
                      </span>
                    )}
                    {x.project && (
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">
                        {x.project.title}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-1">
                    <span>{formatDate(x.expense_date)}</span>
                    {x.receipt_ref && <span>Nr: {x.receipt_ref}</span>}
                    {x.note && <span className="italic">&bdquo;{x.note}&ldquo;</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 flex items-center gap-2">
                  <span className="font-bold text-amber-700">
                    {(x.amount_cents / 100).toFixed(2)} €
                  </span>
                  <button
                    onClick={() => handleExpenseDelete(x)}
                    disabled={busy}
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
