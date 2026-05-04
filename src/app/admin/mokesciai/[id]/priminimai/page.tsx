import { previewUnpaidMembers } from "@/actions/reminders";
import { ReminderPanel } from "./ReminderPanel";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReminderPage({ params }: { params: { id: string } }) {
  const data = await previewUnpaidMembers(params.id);
  if ("error" in data) notFound();

  return (
    <div>
      <Link
        href="/admin/mokesciai"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Atgal į mokesčius
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mokėjimų priminimai</h1>
        <p className="text-sm text-gray-500 mt-1">
          {data.period.name} · {(data.period.amount_cents / 100).toFixed(2)} EUR
        </p>
      </div>

      <ReminderPanel
        feePeriodId={data.period.id}
        period={data.period}
        unpaid={data.unpaid}
        counts={data.counts}
      />
    </div>
  );
}
