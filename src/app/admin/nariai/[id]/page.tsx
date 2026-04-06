import { getMember } from "@/actions/members";
import { getMemberPayments } from "@/actions/payments";
import { MemberForm } from "../MemberForm";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { notFound } from "next/navigation";

interface Props {
  params: { id: string };
}

export default async function EditMemberPage({ params }: Props) {
  let member;
  try {
    member = await getMember(params.id);
  } catch {
    notFound();
  }

  const payments = await getMemberPayments(params.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {member.first_name} {member.last_name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Nario informacija ir mokėjimų istorija</p>
      </div>

      <MemberForm member={member} />

      <Card>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Mokėjimų istorija</h2>
        </div>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Mokėjimų nėra</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="pb-2 font-medium">Laikotarpis</th>
                  <th className="pb-2 font-medium">Sumokėta</th>
                  <th className="pb-2 font-medium">Data</th>
                  <th className="pb-2 font-medium">Būdas</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: Record<string, unknown>) => (
                  <tr key={p.id as string} className="border-b border-gray-50">
                    <td className="py-2 text-gray-700">
                      {(p.fee_period as Record<string, unknown>)?.name as string}{" "}
                      ({(p.fee_period as Record<string, unknown>)?.year as number})
                    </td>
                    <td className="py-2">
                      <Badge variant="success">{formatCurrency(p.amount_cents as number)}</Badge>
                    </td>
                    <td className="py-2 text-gray-600">{formatDate(p.paid_date as string)}</td>
                    <td className="py-2 text-gray-600">
                      {PAYMENT_METHOD_LABELS[p.payment_method as string] || p.payment_method as string}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
