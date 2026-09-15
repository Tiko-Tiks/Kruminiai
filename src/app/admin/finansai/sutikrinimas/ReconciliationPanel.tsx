"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  addBankStatement,
  addCashTransfer,
  deleteBankStatement,
  deleteCashTransfer,
  setOpeningBalance,
} from "@/actions/finance";
import { CASH_TRANSFER_DIRECTION_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, formatMoney } from "@/lib/utils";
import type {
  DailyRow,
  OpeningBalanceView,
  ReconSummary,
  StatementRow,
  Totals,
  TransferAdminRow,
} from "./types";

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

/** Eurai iš formos → centai. DB visur laiko centus (žr. CLAUDE.md konvencijas). */
function eurFieldToCents(formData: FormData, field: string) {
  const raw = formData.get(`${field}_eur`);
  if (raw === null) return;
  formData.set(field, Math.round(parseFloat(String(raw) || "0") * 100).toString());
  formData.delete(`${field}_eur`);
}

export function ReconciliationPanel({
  selectedStatementId,
  statements,
  transfers,
  recon,
  totals,
  openingBalance,
  daily,
}: {
  selectedStatementId: string | null;
  statements: StatementRow[];
  transfers: TransferAdminRow[];
  recon: ReconSummary;
  totals: Totals;
  openingBalance: OpeningBalanceView | null;
  daily: DailyRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showStatementForm, setShowStatementForm] = useState(!recon.hasStatement);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [showDaily, setShowDaily] = useState(false);

  const balanced = recon.differenceCents === 0;

  function submit(
    action: (fd: FormData) => Promise<unknown>,
    form: HTMLFormElement,
    prepare: (fd: FormData) => void,
    successMessage: string,
    onDone?: () => void
  ) {
    const formData = new FormData(form);
    prepare(formData);
    startTransition(async () => {
      const r = (await action(formData)) as { error?: unknown };
      if (r?.error) {
        toast.error(extractError(r.error));
        return;
      }
      toast.success(successMessage);
      form.reset();
      onDone?.();
      router.refresh();
    });
  }

  function remove(action: (id: string) => Promise<unknown>, id: string, confirmText: string) {
    if (!confirm(confirmText)) return;
    startTransition(async () => {
      const r = (await action(id)) as { error?: unknown };
      if (r?.error) {
        toast.error(extractError(r.error));
        return;
      }
      toast.success("Ištrinta");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Rezultatas                                                          */}
      {/* ------------------------------------------------------------------ */}
      <Card
        className={
          !recon.hasStatement
            ? ""
            : balanced
              ? "border-green-300 bg-green-50"
              : "border-red-300 bg-red-50"
        }
      >
        <CardContent>
          {recon.hasStatement ? (
            <>
              <div className="flex items-start gap-3">
                {balanced ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                )}
                <div>
                  <p
                    className={`font-semibold ${balanced ? "text-green-800" : "text-red-800"}`}
                  >
                    {balanced
                      ? "Sistema sutampa su banko išrašu."
                      : `Sistema NEsutampa su banko išrašu – skirtumas ${formatCurrency(
                          recon.differenceCents
                        )}.`}
                  </p>
                  {!balanced && (
                    <p className="text-sm text-red-700 mt-1">
                      Teigiamas skirtumas reiškia, kad sistemoje yra operacijų, kurių banke
                      nėra; neigiamas – kad banke yra tai, kas dar nesuvesta.
                    </p>
                  )}
                </div>
              </div>

              <table className="w-full text-sm mt-5">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-4 font-medium">Rodiklis</th>
                    <th className="py-2 px-4 font-medium text-right">Sistema</th>
                    <th className="py-2 px-4 font-medium text-right">Banko išrašas</th>
                    <th className="py-2 pl-4 font-medium text-right">Skirtumas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/70">
                  <CompareRow
                    label="Įplaukos į sąskaitą"
                    system={recon.systemIncomeCents}
                    statement={recon.statementIncomeCents}
                    difference={recon.incomeDifferenceCents}
                  />
                  <CompareRow
                    label="Išlaidos iš sąskaitos"
                    system={recon.systemExpenseCents}
                    statement={recon.statementExpenseCents}
                    difference={recon.expenseDifferenceCents}
                  />
                  <CompareRow
                    label="Likutis sąskaitoje"
                    system={recon.systemBankCents}
                    statement={recon.statementClosingCents}
                    difference={recon.differenceCents}
                    strong
                  />
                </tbody>
              </table>

              <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                <span>
                  Iš viso bendruomenė turi:{" "}
                  <strong className="text-gray-900">{formatMoney(totals.totalCents)}</strong>
                </span>
                <span>
                  banke <strong className="text-gray-900">{formatMoney(totals.bankCents)}</strong>
                </span>
                <span>
                  kasoje <strong className="text-gray-900">{formatMoney(totals.cashCents)}</strong>
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Banko išrašas dar nesuvestas. Suveskite laikotarpį ir sumas žemiau – tada bus su
              kuo lyginti.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Dienos pjūvis                                                       */}
      {/* ------------------------------------------------------------------ */}
      {recon.hasStatement && daily.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Judėjimas pagal dienas</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Sistemos banko operacijos su besikaupiančiu likučiu – lyginkit su išrašo
                  eilutėmis ir iškart matysite, kurią dieną išsiskiria.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowDaily((v) => !v)}>
                {showDaily ? "Suskleisti" : "Rodyti"}
              </Button>
            </div>
          </CardHeader>
          {showDaily && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                    <th className="px-5 py-2 font-medium">Data</th>
                    <th className="px-4 py-2 font-medium">Operacijos</th>
                    <th className="px-4 py-2 font-medium text-right">Įplaukos</th>
                    <th className="px-4 py-2 font-medium text-right">Išlaidos</th>
                    <th className="px-5 py-2 font-medium text-right">Likutis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {daily.map((row) => (
                    <tr key={row.date} className="align-top">
                      <td className="px-5 py-2 whitespace-nowrap text-gray-500">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        <ul className="space-y-0.5">
                          {row.items.map((item, i) => (
                            <li key={`${row.date}-${i}`} className="text-xs">
                              <span className={item.kind === "income" ? "" : "text-gray-500"}>
                                {item.label}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-2 text-right text-green-700 whitespace-nowrap">
                        {row.incomeCents ? formatCurrency(row.incomeCents) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-red-700 whitespace-nowrap">
                        {row.expenseCents ? `−${formatCurrency(row.expenseCents)}` : "—"}
                      </td>
                      <td className="px-5 py-2 text-right font-medium text-gray-900 whitespace-nowrap">
                        {formatCurrency(row.runningCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Banko išrašai                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Banko išrašai ({statements.length})
            </h2>
            <Button
              size="sm"
              variant={showStatementForm ? "ghost" : "primary"}
              onClick={() => setShowStatementForm((v) => !v)}
            >
              {showStatementForm ? (
                "Uždaryti"
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Naujas išrašas
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {showStatementForm && (
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(
                  addBankStatement,
                  e.currentTarget,
                  (fd) => {
                    eurFieldToCents(fd, "opening_cents");
                    eurFieldToCents(fd, "closing_cents");
                    eurFieldToCents(fd, "income_cents");
                    eurFieldToCents(fd, "expense_cents");
                  },
                  "Išrašas suvestas",
                  () => setShowStatementForm(false)
                );
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input name="period_start" type="date" label="Laikotarpio pradžia *" required />
                <Input name="period_end" type="date" label="Laikotarpio pabaiga *" required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input
                  name="opening_cents_eur"
                  type="number"
                  step="0.01"
                  label="Likutis pradžioje (EUR) *"
                  required
                />
                <Input
                  name="income_cents_eur"
                  type="number"
                  step="0.01"
                  label="Įplaukos (EUR) *"
                  required
                />
                <Input
                  name="expense_cents_eur"
                  type="number"
                  step="0.01"
                  label="Išlaidos (EUR) *"
                  required
                />
                <Input
                  name="closing_cents_eur"
                  type="number"
                  step="0.01"
                  label="Likutis pabaigoje (EUR) *"
                  required
                />
              </div>
              <Input name="note" label="Pastaba" placeholder="pvz. AB Artea, IBAN LT16…" />
              <p className="text-xs text-gray-500">
                Sumas veskite tiksliai iš išrašo, be apvalinimo. Sistema patikrins, ar pradinis
                likutis + įplaukos − išlaidos lygu galutiniam likučiui.
              </p>
              <Button type="submit" loading={pending}>
                Išsaugoti išrašą
              </Button>
            </form>
          </CardContent>
        )}

        {statements.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            Išrašų dar nesuvesta.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {statements.map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">
                    {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}
                    {s.id === selectedStatementId && (
                      <span className="ml-2 text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">
                        lyginama
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Pradžia {formatCurrency(s.openingCents)} · įplaukos{" "}
                    {formatCurrency(s.incomeCents)} · išlaidos {formatCurrency(s.expenseCents)} ·
                    pabaiga {formatCurrency(s.closingCents)}
                  </p>
                  {s.note && <p className="text-xs text-gray-400 mt-0.5 italic">{s.note}</p>}
                </div>
                <button
                  onClick={() =>
                    remove(
                      deleteBankStatement,
                      s.id,
                      `Ištrinti išrašą ${s.periodStart} – ${s.periodEnd}?`
                    )
                  }
                  disabled={pending}
                  className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Pervedimai tarp kasos ir banko                                      */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-gray-500" />
                Pervedimai tarp kasos ir banko ({transfers.length})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Nei pajamos, nei išlaidos – bendra suma nesikeičia. Bet be įrašo kasos likutis
                lieka per didelis, o banko – per mažas.
              </p>
            </div>
            <Button
              size="sm"
              variant={showTransferForm ? "ghost" : "primary"}
              onClick={() => setShowTransferForm((v) => !v)}
            >
              {showTransferForm ? (
                "Uždaryti"
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Naujas pervedimas
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {showTransferForm && (
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(
                  addCashTransfer,
                  e.currentTarget,
                  (fd) => eurFieldToCents(fd, "amount_cents"),
                  "Pervedimas įrašytas",
                  () => setShowTransferForm(false)
                );
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  name="transfer_date"
                  type="date"
                  label="Data *"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  required
                />
                <Select
                  name="direction"
                  label="Kryptis *"
                  placeholder="Pasirinkite..."
                  options={Object.entries(CASH_TRANSFER_DIRECTION_LABELS).map(
                    ([value, label]) => ({ value, label })
                  )}
                  required
                />
                <Input
                  name="amount_cents_eur"
                  type="number"
                  step="0.01"
                  label="Suma (EUR) *"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="note"
                  label="Pastaba"
                  placeholder="pvz. Grynieji įnešti į sąskaitą per asmeninį pavedimą"
                />
                <Input name="note_en" label="Pastaba (EN)" placeholder="Neprivaloma" />
              </div>
              <Button type="submit" loading={pending}>
                Įrašyti pervedimą
              </Button>
            </form>
          </CardContent>
        )}

        {transfers.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            Pervedimų dar nėra.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {transfers.map((tr) => (
              <div key={tr.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">
                    {CASH_TRANSFER_DIRECTION_LABELS[tr.direction] || tr.direction}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(tr.date)}
                    {tr.note && ` · ${tr.note}`}
                  </p>
                </div>
                <span className="font-bold text-gray-900">{formatCurrency(tr.amountCents)}</span>
                <button
                  onClick={() =>
                    remove(deleteCashTransfer, tr.id, `Ištrinti pervedimą ${tr.date}?`)
                  }
                  disabled={pending}
                  className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Pradinis likutis                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Pradinis likutis</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Atskaitos taškas: sistema neturi ankstesnių metų operacijų, todėl likutis
            skaičiuojamas nuo šios datos. Ankstesnių metų mokėjimai į sumas neįtraukiami.
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(
                setOpeningBalance,
                e.currentTarget,
                (fd) => eurFieldToCents(fd, "amount_cents"),
                "Pradinis likutis išsaugotas"
              );
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
          >
            <Input
              name="as_of_date"
              type="date"
              label="Data *"
              defaultValue={openingBalance?.asOfDate ?? ""}
              required
            />
            <Input
              name="amount_cents_eur"
              type="number"
              step="0.01"
              label="Likutis (EUR) *"
              defaultValue={
                openingBalance ? (openingBalance.amountCents / 100).toFixed(2) : ""
              }
              required
            />
            <Input name="note" label="Pastaba" defaultValue={openingBalance?.note ?? ""} />
            <div className="md:col-span-3">
              <Button type="submit" loading={pending}>
                Išsaugoti
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function CompareRow({
  label,
  system,
  statement,
  difference,
  strong = false,
}: {
  label: string;
  system: number;
  statement: number;
  difference: number;
  strong?: boolean;
}) {
  const ok = difference === 0;
  return (
    <tr className={strong ? "font-semibold" : ""}>
      <td className="py-2 pr-4 text-gray-700">{label}</td>
      <td className="py-2 px-4 text-right text-gray-900">{formatCurrency(system)}</td>
      <td className="py-2 px-4 text-right text-gray-900">{formatCurrency(statement)}</td>
      <td
        className={`py-2 pl-4 text-right ${ok ? "text-green-700" : "text-red-700 font-semibold"}`}
      >
        {formatCurrency(difference)}
      </td>
    </tr>
  );
}
