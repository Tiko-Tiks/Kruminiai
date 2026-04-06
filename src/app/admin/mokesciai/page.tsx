import { getFeePeriods, getPayments } from "@/actions/payments";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FEE_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { Plus } from "lucide-react";
import Link from "next/link";
import { CreateFeePeriodForm } from "./CreateFeePeriodForm";

interface Props {
  searchParams: { laikotarpis?: string };
}

export default async function FeesPage({ searchParams }: Props) {
  const periods = await getFeePeriods();
  const selectedPeriodId = searchParams.laikotarpis || periods[0]?.id;
  const payments = selectedPeriodId ? await getPayments(selectedPeriodId) : [];
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);

  const totalCollected = payments.reduce((s: number, p: { amount_cents: number }) => s + p.amount_cents, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mokesčiai</h1>
          <p className="text-sm text-gray-500 mt-1">Mokesčių laikotarpiai ir mokėjimai</p>
        </div>
        <Link href="/admin/mokesciai/naujas">
          <Button>
            <Plus className="h-4 w-4" /> Registruoti mokėjimą
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <CreateFeePeriodForm />

          <Card>
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-sm text-gray-900">Laikotarpiai</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {periods.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">Nėra laikotarpių</p>
              ) : (
                periods.map((period) => (
                  <Link
                    key={period.id}
                    href={`/admin/mokesciai?laikotarpis=${period.id}`}
                    className={`block px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${
                      period.id === selectedPeriodId ? "bg-blue-50 border-l-2 border-blue-600" : ""
                    }`}
                  >
                    <p className="font-medium text-gray-900">{period.name}</p>
                    <p className="text-xs text-gray-500">
                      {period.year} &middot; {formatCurrency(period.amount_cents)} &middot;{" "}
                      {FEE_TYPE_LABELS[period.fee_type] || period.fee_type}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {selectedPeriod ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <Card>
                  <CardContent>
                    <p className="text-sm text-gray-500">Mokėtina suma</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedPeriod.amount_cents)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <p className="text-sm text-gray-500">Surinkta</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(totalCollected)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <p className="text-sm text-gray-500">Mokėjimų</p>
                    <p className="text-xl font-bold text-gray-900">{payments.length}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-gray-500">
                        <th className="px-6 py-3 font-medium">Narys</th>
                        <th className="px-6 py-3 font-medium">Suma</th>
                        <th className="px-6 py-3 font-medium">Data</th>
                        <th className="px-6 py-3 font-medium">Būdas</th>
                        <th className="px-6 py-3 font-medium">Kvitas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                            Mokėjimų nėra šiam laikotarpiui
                          </td>
                        </tr>
                      ) : (
                        payments.map((payment: Record<string, unknown>) => {
                          const member = payment.member as Record<string, unknown> | null;
                          return (
                            <tr key={payment.id as string} className="border-b border-gray-50 hover:bg-gray-50/50">
                              <td className="px-6 py-3 font-medium text-gray-900">
                                {member
                                  ? `${member.last_name} ${member.first_name}`
                                  : "–"}
                              </td>
                              <td className="px-6 py-3">
                                <Badge variant="success">{formatCurrency(payment.amount_cents as number)}</Badge>
                              </td>
                              <td className="px-6 py-3 text-gray-600">{formatDate(payment.paid_date as string)}</td>
                              <td className="px-6 py-3 text-gray-600">
                                {PAYMENT_METHOD_LABELS[payment.payment_method as string] || "–"}
                              </td>
                              <td className="px-6 py-3 text-gray-600">{(payment.receipt_number as string) || "–"}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent>
                <p className="text-center text-gray-400 py-12">
                  Sukurkite mokesčio laikotarpį, kad galėtumėte registruoti mokėjimus
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
