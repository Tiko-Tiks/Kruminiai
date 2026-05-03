import { getMemberFinancialStatus } from "@/actions/portal";
import { formatDate, formatCurrency } from "@/lib/utils";
import { FEE_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { Banknote, AlertTriangle, CheckCircle2, Receipt, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

interface UnpaidItem {
  fee_period_id: string;
  year: number;
  name: string;
  amount_cents: number;
  fee_type: string;
  due_date: string | null;
  is_overdue: boolean;
}

interface PaidItem {
  id: string;
  amount_cents: number;
  paid_date: string;
  payment_method: string;
  receipt_number: string | null;
  fee_period: {
    year: number;
    name: string;
    fee_type: string;
  };
}

export default async function PortalFinancialPage() {
  const data = (await getMemberFinancialStatus()) as {
    unpaid?: UnpaidItem[];
    paid?: PaidItem[];
    total_debt_cents?: number;
    error?: string;
  };

  if (data?.error === "no_member_link") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Finansai</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
          Paskyra nesusieta su nario įrašu. Susisiekite su administratoriumi.
        </div>
      </div>
    );
  }

  const unpaid = data?.unpaid || [];
  const paid = data?.paid || [];
  const totalDebt = data?.total_debt_cents || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finansai</h1>
        <p className="text-sm text-gray-500 mt-1">
          Jūsų nario mokesčių būsena ir mokėjimo istorija
        </p>
      </div>

      {/* Bendra būsena */}
      <div
        className={`rounded-xl border p-5 ${
          totalDebt > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
        }`}
      >
        <div className="flex items-center gap-4">
          {totalDebt > 0 ? (
            <AlertTriangle className="h-10 w-10 text-red-600 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="h-10 w-10 text-green-600 flex-shrink-0" />
          )}
          <div>
            <p className={`text-3xl font-bold ${totalDebt > 0 ? "text-red-700" : "text-green-700"}`}>
              {formatCurrency(totalDebt)}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              {totalDebt > 0 ? "neapmokėtų mokesčių iš viso" : "neapmokėtų mokesčių neturite"}
            </p>
          </div>
        </div>
      </div>

      {/* Skolos */}
      {unpaid.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Neapmokėti mokesčiai ({unpaid.length})
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {unpaid.map((u) => (
                <li key={u.fee_period_id} className="px-5 py-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Banknote
                      className={`h-5 w-5 flex-shrink-0 mt-0.5 ${u.is_overdue ? "text-red-500" : "text-amber-500"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">
                        {u.year} m. {u.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {FEE_TYPE_LABELS[u.fee_type] || u.fee_type}
                        {u.due_date && (
                          <>
                            {" · "}
                            <span className={u.is_overdue ? "text-red-600 font-medium" : ""}>
                              {u.is_overdue ? "Pradelsta " : "Iki "}
                              {formatDate(u.due_date)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-semibold ${u.is_overdue ? "text-red-700" : "text-gray-900"}`}>
                      {formatCurrency(u.amount_cents)}
                    </p>
                    {u.is_overdue && (
                      <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" /> Pradelsta
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Mokesčius galite sumokėti pavedimu į bendruomenės sąskaitą. Susisiekite su pirmininku
            dėl rekvizitų.
          </p>
        </section>
      )}

      {/* Mokėjimo istorija */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Mokėjimo istorija ({paid.length})
        </h2>
        {paid.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Receipt className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Mokėjimų dar nėra</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {paid.map((p) => (
                <li key={p.id} className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">
                        {p.fee_period.year} m. {p.fee_period.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(p.paid_date)} ·{" "}
                        {PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method}
                        {p.receipt_number && ` · #${p.receipt_number}`}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900 flex-shrink-0">
                    {formatCurrency(p.amount_cents)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
