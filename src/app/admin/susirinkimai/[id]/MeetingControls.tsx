"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMeetingStatus, deleteMeeting } from "@/actions/meetings";
import { Button } from "@/components/ui/Button";
import { Meeting } from "@/lib/types";
import { toast } from "sonner";
import { Play, Square, Trash2, FileText, UserCheck } from "lucide-react";
import Link from "next/link";

export function MeetingControls({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (status: string) => {
    setLoading(true);
    const result = await updateMeetingStatus(meeting.id, status);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Statusas pakeistas`);
      router.refresh();
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirm("Ar tikrai norite ištrinti šį susirinkimą? Visi nutarimai ir balsai bus pašalinti.")) return;
    setLoading(true);
    const result = await deleteMeeting(meeting.id);
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
    } else {
      toast.success("Susirinkimas ištrintas");
      router.push("/admin/susirinkimai");
    }
  };

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {meeting.status === "planuojamas" && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusChange("registracija")}
            loading={loading}
          >
            <UserCheck className="h-4 w-4" />
            Pradėti registraciją
          </Button>
          <Link href={`/admin/susirinkimai/${meeting.id}/redaguoti`}>
            <Button size="sm" variant="ghost">
              Redaguoti
            </Button>
          </Link>
        </>
      )}

      {meeting.status === "registracija" && (
        <Button
          size="sm"
          onClick={() => handleStatusChange("vyksta")}
          loading={loading}
        >
          <Play className="h-4 w-4" />
          Pradėti susirinkimą
        </Button>
      )}

      {meeting.status === "vyksta" && (
        <Button
          size="sm"
          variant="danger"
          onClick={() => handleStatusChange("baigtas")}
          loading={loading}
        >
          <Square className="h-4 w-4" />
          Baigti susirinkimą
        </Button>
      )}

      {meeting.status === "baigtas" && (
        <Link href={`/api/protokolas/${meeting.id}`} target="_blank">
          <Button size="sm" variant="outline">
            <FileText className="h-4 w-4" />
            Generuoti protokolą
          </Button>
        </Link>
      )}

      {(meeting.status === "planuojamas" || meeting.status === "atšauktas") && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          loading={loading}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
