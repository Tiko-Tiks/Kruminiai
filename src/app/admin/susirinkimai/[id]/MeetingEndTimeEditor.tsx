"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMeetingEndedAt } from "@/actions/meetings";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { isoToVilniusLocal, formatDateLong, formatTime } from "@/lib/utils";
import { toast } from "sonner";
import { Clock } from "lucide-react";

/**
 * Posėdžio pabaigos laiko (`meetings.ended_at`) redagavimas.
 *
 * Anksčiau `ended_at` buvo nustatomas TIK automatiškai, keičiant statusą į
 * „baigtas" – tad jei susirinkimas buvo užbaigtas sistemoje kitu metu nei iš
 * tikrųjų (ar protokolas pildomas kitą dieną), laiką tekdavo taisyti per SQL.
 *
 * Laikas įvedamas ir rodomas Europe/Vilnius zona (konversiją daro serveris).
 */
export function MeetingEndTimeEditor({
  meetingId,
  meetingDate,
  endedAt,
}: {
  meetingId: string;
  meetingDate: string;
  endedAt: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    endedAt ? isoToVilniusLocal(endedAt) : isoToVilniusLocal(meetingDate)
  );
  const [saving, setSaving] = useState(false);

  async function save(nextValue: string) {
    setSaving(true);
    const result = await updateMeetingEndedAt(meetingId, nextValue);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(nextValue ? "Pabaigos laikas išsaugotas" : "Pabaigos laikas išvalytas");
    setEditing(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-900">Posėdžio pabaiga:</span>
            {endedAt ? (
              <span className="text-gray-700">
                {formatDateLong(endedAt)} {formatTime(endedAt)}
              </span>
            ) : (
              <span className="text-gray-400">nenurodyta</span>
            )}
          </div>

          {!editing ? (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              {endedAt ? "Keisti" : "Nurodyti"}
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="2026-09-13T12:00"
                pattern="\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d"
                className="text-sm rounded-lg border border-gray-300 px-3 py-2 w-52"
              />
              <Button size="sm" onClick={() => save(value)} loading={saving}>
                Išsaugoti
              </Button>
              {endedAt && (
                <Button size="sm" variant="ghost" onClick={() => save("")} loading={saving}>
                  Išvalyti
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setValue(endedAt ? isoToVilniusLocal(endedAt) : isoToVilniusLocal(meetingDate));
                }}
              >
                Atšaukti
              </Button>
            </div>
          )}
        </div>
        {editing && (
          <p className="text-xs text-gray-400 mt-2">
            Formatas: YYYY-MM-DDTHH:MM (Vilniaus laiku). Rodoma protokole šalia
            susirinkimo pradžios.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
