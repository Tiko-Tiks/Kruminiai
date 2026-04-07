import { getMeeting } from "@/actions/meetings";
import { MeetingForm } from "../../MeetingForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Redaguoti susirinkimą | Administravimas",
};

export default async function EditMeetingPage({ params }: { params: { id: string } }) {
  const meeting = await getMeeting(params.id);

  return (
    <div>
      <Link
        href={`/admin/susirinkimai/${params.id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Atgal
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Redaguoti susirinkimą</h1>
      <MeetingForm meeting={meeting} />
    </div>
  );
}
