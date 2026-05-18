import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getMeetingExpulsions } from "@/actions/expulsions";
import { ExpulsionsPanel } from "./ExpulsionsPanel";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatDateLong } from "@/lib/utils";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExpulsionsPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, title, meeting_date, status")
    .eq("id", params.id)
    .single();

  if (!meeting) notFound();

  const { list, candidates } = await getMeetingExpulsions(params.id);

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/admin/susirinkimai/${params.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Atgal į susirinkimą
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Šalinamų narių sąrašas</h1>
        <p className="text-sm text-gray-500 mt-1">
          {meeting.title} — {formatDateLong(meeting.meeting_date)}
        </p>
        <p className="text-sm text-gray-600 mt-2 max-w-3xl">
          Tarybos sprendimu šalinami nariai dėl sistematinio nario mokesčio nemokėjimo
          (įstatų 3.5 p.). Šis sąrašas automatiškai sinchronizuojamas su darbotvarkės
          klausimo Nr. 8 aprašymu.
        </p>
      </div>

      <ExpulsionsPanel
        meetingId={params.id}
        initialList={list}
        initialCandidates={candidates}
      />
    </div>
  );
}
